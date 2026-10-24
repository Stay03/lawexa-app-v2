'use client';

import Link from 'next/link';
import { AlertCircle, Loader2, Pencil, Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ToolMessage } from '@/types/chat';
import { quizFrontHref } from '@/v2/features/quiz/solo/model';
import { QuizTile } from '@/v2/features/quiz/solo/QuizTile';
import { statusOf } from '@/v2/runtime/persist/policy';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  createdQuiz,
  createdQuizLine,
  isCreateQuizStep,
  quizCardSteps,
  quizJobState,
  type CreatedQuiz,
  type QuizJobRef,
} from '../tools/created-quiz';
import { useQuizJob } from '../tools/use-quiz-job';
import { useToolResult, useToolResults } from '../tools/use-tool-result';

/**
 * The quiz cards under one answer's step chain: one per `create_quiz` step,
 * less a refusal that a later step made good (`quizCardSteps`). The rule reads
 * every quiz step's result, loaded first in a reopened chat, through the same
 * cache entries each card reads, so nothing is fetched twice.
 */
export function CreatedQuizCards({ steps }: { steps: ToolMessage[] }) {
  const quizSteps = steps.filter(isCreateQuizStep);
  const loaded = useToolResults(quizSteps);
  return quizCardSteps(loaded).map((step) => <CreatedQuizCard key={step.id} message={step} />);
}

/**
 * CreatedQuizCard — the quiz Lawexa made from a document or a Library item,
 * under the answer that made it (quiz from a source, door 1; Stay, 23 October
 * 2026). It sits after the step chain, not inside a step, so the reader sees
 * it without opening anything: "Making your quiz…" while the tool runs or the
 * server is still writing it, then the quiz with Open and Edit, or the
 * server's own sentence when it could not be made (too short, unreadable, no
 * access, one at a time, or failed).
 *
 * A chat loaded with lazy results carries no result data until it is asked
 * for, so the card asks (`useToolResult`), the same read a step uses. A step
 * that left a job (`data.quiz_job`, the 30 s fix) asks the job until it is
 * done (`QuizJobCard`), in a chat still open or reopened later.
 *
 * The quiz is saved as "Only you" in My quizzes the moment it is made, so Open
 * is its own page and Edit opens it in the form there (`?edit=1`).
 */
export function CreatedQuizCard({ message }: { message: ToolMessage }) {
  const loaded = useToolResult(message, message.toolStatus === 'complete');
  const state = createdQuiz(loaded.message);

  if (loaded.status === 'loading' || state === null) {
    return message.toolStatus === 'complete' && loaded.status !== 'error' ? (
      <div aria-hidden className="my-2 flex items-center gap-3 rounded-2xl border border-border/60 p-3">
        <Skeleton className="size-11 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      </div>
    ) : null;
  }

  if (state.kind === 'job') return <QuizJobCard job={state.job} />;
  return <QuizCardFace state={state} />;
}

/** A quiz the server is still making: asked about every few seconds, then drawn as made or failed. */
function QuizJobCard({ job }: { job: QuizJobRef }) {
  const query = useQuizJob(job.uuid);
  const state: CreatedQuiz =
    statusOf(query.error) === 404
      ? { kind: 'failed', message: 'This quiz is no longer available.' }
      : quizJobState(query.data, job);
  return <QuizCardFace state={state} job={job} />;
}

/** One face of the card: making, failed, or the made quiz with Open and Edit. */
function QuizCardFace({ state, job }: { state: CreatedQuiz; job?: QuizJobRef }) {
  if (state.kind === 'making' || state.kind === 'job') {
    return (
      <div role="status" className="my-2 flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3 text-sm text-muted-foreground">
        <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" />
        <span>
          Making your quiz…
          {job ? <span className="block text-xs">{makingLine(job)}</span> : null}
        </span>
      </div>
    );
  }

  if (state.kind === 'failed') {
    return (
      <div role="alert" className="my-2 flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3 text-sm text-muted-foreground">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-2xl border-2 border-border bg-card p-3.5 shadow-[0_4px_0_var(--border)] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex min-w-0 items-start gap-3">
        <QuizTile uuid={state.uuid} title={state.title} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Quiz made · in My quizzes, only you can take it</p>
          <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug font-semibold text-foreground">{state.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{createdQuizLine(state)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={quizFrontHref(state.uuid)}
          className={cn(
            'v2-interactive inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground',
            FOCUS_RING,
          )}
        >
          <Play aria-hidden className="size-3.5" />
          Open
        </Link>
        <Link
          href={`${quizFrontHref(state.uuid)}?edit=1`}
          className={cn(
            'v2-interactive inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary',
            FOCUS_RING,
          )}
        >
          <Pencil aria-hidden className="size-3.5" />
          Edit
        </Link>
      </div>
    </div>
  );
}

/** "10 questions from Labour Act, 1974, Part II · this can take up to two minutes". */
function makingLine(job: QuizJobRef): string {
  const what = job.questionCount > 0 ? `${job.questionCount} ${job.questionCount === 1 ? 'question' : 'questions'}` : 'A quiz';
  const from = job.source ? ` from ${job.source}` : '';
  return `${what}${from} · this can take up to two minutes`;
}
