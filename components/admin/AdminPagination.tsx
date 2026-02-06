'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminConversationsPagination } from '@/types/admin';

interface AdminPaginationProps {
  pagination: AdminConversationsPagination;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function AdminPagination({
  pagination,
  onPageChange,
  itemLabel = 'items',
}: AdminPaginationProps) {
  const { current_page, last_page, total, from, to } = pagination;
  const hasPrevious = current_page > 1;
  const hasNext = current_page < last_page;

  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {from || 0} - {to || 0} of {total} {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(current_page - 1)}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>

        <span className="px-2 text-sm text-muted-foreground">
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
