'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { QuizAttemptQuestion } from '@/types/channel-quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { reviewSubtitle, toReviewCount } from '../model';
import { attemptAnswersHref } from './answers-model';

/**
 * AnswersFold — "See your answers": one raised row on the results that opens
 * the review on its own page, one question at a time (`AnswersStepper`; Stay,
 * 23 October 2026: "So if we have 20 questions all 20 will be in one page?
 * Why not one question per page"). The points are the story; the review is
 * there for the reader who wants it, and the row's second line ("6 questions,
 * 1 to look at again") says whether they do.
 */
export function AnswersFold({
  attemptUuid,
  questions,
}: {
  attemptUuid: string;
  questions: readonly QuizAttemptQuestion[];
}) {
  const subtitle = reviewSubtitle(questions.length, toReviewCount(questions));

  return (
    <Link
      href={attemptAnswersHref(attemptUuid)}
      className={cn(
        'v2-interactive mt-11 flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card px-4 py-4 text-left transition-colors hover:bg-secondary/60',
        FOCUS_RING,
      )}
    >
      <span className="min-w-0">
        <span className="block text-base font-semibold text-foreground">See your answers</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
