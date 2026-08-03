'use client';

import type { QuizDifficulty, QuizSession } from '@/types/quiz';
import { DifficultyBadge } from '../ui/DifficultyBadge';
import { ScoreChip } from '../ui/ScoreChip';
import { EndSessionDialog } from './EndSessionDialog';

/**
 * ProgressHeader — the play surface's own sticky bar: where you are, how you
 * are doing, and the way out.
 *
 * STICKY, NOT FIXED. It pins inside the shell's ONE scroll container
 * (`.v2-shell__content`), which is the mobile shell contract — a `position:
 * fixed` bar would fight the keyboard-inset height the shell already tracks.
 *
 * `ScoreChip` carries the surface's single live region (see that component):
 * with answers hidden until results, the counter moving IS the only feedback a
 * submit produces, so it has to be announced.
 *
 * There is NO TIMER, deliberately. Think-time is measured server-side and
 * reported in the results (`time_spent_ms` per question); a client countdown
 * would be a second, disagreeing clock — and a visible one would turn a
 * practice tool into a test.
 */
export function ProgressHeader({
  sequence,
  difficulty,
  difficultyLabel,
  session,
  endOpen,
  onEndOpenChange,
  onEnd,
  ending,
  endDisabled = false,
  announceScore = false,
}: {
  sequence: number;
  difficulty: QuizDifficulty;
  difficultyLabel: string;
  session: QuizSession;
  endOpen: boolean;
  onEndOpenChange: (open: boolean) => void;
  onEnd: () => void;
  ending: boolean;
  /** Block End while an answer is in flight — see `PlayerScreen`. */
  endDisabled?: boolean;
  /** Put the score sentence in the live region (only after a real submit). */
  announceScore?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          Question {sequence}
        </span>
        <DifficultyBadge
          difficulty={difficulty}
          label={difficultyLabel}
          className="hidden sm:inline-flex"
        />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ScoreChip
          correct={session.correct_count}
          answered={session.answered_count}
          scorePercentage={session.score_percentage}
          announce
          submitted={announceScore}
        />
        <EndSessionDialog
          open={endOpen}
          onOpenChange={onEndOpenChange}
          onConfirm={onEnd}
          ending={ending}
          disabled={endDisabled}
          answeredCount={session.answered_count}
        />
      </div>
    </div>
  );
}
