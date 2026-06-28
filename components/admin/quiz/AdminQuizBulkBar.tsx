'use client';

import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminQuizBulkBarProps {
  count: number;
  pending: boolean;
  onApprove: () => void;
  onArchive: () => void;
  onClear: () => void;
}

/** Floating action bar shown while questions are selected. */
export function AdminQuizBulkBar({
  count,
  pending,
  onApprove,
  onArchive,
  onClear,
}: AdminQuizBulkBarProps) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      <div className="h-4 w-px bg-border" />
      <Button size="sm" variant="outline" onClick={onApprove} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={onArchive} disabled={pending}>
        Archive
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
