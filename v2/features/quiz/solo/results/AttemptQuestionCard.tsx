import { useMemo } from 'react';
import { Check, Clock, Minus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { QuizAttemptQuestion } from '@/types/channel-quiz';
import { formatResponseTime } from '@/v2/features/channels/quiz/model';
import { pointsLabel, questionVerdict, type QuestionVerdict } from '../model';

/**
 * AttemptQuestionCard — one question of a finished attempt, revealed: every
 * option graded, the verdict, the points it earned and how long it took.
 *
 * The practice review's card (`ResultItemCard`), in the attempt's shape: the
 * grade is the SERVER's (`is_correct`, `correct_option_id`), the time is the
 * clamped `response_ms` the server stored, and a question never answered is
 * its own verdict rather than a red "Incorrect" — the reader skipped it, the
 * score counts it as wrong, and the card says both.
 *
 * CORRECT / INCORRECT IS NEVER COLOUR-ALONE: the verdict chip carries an icon
 * AND the word, and each graded option is labelled ("Correct answer" / "Your
 * answer") rather than relying on its tint.
 */
export function AttemptQuestionCard({
  question,
  index,
}: {
  question: QuizAttemptQuestion;
  /** 0-based position in the quiz, shown 1-based. */
  index: number;
}) {
  const verdict = questionVerdict(question);
  // The server serves `position`; never trust array order for a lettered list.
  const options = useMemo(
    () => [...question.options].sort((a, b) => a.position - b.position),
    [question.options],
  );
  const points = question.points ?? 0;
  const responseMs = question.response_ms ?? null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base leading-relaxed font-medium text-foreground">
          <span className="tabular-nums text-muted-foreground">{index + 1}.</span>{' '}
          {question.question}
        </h3>
        <VerdictBadge verdict={verdict} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs tabular-nums text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {points > 0 ? `+${pointsLabel(points)}` : '0'} pts
        </span>
        {verdict !== 'unanswered' && responseMs !== null && (
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden className="size-3" />
            {formatResponseTime(responseMs)}
            <span className="sr-only">to answer</span>
          </span>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {options.map((option) => {
          const isCorrect = option.id === question.correct_option_id;
          const isWrongChoice = option.id === question.your_option_id && !isCorrect;
          const graded = isCorrect || isWrongChoice;

          return (
            <li
              key={option.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm',
                isCorrect && 'border-emerald-500/30 bg-emerald-500/5',
                isWrongChoice && 'border-destructive/30 bg-destructive/5',
                !graded && 'border-transparent bg-secondary/40',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full',
                  isCorrect && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                  isWrongChoice && 'bg-destructive/15 text-destructive',
                  !graded && 'text-transparent',
                )}
              >
                {isCorrect ? (
                  <Check className="size-3.5" />
                ) : isWrongChoice ? (
                  <X className="size-3.5" />
                ) : null}
              </span>
              <span
                className={cn(
                  'flex-1',
                  graded ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {option.content}
              </span>
              {isCorrect ? (
                <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
                  {option.id === question.your_option_id ? 'Your answer' : 'Correct answer'}
                </span>
              ) : null}
              {isWrongChoice ? (
                <span className="shrink-0 text-xs text-destructive">Your answer</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The verdict chip — icon AND word, never colour alone. */
function VerdictBadge({ verdict }: { verdict: QuestionVerdict }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium',
        verdict === 'correct' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        verdict === 'incorrect' && 'bg-destructive/10 text-destructive',
        verdict === 'unanswered' && 'bg-secondary text-muted-foreground',
      )}
    >
      {verdict === 'correct' ? (
        <Check aria-hidden className="size-3.5" />
      ) : verdict === 'incorrect' ? (
        <X aria-hidden className="size-3.5" />
      ) : (
        <Minus aria-hidden className="size-3.5" />
      )}
      {verdict === 'correct' ? 'Correct' : verdict === 'incorrect' ? 'Incorrect' : 'Unanswered'}
    </span>
  );
}
