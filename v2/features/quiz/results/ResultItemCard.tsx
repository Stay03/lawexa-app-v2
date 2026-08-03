import { AlertTriangle, Check, Clock, Info, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatDurationMs } from '@/lib/utils/quiz-format';
import type { QuizResultItem } from '@/types/quiz';
import { DifficultyBadge } from '../ui/DifficultyBadge';

/**
 * ResultItemCard — one answered question, revealed: every option graded, the
 * explanation, and the two footnotes the backend can attach.
 *
 * ── WHAT IS DIFFERENT FROM v1 ───────────────────────────────────────────────
 *  • THE TOPIC IS RENDERED. The results payload carries `topic` / `topic_key`
 *    per question (verified live, 2026-08-03) and v1 dropped both on the floor.
 *    It is the single most useful label on this card — "I keep missing Law of
 *    Torts" is the insight a review is for — so it leads the meta row. It stays
 *    OPTIONAL in the type and is simply omitted when absent; nothing here
 *    assumes it exists.
 *  • CORRECT / INCORRECT IS NEVER COLOUR-ALONE. The verdict chip carries an
 *    icon AND the word, and each graded option is labelled ("Correct answer" /
 *    "Your answer") rather than relying on its tint.
 *  • THE REMOVED-QUESTION CASE IS A DESIGNED STATE. A question deleted from the
 *    bank after it was answered arrives as `question: null`. The grade still
 *    stands — it was earned — so the card keeps the verdict and says plainly
 *    that the question itself is gone, instead of rendering an empty shell.
 */
export function ResultItemCard({
  item,
  index,
}: {
  item: QuizResultItem;
  /** 0-based position in the session, shown 1-based. */
  index: number;
}) {
  const { question } = item;
  const number = index + 1;

  if (!question) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{number}.</span> This
            question was removed from the bank after you answered it, so it
            can&apos;t be shown.
          </p>
          <Verdict correct={item.was_correct} />
        </div>
      </div>
    );
  }

  const options = [...question.options].sort((a, b) => a.position - b.position);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium leading-relaxed text-foreground">
          <span className="tabular-nums text-muted-foreground">{number}.</span>{' '}
          {question.question_text}
        </h3>
        <Verdict correct={item.was_correct} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {question.topic ? (
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {question.topic}
          </span>
        ) : null}
        <DifficultyBadge
          difficulty={question.difficulty}
          label={question.difficulty_label}
        />
        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <Clock aria-hidden className="size-3" />
          {formatDurationMs(item.time_spent_ms)}
          <span className="sr-only">spent on this question</span>
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {options.map((option) => {
          const isCorrect = option.is_correct;
          const isWrongChoice =
            option.id === item.selected_option_id && !isCorrect;
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
                  isCorrect &&
                    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
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
                  graded
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {option.option_text}
              </span>
              {isCorrect ? (
                <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
                  Correct answer
                </span>
              ) : null}
              {isWrongChoice ? (
                <span className="shrink-0 text-xs text-destructive">
                  Your answer
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {question.explanation ? (
        <div className="mt-4 flex gap-2.5 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">{question.explanation}</p>
        </div>
      ) : null}

      {item.edited_since_answered ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
          This question was edited after you answered it, so the wording may have
          changed. Your grade stands.
        </p>
      ) : null}
    </div>
  );
}

/** The verdict chip — icon AND word, never colour alone. */
function Verdict({ correct }: { correct: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium',
        correct
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {correct ? (
        <Check aria-hidden className="size-3.5" />
      ) : (
        <X aria-hidden className="size-3.5" />
      )}
      {correct ? 'Correct' : 'Incorrect'}
    </span>
  );
}
