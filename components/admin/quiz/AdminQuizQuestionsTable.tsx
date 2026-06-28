'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, MoreHorizontal } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyBadge } from '@/components/quiz/DifficultyBadge';
import { AdminQuizStatusBadge } from './AdminQuizStatusBadge';
import { AdminQuizBulkBar } from './AdminQuizBulkBar';
import { AdminQuizActionDialog, type AdminQuizAction } from './AdminQuizActionDialog';
import { useBulkAdminQuizQuestions } from '@/lib/hooks/useAdminQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import { cn } from '@/lib/utils';
import type {
  AdminQuizQuestionListItem,
  AdminQuizQuestionSort,
} from '@/types/admin-quiz';

interface AdminQuizQuestionsTableProps {
  questions: AdminQuizQuestionListItem[];
  isLoading: boolean;
  sort?: AdminQuizQuestionSort;
  direction?: 'asc' | 'desc';
  onSort?: (column: AdminQuizQuestionSort) => void;
}

export function AdminQuizQuestionsTable({
  questions,
  isLoading,
  sort,
  direction,
  onSort,
}: AdminQuizQuestionsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<{
    action: AdminQuizAction;
    question: AdminQuizQuestionListItem;
  } | null>(null);
  const [bulkAction, setBulkAction] = useState<'approve' | 'archive' | null>(null);
  const [bulkNotes, setBulkNotes] = useState('');
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

  const runBulk = (action: 'approve' | 'archive', notes: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    bulk.mutate(
      { action, ids, moderation_notes: notes.trim() || undefined },
      {
        onSuccess: (res) => {
          toast.success(
            `${res.data.affected} question${res.data.affected === 1 ? '' : 's'} ${
              action === 'approve' ? 'approved' : 'archived'
            }.`
          );
          setSelected(new Set());
          setBulkAction(null);
          setBulkNotes('');
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
              <SortHead
                column="difficulty"
                label="Difficulty"
                sort={sort}
                direction={direction}
                onSort={onSort}
                className="hidden sm:table-cell"
              />
              <TableHead>Status</TableHead>
              <SortHead
                column="correct"
                label="Correct"
                sort={sort}
                direction={direction}
                onSort={onSort}
                className="hidden text-right lg:table-cell"
              />
              <SortHead
                column="served"
                label="Served"
                sort={sort}
                direction={direction}
                onSort={onSort}
                className="hidden text-right lg:table-cell"
              />
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
        onApprove={() => setBulkAction('approve')}
        onArchive={() => setBulkAction('archive')}
        onClear={() => setSelected(new Set())}
      />

      <AlertDialog
        open={!!bulkAction}
        onOpenChange={(o) => {
          if (bulk.isPending) return;
          if (!o) {
            setBulkAction(null);
            setBulkNotes('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'approve' ? 'Approve' : 'Archive'} {selected.size}{' '}
              question{selected.size === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'approve'
                ? 'They become servable in quizzes.'
                : 'They will be hidden from quizzes. You can approve them again later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 text-left">
            <Label htmlFor="bulk-notes" className="text-xs text-muted-foreground">
              Moderation note (optional)
            </Label>
            <Textarea
              id="bulk-notes"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              rows={2}
              placeholder="Why are you making this change?"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulk.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (bulkAction) runBulk(bulkAction, bulkNotes);
              }}
              disabled={bulk.isPending}
            >
              {bulk.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {bulkAction === 'approve' ? 'Approve' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function SortHead({
  column,
  label,
  sort,
  direction,
  onSort,
  className,
}: {
  column: AdminQuizQuestionSort;
  label: string;
  sort?: AdminQuizQuestionSort;
  direction?: 'asc' | 'desc';
  onSort?: (column: AdminQuizQuestionSort) => void;
  className?: string;
}) {
  if (!onSort) {
    return <TableHead className={className}>{label}</TableHead>;
  }
  const active = sort === column;
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          active && 'text-foreground'
        )}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-40')} />
      </button>
    </TableHead>
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
