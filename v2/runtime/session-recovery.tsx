'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/v2/shell/Logo';
import { RECOVERY_ATTEMPTS, backoffDelay } from './session-resolve';

/**
 * V2Unreachable — what the v2 layout draws when it could not ask the API who
 * the reader is (session-resolve.ts: a 5xx, a refused connection or a timeout,
 * twice). The reader may well be signed in, so nothing here says otherwise and
 * nothing touches their session: no guest shell, no sign-in wall.
 *
 * It asks again on its own: `router.refresh()` re-runs the layout's session
 * read after 2, 4, 8, 16 and 30 s (six tries), and "Try again" asks at once.
 * The first answer that names the reader renders the shell in place of this
 * panel, which unmounts it and clears its timer, so nothing can loop. A long
 * outage stops after the sixth try and leaves the button.
 *
 * The timer chain lives in a closure inside one effect: no state, so no
 * setState in an effect, and no ref written in render (React Compiler rules).
 */
export function V2Unreachable() {
  const router = useRouter();

  useEffect(() => {
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      if (attempt >= RECOVERY_ATTEMPTS) return;
      timer = setTimeout(() => {
        attempt += 1;
        router.refresh();
        next();
      }, backoffDelay(attempt));
    };
    next();
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main
      role="alert"
      aria-live="polite"
      className="v2-safe-top flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <LogoMark className="size-12" />
      <h1 className="text-lg font-semibold text-balance">Can&apos;t reach Lawexa</h1>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Lawexa&apos;s server did not answer. This page tries again on its own.
      </p>
      <Button variant="outline" onClick={() => router.refresh()}>
        Try again
      </Button>
    </main>
  );
}
