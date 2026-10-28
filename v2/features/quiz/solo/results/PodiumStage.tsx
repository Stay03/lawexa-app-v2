'use client';

import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';

import { cn } from '@/lib/utils';
import type { QuizLeaderboardEntry } from '@/types/channel-quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { Podium } from '../board/FrontBoard';
import { Confetti } from './Confetti';
import { podiumFlight, podiumInView } from './position-model';

/** Where an attempt's podium is remembered as seen, so a reload or Back does not replay it. */
export function podiumSeenKey(attemptUuid: string): string {
  return `lawexa:quiz-podium-seen:${attemptUuid}`;
}

/** Whether this attempt's podium has been shown in this tab. Storage may be blocked: then never. */
export function podiumAlreadySeen(attemptUuid: string): boolean {
  try {
    return window.sessionStorage.getItem(podiumSeenKey(attemptUuid)) === '1';
  } catch {
    return false;
  }
}

export function rememberPodiumSeen(attemptUuid: string): void {
  try {
    window.sessionStorage.setItem(podiumSeenKey(attemptUuid), '1');
  } catch {
    // A blocked storage only means the podium may play again on a reload.
  }
}

/** When the steps have landed (the first place's grows from 400ms for 500ms) and the confetti bursts. */
const PODIUM_LANDS_MS = 900;

/** How long the podium stays after the last confetti has fallen, then the score (Arthur: "about 3 seconds"). */
export const PODIUM_HOLD_MS = 3000;

/** The podium moves down into the small one's place this long (Arthur: "the same podium to move down into its place"). */
export const PODIUM_SLIDE_MS = 550;


/**
 * PodiumStage — the podium first, full screen, over the results (Arthur, 28
 * October 2026: "on a phone the podium sits below the score, so players miss
 * it. Make the podium play first"). "You made the Podium!", the podium
 * rising with the reader's face climbing onto their step, and a burst of
 * confetti from its centre as the steps land (`Confetti`); about three
 * seconds after the last piece has fallen it moves on by itself to the
 * results it covers (Arthur's pick: no "See my score" button).
 *
 * The caller lays it over the results (which never move underneath) only
 * for a top-three finish with the reader's face on the podium
 * (`opensOnPodium`), never under reduced motion, and once per attempt.
 * Skip, or Escape, ends it at once; however it ends, the stage's ground
 * clears where it is while its own podium moves down into the small podium's
 * place on the results, a move and a scale in 550ms (Arthur: "the same
 * podium to move down into its place", after turning down a curtain that
 * showed a band and a second podium). The small podium stays hidden until
 * this one lands on it, so only one podium is ever seen; the results, laid
 * out underneath all along, never move. It covers the whole screen, the results
 * bar and the shell's bars too, and is a dialog with Skip focused; the
 * caller gives focus back to the results.
 */
export function PodiumStage({
  entries,
  isYou,
  onDone,
}: {
  entries: readonly QuizLeaderboardEntry[];
  isYou: (entry: QuizLeaderboardEntry) => boolean;
  onDone: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  /** Moving into the small podium's place: however it ends (by itself, Skip, Escape), the same way. */
  const [leaving, setLeaving] = useState(false);
  const [flight, setFlight] = useState<string | null>(null);
  const [headingFlight, setHeadingFlight] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const leave = useCallback(() => {
    setPlaying(false);
    const small = document.querySelector<HTMLElement>('[data-small-podium]');
    // On a phone the small podium is below the fold: bring its spot into view
    // first, while this stage still covers the results, so nobody sees it scroll.
    // On a computer it is already in view (its faded foot may sit under the
    // button bar), so nothing moves.
    if (small) {
      const box = small.getBoundingClientRect();
      const barTop = document.querySelector('[data-results-bar]')?.getBoundingClientRect().top ?? window.innerHeight;
      if (!podiumInView(box, barTop)) small.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    const from = podiumRef.current?.getBoundingClientRect();
    setFlight(from ? podiumFlight(from, small?.getBoundingClientRect() ?? null) : null);
    // The headline lands on the small one's headline the same way, so the words are never doubled.
    const heading = headingRef.current?.getBoundingClientRect();
    const smallHeading = document.querySelector('[data-small-podium-heading]')?.getBoundingClientRect() ?? null;
    setHeadingFlight(heading ? podiumFlight(heading, smallHeading) : null);
    setLeaving(true);
  }, []);
  const [confetti, setConfetti] = useState<'waiting' | { x: number; y: number } | 'fallen'>('waiting');
  const podiumRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName === 'v2-solo-podium-climb') setPlaying(false);
  };
  const confettiFallen = useCallback(() => setConfetti('fallen'), []);

  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, PODIUM_SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone]);

  // The burst, as the steps land; a Skip or Escape before then cancels it.
  useEffect(() => {
    if (leaving) return;
    const timer = window.setTimeout(() => {
      const box = podiumRef.current?.getBoundingClientRect();
      setConfetti(box ? { x: box.left + box.width / 2, y: box.top + box.height * 0.55 } : 'fallen');
    }, PODIUM_LANDS_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // Then the score, once the confetti has fallen and the podium has stood a moment.
  useEffect(() => {
    if (confetti !== 'fallen') return;
    const timer = window.setTimeout(leave, PODIUM_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [confetti, leave]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="podium-stage-heading"
      className={cn(
        'v2-solo fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-background px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        // The ground clears where it is (no band), so the results show through
        // around the podium as it moves down into its place.
        'transition-colors duration-[550ms] ease-out',
        leaving && 'pointer-events-none bg-transparent',
      )}
    >
      <button
        ref={skipRef}
        type="button"
        onClick={leave}
        className={cn(
          'absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-opacity duration-200 hover:text-foreground',
          FOCUS_RING,
          leaving && 'opacity-0',
        )}
      >
        Skip
      </button>

      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <h1
          ref={headingRef}
          id="podium-stage-heading"
          className={cn(
            'origin-top-left text-center font-comfortaa text-[28px] leading-tight font-bold text-balance text-primary',
            playing && 'v2-solo-podium-headline',
            // Nowhere to land: it fades with the ground instead.
            leaving && !headingFlight && 'opacity-0 transition-opacity duration-300',
          )}
          style={
            headingFlight
              ? { transform: headingFlight, transition: `transform ${PODIUM_SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` }
              : undefined
          }
        >
          You made the Podium!
        </h1>
        <div
          ref={podiumRef}
          className={cn(
            'w-full origin-top-left',
            !playing && 'v2-solo-podium-still',
            // No small podium to land on: it fades with the ground instead.
            leaving && !flight && 'opacity-0 transition-opacity duration-[550ms]',
          )}
          style={
            flight
              ? { transform: flight, transition: `transform ${PODIUM_SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` }
              : undefined
          }
          onAnimationEnd={onAnimationEnd}
        >
          <Podium entries={entries} isYou={isYou} rising={playing} />
        </div>
      </div>

      {typeof confetti === 'object' ? (
        <div className={cn('transition-opacity duration-300', leaving && 'opacity-0')}>
          <Confetti origin={confetti} onDone={confettiFallen} />
        </div>
      ) : null}
    </div>
  );
}
