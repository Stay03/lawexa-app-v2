'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { QuizSessionStatusBadge } from '@/components/quiz/QuizSessionStatusBadge';
import {
  formatDurationMs,
  formatScorePercent,
  formatSessionDate,
  sessionDurationMs,
} from '@/lib/utils/quiz-format';
import type { AdminQuizSessionListItem } from '@/types/admin-quiz';

interface AdminQuizSessionsTableProps {
  sessions: AdminQuizSessionListItem[];
  isLoading: boolean;
  /** Show the owning user column (global list); hidden on a per-user list. */
  showUser?: boolean;
}

export function AdminQuizSessionsTable({
  sessions,
  isLoading,
  showUser = false,
}: AdminQuizSessionsTableProps) {
  if (isLoading) return <TableSkeleton />;

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        No sessions in this range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{showUser ? 'User' : 'Started'}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Answered</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Correct</TableHead>
            {showUser && (
              <TableHead className="hidden text-right md:table-cell">Started</TableHead>
            )}
            <TableHead className="hidden text-right lg:table-cell">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => {
            const duration = sessionDurationMs(s.started_at, s.completed_at);
            return (
              <TableRow key={s.uuid}>
                <TableCell>
                  <Link
                    href={`/admin/quiz/sessions/${s.uuid}`}
                    className="font-medium hover:underline"
                  >
                    {showUser
                      ? (s.user?.name ?? 'Session')
                      : formatSessionDate(s.started_at)}
                  </Link>
                </TableCell>
                <TableCell>
                  <QuizSessionStatusBadge status={s.status} />
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {s.score_percentage == null
                    ? '—'
                    : formatScorePercent(s.score_percentage)}
                </TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                  {s.answered_count}/{s.served_count}
                </TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                  {s.correct_count}
                </TableCell>
                {showUser && (
                  <TableCell className="hidden text-right text-sm text-muted-foreground md:table-cell">
                    {formatSessionDate(s.started_at)}
                  </TableCell>
                )}
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground lg:table-cell">
                  {duration == null ? '—' : formatDurationMs(duration)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
