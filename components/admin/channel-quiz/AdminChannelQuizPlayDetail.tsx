'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CircleSlash, MinusCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSessionDate } from '@/lib/utils/quiz-format';
import { useAdminChannelQuizAttempt } from '@/lib/hooks/useAdminChannelQuizzes';
import { cn } from '@/lib/utils';
import type { AdminChannelQuizAttemptQuestion } from '@/types/admin-channel-quizzes';
import { AdminChannelQuizError } from './AdminChannelQuizStates';
import {
  ANSWER_OUTCOME_LABELS,
  EXPLORE_BASE,
  answerOutcome,
  durationLabel,
  percentLabel,
  playStatusLabel,
  playsForPlayerHref,
  quizHref,
  responseTimeLabel,
  rightOfScored,
  type AnswerOutcome,
} from './model';

const OUTCOME_ICON: Record<AnswerOutcome, typeof CheckCircle2> = {
  right: CheckCircle2,
  wrong: XCircle,
  unanswered: MinusCircle,
  removed: CircleSlash,
};
const OUTCOME_CLASS: Record<AnswerOutcome, string> = {
  right: 'text-emerald-600 dark:text-emerald-400',
  wrong: 'text-rose-600 dark:text-rose-400',
  unanswered: 'text-muted-foreground',
  removed: 'text-muted-foreground',
};

/** One play of a new quiz: its numbers, then each question with the answer given and the right one. */
export function AdminChannelQuizPlayDetail({ uuid }: { uuid: string }) {
  const query = useAdminChannelQuizAttempt(uuid);

  if (query.isPending) return <PlayDetailSkeleton />;
  if (query.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <AdminChannelQuizError error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const play = query.data.data;
  const finished = play.finished_at !== null;

  return (
    <div className="space-y-6">
      <BackLink />
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">
              {play.quiz ? (
                <Link href={quizHref(play.quiz.uuid)} className="hover:underline">
                  {play.quiz.title}
                </Link>
              ) : (
                'Quiz removed'
              )}
            </CardTitle>
            <Badge variant={finished ? 'secondary' : 'outline'}>{playStatusLabel(play.finished_at)}</Badge>
            {play.counts_for_board ? <Badge variant="outline">Counts for the board</Badge> : null}
          </div>
          {play.player ? (
            <p className="text-sm text-muted-foreground">
              Played by{' '}
              <Link href={playsForPlayerHref(play.player.uuid)} className="text-foreground hover:underline">
                {play.player.name}
              </Link>
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Meta label="Score" value={finished ? percentLabel(play.score_percent) : '—'} />
            <Meta label="Right" value={rightOfScored(play.correct_count, play.scored_count)} />
            <Meta label="Points" value={play.points === null ? '—' : String(play.points)} />
            <Meta label="Questions" value={String(play.question_count)} />
            <Meta label="Started" value={formatSessionDate(play.started_at)} />
            <Meta label="Duration" value={durationLabel(play.duration_seconds)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          {play.questions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No questions answered yet.</p>
          ) : (
            <ol className="divide-y">
              {play.questions.map((question, index) => (
                <QuestionRow key={index} number={question.position ?? index + 1} question={question} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionRow({ number, question }: { number: number; question: AdminChannelQuizAttemptQuestion }) {
  const outcome = answerOutcome(question);
  const Icon = OUTCOME_ICON[outcome];
  const showAnswers = outcome === 'right' || outcome === 'wrong';
  return (
    <li className="flex gap-3 py-4">
      <span className="w-6 shrink-0 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">{number}.</span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className={cn('text-sm', question.removed && 'italic text-muted-foreground')}>
          {question.removed ? 'This question was removed from the quiz.' : question.question}
        </p>
        {showAnswers ? (
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Answer given</dt>
              <dd>{question.chosen ?? '—'}</dd>
            </div>
            {outcome === 'wrong' ? (
              <div>
                <dt className="text-xs text-muted-foreground">Right answer</dt>
                <dd>{question.correct_answer ?? '—'}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span className={cn('inline-flex items-center gap-1 text-sm font-medium', OUTCOME_CLASS[outcome])}>
          <Icon aria-hidden className="size-4" />
          {ANSWER_OUTCOME_LABELS[outcome]}
        </span>
        {showAnswers ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {question.points ?? 0} pts · {responseTimeLabel(question.response_ms)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link href={EXPLORE_BASE} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      All plays
    </Link>
  );
}

function PlayDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
