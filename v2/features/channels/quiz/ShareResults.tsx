'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PUBLIC_QUIZ_RESULTS_NOTICE,
  publicQuizResultsPath,
} from '@/lib/constants/quiz-share';

/**
 * ShareResults — the way a finished game's podium leaves the room.
 *
 * A game is played in a channel and its full results stay there (the ranking,
 * the per-question stats, who joined late). What travels is a much smaller
 * thing: a public card carrying the top three and their scores, served by
 * `app/quiz-results/{game}` to anyone at all — see `lib/constants/quiz-share.ts`
 * for why that page sits outside the v2 tree.
 *
 * ── THE SENTENCE IS NOT DECORATION ─────────────────────────────────────────
 * The uuid is the only key. There is no second check on that page, so pasting
 * the link into a group chat is the whole of the permission model, and the
 * reader is told that BEFORE they paste rather than after. It is said once,
 * quietly, in the same block as the button — not in a dialog they would dismiss
 * and not in a tooltip they would never open.
 *
 * ── FAILURE IS INLINE, LIKE EVERYTHING ELSE IN THIS FEATURE ────────────────
 * No toast (the house rule for the channel surfaces, and this is a finished
 * game's screen inside a channel). `navigator.clipboard` is refused often
 * enough to design for — an insecure origin, a permissions policy, a browser
 * that wants a user gesture it did not see — and the honest answer to that is
 * not an apology: it is the link itself, selectable, exactly where the button
 * was. So the failed path REVEALS the URL rather than reporting a failure.
 *
 * ── ONE COPY, ONE TIMER, CLEANED UP ────────────────────────────────────────
 * The confirmed state lasts two seconds and its timeout is cleared on unmount
 * (leaving a game mid-timer is ordinary here). The origin is read through a
 * lazy `useState` initialiser, never in render, so the server frame and the
 * hydration frame agree and no clock or `window` read happens during a render
 * pass.
 */

const COPIED_MS = 2000;

type CopyState = 'idle' | 'copied' | 'unavailable';

export function ShareResults({ gameUuid }: { gameUuid: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const timerRef = useRef<number | null>(null);
  // Client-only, behind a lazy initialiser: this component only ever renders
  // inside an already-mounted game overlay, so the empty server value is never
  // painted — and reading `window` in render would be a compiler-lint error.
  const [origin] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.origin,
  );

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const url = origin ? `${origin}${publicQuizResultsPath(gameUuid)}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setState('idle'), COPIED_MS);
    } catch {
      // Not a failure to report — a link to hand over instead.
      setState('unavailable');
    }
  };

  const copied = state === 'copied';

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-sm font-medium text-foreground">
          Share these scores
        </p>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Link2 aria-hidden className="size-4" />
          )}
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {PUBLIC_QUIZ_RESULTS_NOTICE}
      </p>

      {/* The button's label change is visual; this is the same fact for a
          reader who cannot see it. Polite, and empty the rest of the time. */}
      <p role="status" aria-live="polite" className="sr-only">
        {copied ? 'Link copied to the clipboard' : ''}
      </p>

      {state === 'unavailable' && (
        <div className="mt-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <label
            htmlFor={`quiz-share-${gameUuid}`}
            className="text-xs text-muted-foreground"
          >
            Your browser wouldn&rsquo;t let us reach the clipboard — copy it
            from here.
          </label>
          <Input
            id={`quiz-share-${gameUuid}`}
            readOnly
            value={url}
            className="mt-1 text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
