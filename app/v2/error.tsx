'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { claimChunkReload, isChunkLoadError, type StampStorage } from '@/v2/runtime/chunk-reload';

/** How long a reload waits for `beforeReload` (a crash report) at most. */
const BEFORE_RELOAD_MAX_MS = 1500;

/**
 * Route-level error boundary. Establishes the every-route-has-boundaries
 * convention for the v2 tree; wire `error` to real reporting in a later phase.
 *
 * A CHUNK THAT IS GONE RELOADS THE PAGE ONCE (the techlead, 30 October 2026):
 * a tab opened before a deploy asks for the old build's chunks, and "Try
 * again" only asks for the same missing chunk. The page reloads once per path
 * per minute (`chunk-reload.ts`); within the minute, or with no storage, this
 * screen shows as before. `beforeReload` (the chat screen's crash report) is
 * awaited first, for at most 1.5 s, so the reload does not cancel it.
 */
export default function V2Error({
  error,
  reset,
  beforeReload,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  beforeReload?: () => Promise<unknown>;
}) {
  useEffect(() => {
    console.error(error);
    if (!isChunkLoadError(error) || !claimChunkReload(sessionStore(), window.location.pathname, Date.now())) return;
    const waitAtMost = new Promise((resolve) => window.setTimeout(resolve, BEFORE_RELOAD_MAX_MS));
    void Promise.race([beforeReload?.() ?? Promise.resolve(), waitAtMost])
      .catch(() => undefined)
      .then(() => window.location.reload());
  }, [error, beforeReload]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        Something went wrong on this page.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}

/** The tab's sessionStorage, or `null` where reading it throws. */
function sessionStore(): StampStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
