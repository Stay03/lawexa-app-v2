import { cn } from '@/lib/utils';
import { formatScorePercent } from '@/lib/utils/quiz-format';

/**
 * ScoreChip — the live score pill on the play header: "3/7 · 43%".
 *
 * ── IT OWNS THE PLAYER'S ONE LIVE REGION ────────────────────────────────────
 * Answers are hidden until results, so the ONLY feedback a submit produces is
 * this counter moving. Sighted players see it change; without a live region a
 * screen-reader player would hear nothing at all and could not tell a recorded
 * answer from a dropped one.
 *
 * So `announce` turns on a single `role="status" aria-live="polite"` region
 * INSIDE this component, carrying a full sentence ("Answer recorded. 3 of 7
 * correct, 43 percent.") rather than the visible pill's telegraphic text — a
 * screen reader reading "3 slash 7 · 43%" aloud is not feedback.
 *
 * ── `announce` AND `submitted` ARE TWO DIFFERENT JOBS ───────────────────────
 * `announce` MOUNTS the region; `submitted` decides whether it has anything to
 * say. They are separate because a live region only announces changes that
 * happen while it is already in the DOM — mounting one with text in it is
 * unreliable across screen readers. So the region is present from the first
 * frame with EMPTY text, and the sentence appears when an answer is actually
 * recorded, which is the change that gets announced.
 *
 * That split also fixes a real lie: resuming a session with prior answers would
 * otherwise greet the reader with "Answer recorded" for an answer they gave
 * yesterday. `submitted` is the player's `submitAnswer.isSuccess`, so it is
 * false until a submit succeeds IN THIS MOUNT.
 *
 * ONE region, not two: the pending beat is announced by `aria-busy` on the
 * option group (the correct ARIA mechanism for "this region is updating"), not
 * by a second live region competing with this one — standards §8 allows exactly
 * one announcement channel per surface.
 *
 * The visible pill is `aria-hidden` for the same reason: without it a screen
 * reader would read both the sentence and the raw pill on every change.
 */
export function ScoreChip({
  correct,
  answered,
  scorePercentage,
  announce = false,
  submitted = false,
  className,
}: {
  correct: number;
  answered: number;
  scorePercentage: string | null;
  /** Mount the live region. Exactly one chip per surface may. */
  announce?: boolean;
  /** An answer has been recorded in THIS mount — see the docblock. */
  submitted?: boolean;
  className?: string;
}) {
  const hasAnswers = answered > 0;
  const percent = formatScorePercent(scorePercentage);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs tabular-nums',
        className,
      )}
    >
      {/* Mounted from the first frame, EMPTY until an answer is recorded — a
          live region only reliably announces changes it is present for. */}
      {announce ? (
        <span role="status" aria-live="polite" className="sr-only">
          {submitted && hasAnswers
            ? `Answer recorded. ${correct} of ${answered} correct, ${percent.replace('%', ' percent')}.`
            : ''}
        </span>
      ) : null}

      {hasAnswers ? (
        <span aria-hidden className="flex items-center gap-1.5">
          <span className="text-muted-foreground">
            {correct}/{answered}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-semibold text-foreground">{percent}</span>
        </span>
      ) : (
        <span aria-hidden className="text-muted-foreground">
          No answers yet
        </span>
      )}
    </span>
  );
}
