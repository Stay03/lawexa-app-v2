'use client';

import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';

import { cn } from '@/lib/utils';
import type { QuizLeaderboardEntry } from '@/types/channel-quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { Podium } from '../board/FrontBoard';
import { Confetti } from './Confetti';

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

/** The layer fades out over the results this long (Arthur: "clean and smooth"). */
export const PODIUM_FADE_MS = 350;

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
 * Skip, or Escape, ends it at once; however it ends, it fades out over the
 * results in 350ms (Arthur: "the movement from podium to score must be
 * clean and smooth"), and the results, laid out underneath all along, do
 * not move. It covers the whole screen, the results
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
  /** Fading out over the results: however it ends (by itself, Skip, Escape), the same way. */
  const [leaving, setLeaving] = useState(false);
  const leave = useCallback(() => setLeaving(true), []);
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
    const timer = window.setTimeout(onDone, PODIUM_FADE_MS);
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
        // Opacity alone, so nothing under it moves; the confetti fades with it.
        'transition-opacity duration-[350ms] ease-out',
        leaving && 'pointer-events-none opacity-0',
      )}
    >
      <button
        ref={skipRef}
        type="button"
        onClick={leave}
        className={cn(
          'absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground',
          FOCUS_RING,
        )}
      >
        Skip
      </button>

      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <h1
          id="podium-stage-heading"
          className={cn(
            'text-center font-comfortaa text-[28px] leading-tight font-bold text-balance text-primary',
            playing && 'v2-solo-podium-headline',
          )}
        >
          You made the Podium!
        </h1>
        <div ref={podiumRef} className={cn('w-full', !playing && 'v2-solo-podium-still')} onAnimationEnd={onAnimationEnd}>
          <Podium entries={entries} isYou={isYou} rising={playing} />
        </div>
      </div>

      {typeof confetti === 'object' ? <Confetti origin={confetti} onDone={confettiFallen} /> : null}
    </div>
  );
}
