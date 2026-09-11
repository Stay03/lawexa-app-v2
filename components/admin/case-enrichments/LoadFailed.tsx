'use client';

import { Button } from '@/components/ui/button';

interface LoadFailedProps {
  /** What did not load, as a sentence. */
  message: string;
  onRetry: () => void;
  /** True while the request runs again. */
  retrying: boolean;
}

/**
 * Stands in for a part of the enrichments page whose request failed with
 * nothing to show. Without it a failed summary stays a skeleton, and a failed
 * list reads as an empty one: on the stopped list, "No stopped cases".
 */
export function LoadFailed({ message, onRetry, retrying }: LoadFailedProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border py-12 text-center text-sm text-muted-foreground">
      <p role="alert">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        Try again
      </Button>
    </div>
  );
}
