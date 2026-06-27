'use client';

import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizResultItem } from '@/types/quiz';

interface QuizResultItemCardProps {
  item: QuizResultItem;
  index: number;
}

/** One answered question in the results review: options graded, explanation shown. */
export function QuizResultItemCard({ item, index }: QuizResultItemCardProps) {
  const { question } = item;

  if (!question) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{index + 1}.</span>{' '}
        [removed question] — this question is no longer available.
      </div>
    );
  }

  const options = [...question.options].sort((a, b) => a.position - b.position);

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium leading-relaxed text-foreground">
          <span className="text-muted-foreground">{index + 1}.</span>{' '}
          {question.question_text}
        </h3>
        <span
          className={cn(
            'mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium',
            item.was_correct
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          {item.was_correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {item.was_correct ? 'Correct' : 'Incorrect'}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {options.map((option) => {
          const isCorrect = option.is_correct;
          const isWrongChoice = option.id === item.selected_option_id && !isCorrect;
          return (
            <div
              key={option.id}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm',
                isCorrect && 'border-emerald-500/30 bg-emerald-500/5',
                isWrongChoice && 'border-destructive/30 bg-destructive/5',
                !isCorrect && !isWrongChoice && 'border-transparent bg-muted/40'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                  isCorrect && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                  isWrongChoice && 'bg-destructive/15 text-destructive',
                  !isCorrect && !isWrongChoice && 'text-transparent'
                )}
              >
                {isCorrect ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isWrongChoice ? (
                  <X className="h-3.5 w-3.5" />
                ) : null}
              </span>
              <span
                className={cn(
                  'flex-1',
                  isCorrect || isWrongChoice ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {option.option_text}
              </span>
              {isCorrect && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  Correct answer
                </span>
              )}
              {isWrongChoice && (
                <span className="text-xs text-destructive">Your answer</span>
              )}
            </div>
          );
        })}
      </div>

      {question.explanation && (
        <div className="mt-4 flex gap-2.5 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">{question.explanation}</p>
        </div>
      )}

      {item.edited_since_answered && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          This question was updated after you answered it.
        </p>
      )}
    </div>
  );
}
