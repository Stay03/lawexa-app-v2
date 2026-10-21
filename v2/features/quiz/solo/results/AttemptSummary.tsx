'use client';

import { Check, Clock, Loader2, Minus, RotateCcw, Trophy, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatSessionDate } from '@/lib/utils/quiz-format';
import type { QuizAttempt } from '@/types/channel-quiz';
import { SPEED_SCORING_NOTE } from '@/v2/features/channels/quiz/model';
import { ShareButton } from '@/v2/features/sharing/ShareButton';
import { ScoreRing } from '../../results/ScoreRing';
import { SummaryChip } from '../../results/SummaryChip';
import { pointsLabel, quizFrontHref, speedLabel, type AttemptScore } from '../model';

/**
 * AttemptSummary — the attempt's headline: the score ring, what it is made
 * of (right, wrong, skipped, points, speed), and the two things worth doing
 * next: take the quiz again, and pass it on.
 *
 * The practice review's headline card in the attempt's shape. The ring and
 * the chips are the shared ones (`results/ScoreRing`, `results/SummaryChip`),
 * so a reader who finishes both reads one card. Points and speed are the
 * SERVER's numbers as sent (`points`, `max_points`, `avg_response_ms`); the
 * scoring sentence under the card says how they came about.
 *
 * SHARE IS THE QUIZ'S LINK, NOT THE ATTEMPT'S: an attempt is one person's,
 * and what travels is the quiz for somebody else to take. The caller decides
 * whether a link can open it (the quiz's visibility) and withholds the button
 * otherwise, rather than handing out an address that answers 404.
 */
export function AttemptSummary({
  attempt,
  score,
  shareable,
  retaking,
  onRetake,
}: {
  attempt: QuizAttempt;
  score: AttemptScore;
  /** A link or public quiz — the only ones a shared link can open. */
  shareable: boolean;
  retaking: boolean;
  onRetake: () => void;
}) {
  const incorrect = Math.max(0, score.answered - score.correct);
  const unanswered = Math.max(0, score.total - score.answered);
  const speed = speedLabel(score.avgResponseMs);
  const date = attempt.finished_at ? formatSessionDate(attempt.finished_at) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 sm:p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:text-left">
        <ScoreRing
          percent={score.percent}
          empty={score.answered === 0}
          emptyLabel="No score — nothing was answered in this attempt"
        />

        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Quiz complete
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {attempt.quiz.title}
            {date ? ` · ${date}` : ''}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {score.answered === 0
              ? 'No questions were answered in this attempt.'
              : `${score.correct} of ${score.total} correct`}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
            {score.answered > 0 && (
              <>
                <SummaryChip icon={Check} tone="positive" label={`${score.correct} correct`} />
                <SummaryChip icon={X} tone="negative" label={`${incorrect} incorrect`} />
              </>
            )}
            {unanswered > 0 && (
              <SummaryChip icon={Minus} tone="quiet" label={`${unanswered} unanswered`} />
            )}
            <SummaryChip
              icon={Trophy}
              tone="quiet"
              label={`${pointsLabel(score.points)} of ${pointsLabel(score.maxPoints)} pts`}
            />
            {speed && <SummaryChip icon={Clock} tone="quiet" label={speed} />}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-col sm:items-stretch">
          <Button size="sm" className="flex-1" onClick={onRetake} disabled={retaking}>
            {retaking ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <RotateCcw aria-hidden className="size-4" />
            )}
            Take it again
          </Button>
          {shareable && (
            <ShareButton
              path={quizFrontHref(attempt.quiz.uuid)}
              title={attempt.quiz.title}
              label="Share this quiz"
            />
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground/80 sm:text-left">
        {SPEED_SCORING_NOTE}
      </p>
    </div>
  );
}
