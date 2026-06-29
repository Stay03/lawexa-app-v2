'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminConversationsPagination } from '@/types/admin';

interface AdminPaginationProps {
  pagination: AdminConversationsPagination;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  perPage?: number;
  onPerPageChange?: (perPage: number) => void;
}

/** Windowed page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 73]. */
function getPageRange(current: number, last: number): (number | 'gap')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);
  if (start > 2) pages.push('gap');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < last - 1) pages.push('gap');
  pages.push(last);
  return pages;
}

export function AdminPagination({
  pagination,
  onPageChange,
  itemLabel = 'items',
  perPage,
  onPerPageChange,
}: AdminPaginationProps) {
  const { current_page, last_page, total, from, to } = pagination;
  const hasPrevious = current_page > 1;
  const hasNext = current_page < last_page;
  const pages = getPageRange(current_page, last_page);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Count + per-page (one row on mobile) */}
      <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Showing {from || 0}–{to || 0} of {total} {itemLabel}
        </p>

        {perPage !== undefined && onPerPageChange && (
          <Select
            value={String(perPage)}
            onValueChange={(value) => onPerPageChange(parseInt(value))}
          >
            <SelectTrigger className="h-8 w-[92px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="15">15 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Navigation (own row on mobile, spread edge-to-edge) */}
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(current_page - 1)}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>

        {/* Numbered pages (sm+) */}
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((p, i) =>
            p === 'gap' ? (
              <span
                key={`gap-${i}`}
                className="px-1.5 text-sm text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === current_page ? 'default' : 'outline'}
                size="sm"
                className="h-8 min-w-8 px-2 tabular-nums"
                onClick={() => onPageChange(p)}
                aria-current={p === current_page ? 'page' : undefined}
              >
                {p}
              </Button>
            )
          )}
        </div>

        {/* Compact indicator (mobile) */}
        <span className="text-sm text-muted-foreground tabular-nums sm:hidden">
          Page {current_page} of {last_page}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(current_page + 1)}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
