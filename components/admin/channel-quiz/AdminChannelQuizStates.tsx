'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';

/** A read that failed: what the server said, and Try again. */
export function AdminChannelQuizError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { message, status } = extractApiError(error);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-10 text-center text-sm">
      <p className="text-muted-foreground">{status === 404 ? 'Not found.' : message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** A filter set by a link (one quiz, one player), with a × that clears it. */
export function AdminChannelQuizFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-9 max-w-full items-center gap-1 rounded-md border bg-muted/40 pl-3 pr-1 text-sm">
      <span className="truncate">{label}</span>
      <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Clear: ${label}`} onClick={onClear}>
        <X className="size-4" />
      </Button>
    </span>
  );
}
