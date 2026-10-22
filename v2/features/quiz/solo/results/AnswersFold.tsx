'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { QuizAttemptQuestion } from '@/types/channel-quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { reviewSubtitle, toReviewCount } from '../model';
import { AttemptQuestionCard } from './AttemptQuestionCard';

/**
 * AnswersFold — "See your answers": one raised row that opens the review of
 * every question in place, closed on arrival. The points are the story; the
 * review is there for the reader who wants it, and the row's second line
 * ("6 questions, 1 to look at again") says whether they do.
 *
 * The cards inside are the existing per-question review
 * (`AttemptQuestionCard`), unchanged; the fold animates through the house
 * `v2-collapse` (never `defaultOpen`, so the first paint is still).
 */
export function AnswersFold({ questions }: { questions: readonly QuizAttemptQuestion[] }) {
  const [open, setOpen] = useState(false);
  const subtitle = reviewSubtitle(questions.length, toReviewCount(questions));

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-11">
      <CollapsibleTrigger
        className={cn(
          'v2-interactive flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card px-4 py-4 text-left transition-colors hover:bg-secondary/60',
          FOCUS_RING,
        )}
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold text-foreground">See your answers</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronRight
          aria-hidden
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="v2-collapse">
        <ol className="flex flex-col gap-4 pt-4">
          {questions.map((question, index) => (
            <li key={question.uuid}>
              <AttemptQuestionCard question={question} index={index} />
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
