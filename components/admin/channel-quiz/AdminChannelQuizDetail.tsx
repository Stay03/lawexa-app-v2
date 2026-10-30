'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSessionDate } from '@/lib/utils/quiz-format';
import { useAdminChannelQuiz } from '@/lib/hooks/useAdminChannelQuizzes';
import type { AdminChannelQuizQuestionStat } from '@/types/admin-channel-quizzes';
import { AdminChannelQuizError } from './AdminChannelQuizStates';
import { quizSetting } from './AdminChannelQuizzesTable';
import { EXPLORE_BASE, percentLabel, playsForQuizHref } from './model';

/**
 * Its questions, hardest first: the lowest percent right first, then the
 * questions nobody has answered yet, in quiz order.
 */
export function hardestFirst(questions: readonly AdminChannelQuizQuestionStat[]): AdminChannelQuizQuestionStat[] {
  return questions
    .map((question, index) => ({ question, index }))
    .sort((a, b) => {
      const pa = a.question.percent_correct;
      const pb = b.question.percent_correct;
      if (pa === null && pb === null) return a.index - b.index;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pa - pb || a.index - b.index;
    })
    .map(({ question }) => question);
}

/** One new quiz: its numbers, a link to its plays, and each question's percent right. */
export function AdminChannelQuizDetail({ uuid }: { uuid: string }) {
  const query = useAdminChannelQuiz(uuid);

  if (query.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <AdminChannelQuizError error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const quiz = query.data.data;
  const setting = quizSetting(quiz);

  return (
    <div className="space-y-6">
      <BackLink />
      <Card>
        <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{quiz.title}</CardTitle>
              {quiz.deleted_at ? <Badge variant="destructive">Deleted</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="capitalize">{quiz.visibility}</span>
              {setting ? ` · ${setting}` : ''}
              {quiz.topic ? ` · ${quiz.topic}` : ''}
              {quiz.author ? ` · by ${quiz.author.name}` : ''}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link href={playsForQuizHref(quiz.uuid)}>See its plays</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Meta label="Plays" value={String(quiz.plays)} />
            <Meta label="Players" value={String(quiz.players)} />
            <Meta label="Finished" value={percentLabel(quiz.completion_rate)} />
            <Meta label="Avg score" value={percentLabel(quiz.average_score_percent)} />
            <Meta label="Questions" value={String(quiz.question_count)} />
            <Meta label="Last played" value={quiz.last_played_at ? formatSessionDate(quiz.last_played_at) : 'Never'} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Questions, hardest first</CardTitle>
        </CardHeader>
        <CardContent>
          {quiz.questions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">This quiz has no questions.</p>
          ) : (
            <ol className="divide-y">
              {hardestFirst(quiz.questions).map((question, index) => (
                <li key={`${question.position ?? 'x'}-${index}`} className="flex items-start gap-3 py-3">
                  <span className="w-6 shrink-0 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">
                    {question.position ?? '—'}.
                  </span>
                  <p className="min-w-0 flex-1 text-sm">{question.question ?? 'Question removed'}</p>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">{question.answers > 0 ? percentLabel(question.percent_correct) : '—'}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {question.answers > 0 ? `${question.correct} of ${question.answers} right` : 'Not answered yet'}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
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
    <Link href={`${EXPLORE_BASE}/quizzes`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      All quizzes
    </Link>
  );
}
