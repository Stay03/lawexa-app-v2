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

  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Showing {from || 0} - {to || 0} of {total} {itemLabel}
        </p>

        {perPage !== undefined && onPerPageChange && (
          <Select
            value={String(perPage)}
            onValueChange={(value) => onPerPageChange(parseInt(value))}
          >
            <SelectTrigger className="h-8 w-[100px]">
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
