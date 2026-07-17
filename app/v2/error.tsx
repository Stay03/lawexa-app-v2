'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary. Establishes the every-route-has-boundaries
 * convention for the v2 tree; wire `error` to real reporting in a later phase.
 */
export default function V2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        Something went wrong in the v2 preview.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
