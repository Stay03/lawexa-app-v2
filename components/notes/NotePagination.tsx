'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotePaginationProps {
  currentPage: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Pagination controls with page indicator
 */
function NotePagination({
  currentPage,
  lastPage,
  total,
  onPageChange,
  className,
}: NotePaginationProps) {
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < lastPage;

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-border pt-4',
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? 'note' : 'notes'} found
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>

        <span className="px-2 text-sm text-muted-foreground">
          Page {currentPage} of {lastPage}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export { NotePagination };
