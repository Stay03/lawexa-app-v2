'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The share page's error boundary — defence in depth for a link that travels.
 *
 * WHY A PUBLIC ROUTE NEEDS ITS OWN. `/quiz-results/[gameUuid]` is the one
 * surface in this app that is opened by people who have never seen it before,
 * from a message someone else pasted. Every refusal it can PREDICT is already a
 * designed state (`NoResultCard`: the four `404`s that mean "no finished game
 * here"), and the reader on the server proves every field the card touches
 * before it hands one over. This catches what is left — a render that throws for
 * a reason nobody anticipated — because without a boundary here the fallback is
 * Next's unstyled 500, and a stranger's first sight of Lawexa must never be a
 * framework stack frame.
 *
 * IT SPEAKS THE PAGE'S LANGUAGE, not the app's: the same centred column, the same
 * card, the same quiet way back to the front door. It says only what is certainly
 * true — this is our fault, not the link's — and offers the one thing that can
 * help, which is trying again.
 */
export default function PublicQuizResultsError({
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
    <main className="flex min-h-svh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <section className="rounded-3xl border bg-card p-8 text-center shadow-sm">
          <span
            aria-hidden
            className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
          >
            <AlertCircle className="size-6" />
          </span>
          <h1 className="mt-4 font-fraunces text-xl font-semibold text-foreground">
            This page didn&rsquo;t load
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Something went wrong on our side, not with the link you followed.
            Try it again in a moment.
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={reset}>
            Try again
          </Button>
        </section>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          <Link
            href="/"
            className="underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline motion-reduce:transition-none"
          >
            Played on Lawexa
          </Link>
        </p>
      </div>
    </main>
  );
}
