'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatSessionDate } from '@/lib/utils/quiz-format';
import type { AdminChannelQuiz } from '@/types/admin-channel-quizzes';
import { percentLabel, quizHref } from './model';

/** The level and year a quiz is set at, e.g. "Bar Finals · 2024"; empty when it has neither. */
export function quizSetting(quiz: Pick<AdminChannelQuiz, 'level' | 'year'>): string {
  return [quiz.level, quiz.year].filter((part) => part !== null && part !== '').join(' · ');
}

/** Every new quiz with its play numbers, as the old tables look. */
export function AdminChannelQuizzesTable({ quizzes, isLoading }: { quizzes: AdminChannelQuiz[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2 rounded-xl border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (quizzes.length === 0) {
    return <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">No quizzes match these filters.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quiz</TableHead>
            <TableHead className="hidden md:table-cell">Author</TableHead>
            <TableHead className="text-right">Plays</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Players</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Finished</TableHead>
            <TableHead className="hidden text-right md:table-cell">Avg score</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Last played</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quizzes.map((quiz) => {
            const setting = quizSetting(quiz);
            return (
              <TableRow key={quiz.uuid}>
                <TableCell className="min-w-[12rem] max-w-[20rem] whitespace-normal">
                  <Link href={quizHref(quiz.uuid)} className="line-clamp-2 font-medium hover:underline">
                    {quiz.title}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="capitalize">{quiz.visibility}</span>
                    {setting ? <span>· {setting}</span> : null}
                    <span>· {quiz.question_count} questions</span>
                    {quiz.deleted_at ? <Badge variant="destructive">Deleted</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">{quiz.author?.name ?? '—'}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{quiz.plays}</TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground sm:table-cell">{quiz.players}</TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                  {percentLabel(quiz.completion_rate)}
                </TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground md:table-cell">
                  {percentLabel(quiz.average_score_percent)}
                </TableCell>
                <TableCell className="hidden text-right text-sm text-muted-foreground lg:table-cell">
                  {quiz.last_played_at ? formatSessionDate(quiz.last_played_at) : 'Never'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
