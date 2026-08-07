'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PUBLIC_QUIZ_RESULTS_NOTICE,
  publicQuizResultsPath,
  quizShareInvite,
  type QuizShareStanding,
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
 * ── THE CARD HAS ONE JOB (owner review, 2026-08-07) ────────────────────────
 * It used to lead with the privacy notice, which described the link accurately
 * and asked for nothing. A card whose only job is to be shared has to ask. So
 * the headline now names the stake — the winner is told they are the target,
 * a player who lost is pointed at whoever beat them — and the notice moved
 * underneath, still said, no longer the pitch. The copy is a pure function of
 * where the reader finished ({@link quizShareInvite}); this file only decides
 * how it is laid out.
 *
 * ── SHARING MEANS THE DEVICE'S OWN SHEET, WHEN THERE IS ONE ────────────────
 * On a phone the native thing is `navigator.share` — the OS sheet with WhatsApp
 * and the class group already in it — and that is exactly the audience for a
 * study-group challenge. It is tried FIRST and falls back to the clipboard, so
 * desktop is unchanged. Capability is read at CLICK time, never in render: a
 * label that depended on it would differ between the server frame and the
 * hydration frame.
 *
 * A dismissed share sheet is NOT a failure and must not fall through to the
 * clipboard — copying a link somebody just declined to send is a small lie
 * about what happened. `AbortError` therefore returns silently and leaves the
 * card exactly as it was.
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

export function ShareResults({
  gameUuid,
  standing,
  quizTitle,
}: {
  gameUuid: string;
  /** Where the reader finished — decides which two lines the card says. */
  standing: QuizShareStanding;
  /** Titles the OS share sheet, so the receiving chat shows what this is. */
  quizTitle: string;
}) {
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
  const { headline, ask } = quizShareInvite(standing);

  const confirmCopied = () => {
    setState('copied');
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setState('idle'), COPIED_MS);
  };

  const share = async () => {
    // The device's own sheet first. Read here, not in render — see the docblock.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: quizTitle, text: headline, url });
        return;
      } catch (error) {
        // Dismissing the sheet is a decision, not a fault. Leave the card alone.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Anything else (no permission, no transport) falls through to the copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      confirmCopied();
    } catch {
      // Not a failure to report — a link to hand over instead.
      setState('unavailable');
    }
  };

  const copied = state === 'copied';

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-semibold text-pretty text-foreground">
            {headline}
          </p>
          <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
            {ask}
          </p>
        </div>
        <Button size="sm" onClick={() => void share()}>
          {copied ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Share2 aria-hidden className="size-4" />
          )}
          {copied ? 'Link copied' : 'Share'}
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
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
