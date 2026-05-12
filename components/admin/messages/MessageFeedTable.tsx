'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink, MessageSquare, Paperclip, UserX } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type {
  AdminMessageListResponse,
  AdminMessageRow,
} from '@/types/admin-messages';
import {
  ROLE_LABEL,
  ROLE_TONE,
  SENT_VIA_LABEL,
  SENT_VIA_TONE,
  formatRelativeTime,
  truncate,
} from './message-meta';

interface MessageFeedTableProps {
  pages: AdminMessageListResponse[] | undefined;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  onLoadMore: () => void;
  onRowClick: (id: number) => void;
  selectedId: number | null;
  error: Error | null;
  hasUsageColumn: boolean;
}

export function MessageFeedTable({
  pages,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onRowClick,
  selectedId,
  error,
  hasUsageColumn,
}: MessageFeedTableProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();
  const costOptions = { showNGN, exchangeRate };

  // Cursor pages can overlap on poll boundaries — de-dupe by id.
  const rows = useMemo<AdminMessageRow[]>(() => {
    if (!pages) return [];
    const seen = new Set<number>();
    const out: AdminMessageRow[] = [];
    for (const page of pages) {
      for (const row of page.data) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [pages]);

  if (isLoading && !rows.length) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        Failed to load messages. Please try again.
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        No messages match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Time</TableHead>
              <TableHead className="w-[180px]">User</TableHead>
              <TableHead className="w-[90px]">Role</TableHead>
              <TableHead>Content</TableHead>
              <TableHead className="w-[200px]">Funding</TableHead>
              {hasUsageColumn && (
                <TableHead className="w-[140px] text-right">Usage</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isSelected = row.id === selectedId;
              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? 'selected' : undefined}
                  onClick={() => onRowClick(row.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="text-xs text-muted-foreground align-top">
                    <time
                      dateTime={row.created_at}
                      title={new Date(row.created_at).toLocaleString()}
                    >
                      {formatRelativeTime(row.created_at)}
                    </time>
                  </TableCell>
                  <TableCell className="align-top">
                    <Link
                      href={`/admin/users/${row.user.uuid}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-sm hover:underline truncate max-w-[170px]"
                    >
                      <span className="truncate">
                        {row.user.name || row.user.email || row.user.uuid}
                      </span>
                      {row.user.deleted_at && (
                        <UserX
                          className="h-3 w-3 text-muted-foreground shrink-0"
                          aria-label="Deleted account"
                        />
                      )}
                    </Link>
                    {row.user.email && row.user.name && (
                      <p className="truncate text-[11px] text-muted-foreground max-w-[170px]">
                        {row.user.email}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', ROLE_TONE[row.role])}
                    >
                      {ROLE_LABEL[row.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top max-w-[460px]">
                    <p className="text-sm leading-snug line-clamp-2">
                      {row.content
                        ? truncate(row.content, 220)
                        : '(empty content)'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <Link
                          href={`/admin/conversations/${row.conversation.uuid}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline truncate max-w-[220px]"
                        >
                          {row.conversation.title || 'Untitled conversation'}
                        </Link>
                      </span>
                      {row.attachment && (
                        <span
                          className="inline-flex items-center gap-1"
                          title={row.attachment.file_name}
                        >
                          <Paperclip className="h-3 w-3" />
                          <span className="truncate max-w-[140px]">
                            {row.attachment.file_name}
                          </span>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <FundingCell row={row} />
                  </TableCell>
                  {hasUsageColumn && (
                    <TableCell className="align-top text-right tabular-nums text-xs">
                      {row.usage ? (
                        <>
                          <div className="font-medium">
                            {formatCost(row.usage.estimated_cost, costOptions)}
                          </div>
                          <div className="text-muted-foreground">
                            {row.usage.total_tokens.toLocaleString()} tok
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
      {!hasNextPage && rows.length > 10 && (
        <div className="pt-2 text-center text-xs text-muted-foreground">
          End of list
        </div>
      )}
    </div>
  );
}

function FundingCell({ row }: { row: AdminMessageRow }) {
  if (!row.attribution) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const { kind, plan, message_pack, campaign, sponsor } = row.attribution;
  return (
    <div className="space-y-1 min-w-0">
      <Badge
        variant="outline"
        className={cn('text-[10px]', SENT_VIA_TONE[kind])}
      >
        {SENT_VIA_LABEL[kind]}
      </Badge>
      <div className="text-[11px] text-muted-foreground space-y-0.5">
        {plan && <p className="truncate">{plan.name}</p>}
        {message_pack && <p className="truncate">{message_pack.name}</p>}
        {sponsor && (
          <p className="inline-flex items-center gap-1 truncate">
            <Link
              href={`/admin/sponsors/${sponsor.id}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline truncate"
            >
              {sponsor.name}
            </Link>
            {campaign && (
              <>
                <span>·</span>
                <Link
                  href={`/admin/campaigns/${campaign.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline truncate"
                >
                  {campaign.name}
                </Link>
              </>
            )}
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </p>
        )}
      </div>
    </div>
  );
}
