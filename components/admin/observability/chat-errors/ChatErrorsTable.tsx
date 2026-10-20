'use client';

import { format } from 'date-fns';
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
import { chatErrorStageMeta } from './chat-error-stage';
import type { ChatError } from '@/types/admin-chat-errors';

const COLUMNS: ObservabilityColumn[] = [
  { key: 'time', label: 'Time', className: 'w-[130px]' },
  { key: 'source', label: 'Source', className: 'w-[90px]' },
  { key: 'stage', label: 'Stage', className: 'w-[120px]' },
  { key: 'code', label: 'Code', className: 'w-[170px]' },
  { key: 'http', label: 'HTTP', className: 'w-[70px]' },
  { key: 'message', label: 'Message' },
  { key: 'tool', label: 'Tool', className: 'w-[130px]' },
  { key: 'user', label: 'User', className: 'w-[170px]' },
  { key: 'platform', label: 'Platform', className: 'w-[120px]' },
];

const EMPTY = <span className="text-sm text-muted-foreground">—</span>;

/** The clock time, since an error is read against a log; the full date in the tooltip. */
function OccurredAtCell({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span className="text-sm text-muted-foreground">{value}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help text-sm tabular-nums">{format(date, 'd MMM HH:mm:ss')}</span>
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
            <Badge variant="secondary" className="font-normal capitalize">
              {error.source}
            </Badge>
          </TableCell>
          <TableCell>
            <StatusBadge meta={chatErrorStageMeta(error.stage)} />
          </TableCell>
          <TableCell className="max-w-[170px]">
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
          <TableCell className="max-w-[360px]">
            <ErrorCell error={error.message} className="text-foreground" />
            <RefsLine error={error} />
          </TableCell>
          <TableCell className="max-w-[130px]">
            {error.tool_name ? (
              <span className="block truncate font-mono text-xs">{error.tool_name}</span>
            ) : (
              EMPTY
            )}
          </TableCell>
          <TableCell className="max-w-[170px]">
            {error.user ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{error.user.name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">#{error.user.id}</p>
              </div>
            ) : (
              EMPTY
            )}
          </TableCell>
          <TableCell>
            {error.platform ? (
              <span className="text-sm">{error.platform}</span>
            ) : (
              EMPTY
            )}
            {error.app_version && (
              <p className="text-xs tabular-nums text-muted-foreground">{error.app_version}</p>
            )}
          </TableCell>
        </TableRow>
      ))}
    </ObservabilityTable>
  );
}
