'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  ObservabilityTable,
  StatusBadge,
  ErrorCell,
  type ObservabilityColumn,
} from '@/components/admin/observability';
import { chatErrorChat } from './chat-error-chat';
import { chatErrorStageMeta } from './chat-error-stage';
import type { ChatError } from '@/types/admin-chat-errors';

/* Seven columns, so the list fits a 1440 px screen beside the admin rail: the
 * source sits under the stage, and the platform under the user. Nine columns
 * pushed User and Platform past the card's edge. */
const COLUMNS: ObservabilityColumn[] = [
  { key: 'time', label: 'Time', className: 'w-[104px]' },
  { key: 'stage', label: 'Stage', className: 'w-[112px]' },
  { key: 'code', label: 'Code', className: 'w-[150px]' },
  { key: 'http', label: 'HTTP', className: 'w-[56px]' },
  { key: 'message', label: 'Message' },
  { key: 'tool', label: 'Tool', className: 'w-[110px]' },
  { key: 'user', label: 'User', className: 'w-[160px]' },
];

const EMPTY = <span className="text-sm text-muted-foreground">—</span>;

/** The clock time over the day, since an error is read against a log; the full date in the tooltip. */
function OccurredAtCell({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span className="text-sm text-muted-foreground">{value}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block cursor-help tabular-nums">
          <span className="block text-sm">{format(date, 'HH:mm:ss')}</span>
          <span className="block text-xs text-muted-foreground">{format(date, 'd MMM')}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{format(date, 'PPpp')}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** The ids that find the turn elsewhere, small and muted under the message. */
function RefsLine({ error }: { error: ChatError }) {
  const refs = [
    error.conversation_id != null ? `conversation ${error.conversation_id}` : null,
    error.execution_id != null ? `execution ${error.execution_id}` : null,
    error.ai_request_id != null ? `request ${error.ai_request_id}` : null,
    error.space_id != null ? `space ${error.space_id}` : null,
  ].filter((ref): ref is string => ref !== null);
  if (refs.length === 0) return null;
  return (
    <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
      {refs.join(' · ')}
    </p>
  );
}

/** The way to the chat: "Open chat" when the admin chat view can show it,
 *  else why it cannot. */
function ChatLine({ error }: { error: ChatError }) {
  const chat = chatErrorChat(error);
  if (!chat) return null;
  return (
    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
      <MessageSquare aria-hidden className="h-3 w-3 shrink-0" />
      {chat.kind === 'link' ? (
        <Link href={chat.href} className="font-medium text-foreground hover:underline">
          Open chat
        </Link>
      ) : (
        <span className="truncate">{chat.text}</span>
      )}
    </p>
  );
}

interface ChatErrorsTableProps {
  errors: ChatError[];
  isLoading: boolean;
}

export function ChatErrorsTable({ errors, isLoading }: ChatErrorsTableProps) {
  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={errors.length === 0}
      emptyText="No chat errors match"
    >
      {errors.map((error, index) => (
        <TableRow key={error.id} className={cn(index % 2 === 1 && 'bg-muted/20')}>
          <TableCell>
            <OccurredAtCell value={error.occurred_at} />
          </TableCell>
          <TableCell>
            <StatusBadge meta={chatErrorStageMeta(error.stage)} />
            <Badge variant="secondary" className="mt-1 flex w-fit font-normal capitalize">
              {error.source}
            </Badge>
          </TableCell>
          <TableCell className="max-w-[150px]">
            {error.error_code ? (
              <span className="block truncate font-mono text-xs">{error.error_code}</span>
            ) : (
              EMPTY
            )}
            {error.error_type && (
              <p className="truncate text-xs text-muted-foreground">{error.error_type}</p>
            )}
          </TableCell>
          <TableCell>
            {error.http_status != null ? (
              <span className="text-sm tabular-nums">{error.http_status}</span>
            ) : (
              EMPTY
            )}
          </TableCell>
          <TableCell className="w-full max-w-0">
            <ErrorCell error={error.message} className="text-foreground" />
            <RefsLine error={error} />
            <ChatLine error={error} />
          </TableCell>
          <TableCell className="max-w-[110px]">
            {error.tool_name ? (
              <span className="block truncate font-mono text-xs">{error.tool_name}</span>
            ) : (
              EMPTY
            )}
          </TableCell>
          <TableCell className="max-w-[160px]">
            {error.user ? (
              <p className="truncate text-sm font-medium">{error.user.name}</p>
            ) : (
              EMPTY
            )}
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              {[
                error.user ? `#${error.user.id}` : null,
                error.platform,
                error.app_version,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </TableCell>
        </TableRow>
      ))}
    </ObservabilityTable>
  );
}
