'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatSessionDate } from '@/lib/utils/quiz-format';
import type { AdminChannelQuizAttempt } from '@/types/admin-channel-quizzes';
import {
  durationLabel,
  percentLabel,
  playHref,
  playStatusLabel,
  playsForPlayerHref,
  playsForQuizHref,
  rightOfScored,
} from './model';

interface AdminChannelQuizPlaysTableProps {
  plays: AdminChannelQuizAttempt[];
  isLoading: boolean;
  /** Show the player column (every play); hidden on one person's list, where the person is the page. */
  showPlayer?: boolean;
  /** What the empty list says. */
  emptyText?: string;
}

/**
 * Plays of the new quizzes, newest first: the old sessions table's look
 * (AdminQuizSessionsTable), with the quiz and the player as links that filter
 * the plays list to them (no name or email search in v1).
 */
export function AdminChannelQuizPlaysTable({
  plays,
  isLoading,
  showPlayer = true,
  emptyText = 'No plays match these filters.',
}: AdminChannelQuizPlaysTableProps) {
  if (isLoading) return <PlaysTableSkeleton />;

  if (plays.length === 0) {
    return <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quiz</TableHead>
            {showPlayer && <TableHead className="hidden sm:table-cell">Player</TableHead>}
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="hidden text-right md:table-cell">Points</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Started</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plays.map((play) => {
            const finished = play.finished_at !== null;
            return (
              <TableRow key={play.uuid}>
                <TableCell className="max-w-[16rem]">
                  <Link href={playHref(play.uuid)} className="line-clamp-2 font-medium hover:underline">
                    {play.quiz?.title ?? 'Quiz removed'}
                  </Link>
                  {play.quiz ? (
                    <Link
                      href={playsForQuizHref(play.quiz.uuid)}
                      className="mt-0.5 block text-xs text-muted-foreground hover:text-foreground"
                    >
                      All plays of this quiz
                    </Link>
                  ) : null}
                </TableCell>
                {showPlayer && (
                  <TableCell className="hidden text-sm sm:table-cell">
                    {play.player ? (
                      <Link href={playsForPlayerHref(play.player.uuid)} className="hover:underline">
                        {play.player.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right text-sm tabular-nums">
                  <span className="font-medium">{finished ? percentLabel(play.score_percent) : '—'}</span>
                  <span className="block text-xs text-muted-foreground">{rightOfScored(play.correct_count, play.scored_count)}</span>
                </TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground md:table-cell">{play.points ?? '—'}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={finished ? 'secondary' : 'outline'}>{playStatusLabel(play.finished_at)}</Badge>
                </TableCell>
                <TableCell className="hidden text-right text-sm text-muted-foreground lg:table-cell">
                  {formatSessionDate(play.started_at)}
                </TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground lg:table-cell">
                  {durationLabel(play.duration_seconds)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PlaysTableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
