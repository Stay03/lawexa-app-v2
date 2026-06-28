'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyBadge } from '@/components/quiz/DifficultyBadge';
import { AdminQuizStatusBadge } from './AdminQuizStatusBadge';
import { AdminQuizBulkBar } from './AdminQuizBulkBar';
import { AdminQuizActionDialog, type AdminQuizAction } from './AdminQuizActionDialog';
import { useBulkAdminQuizQuestions } from '@/lib/hooks/useAdminQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminQuizQuestionListItem } from '@/types/admin-quiz';

interface AdminQuizQuestionsTableProps {
  questions: AdminQuizQuestionListItem[];
  isLoading: boolean;
}

export function AdminQuizQuestionsTable({
  questions,
  isLoading,
}: AdminQuizQuestionsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<{
    action: AdminQuizAction;
    question: AdminQuizQuestionListItem;
  } | null>(null);
  const bulk = useBulkAdminQuizQuestions();

  const pageUuids = questions.map((q) => q.uuid);
  const allSelected =
    pageUuids.length > 0 && pageUuids.every((u) => selected.has(u));
  const someSelected = pageUuids.some((u) => selected.has(u));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageUuids.forEach((u) => next.delete(u));
      else pageUuids.forEach((u) => next.add(u));
      return next;
    });
  };

  const toggleOne = (uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const runBulk = (action: 'approve' | 'archive') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    bulk.mutate(
      { action, ids },
      {
        onSuccess: (res) => {
          toast.success(
            `${res.data.affected} question${res.data.affected === 1 ? '' : 's'} ${
              action === 'approve' ? 'approved' : 'archived'
            }.`
          );
          setSelected(new Set());
        },
        onError: (error) =>
          toast.error('Bulk action failed', {
            description: extractApiError(error).message,
          }),
      }
    );
  };

  if (isLoading) return <TableSkeleton />;

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        No questions match these filters.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all on this page"
                />
              </TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="hidden md:table-cell">Topic</TableHead>
              <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Correct</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Served</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((q) => (
              <TableRow
                key={q.uuid}
                data-state={selected.has(q.uuid) ? 'selected' : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(q.uuid)}
                    onCheckedChange={() => toggleOne(q.uuid)}
                    aria-label="Select question"
                  />
                </TableCell>
                <TableCell className="max-w-[340px]">
                  <Link
                    href={`/admin/quiz/questions/${q.uuid}`}
                    className="line-clamp-2 font-medium hover:underline"
                  >
                    {q.question_text}
                  </Link>
                  {q.generated_for_user && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      from {q.generated_for_user.name}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm">{q.topic}</span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <DifficultyBadge difficulty={q.difficulty} label={q.difficulty_label} />
                </TableCell>
                <TableCell>
                  <AdminQuizStatusBadge status={q.status} deleted={!!q.deleted_at} />
                </TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums lg:table-cell">
                  {q.correct_rate == null ? '—' : `${Math.round(q.correct_rate)}%`}
                </TableCell>
                <TableCell className="hidden text-right text-sm tabular-nums text-muted-foreground lg:table-cell">
                  {q.served_count}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/quiz/questions/${q.uuid}`}>View</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/quiz/questions/${q.uuid}/edit`}>Edit</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {q.deleted_at ? (
                        <DropdownMenuItem
                          onSelect={() => setPendingAction({ action: 'restore', question: q })}
                        >
                          Restore
                        </DropdownMenuItem>
                      ) : (
                        <>
                          {q.status === 'approved' ? (
                            <DropdownMenuItem
                              onSelect={() => setPendingAction({ action: 'archive', question: q })}
                            >
                              Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => setPendingAction({ action: 'approve', question: q })}
                            >
                              Approve
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => setPendingAction({ action: 'delete', question: q })}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminQuizBulkBar
        count={selected.size}
        pending={bulk.isPending}
        onApprove={() => runBulk('approve')}
        onArchive={() => runBulk('archive')}
        onClear={() => setSelected(new Set())}
      />

      <AdminQuizActionDialog
        action={pendingAction?.action ?? null}
        question={
          pendingAction
            ? {
                uuid: pendingAction.question.uuid,
                question_text: pendingAction.question.question_text,
              }
            : null
        }
        open={!!pendingAction}
        onOpenChange={(o) => {
          if (!o) setPendingAction(null);
        }}
      />
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
