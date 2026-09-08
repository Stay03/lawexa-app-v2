'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCheck,
  ExternalLink,
  FolderSearch,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import type { CaseArgumentReviewItem } from '@/types/admin-case-arguments';
import type { CaseReviewSet } from '@/lib/hooks/useAdminCaseArguments';
import { ArgumentRow } from './ArgumentRow';
import {
  counselNameOf,
  groupCaseArguments,
  isActionable,
  type ReviewSession,
} from './model';

interface CaseReviewPaneProps {
  activeCaseId: number | undefined;
  data: CaseReviewSet | undefined;
  isLoading: boolean;
  isError: boolean;
  /** The case itself is gone, as opposed to the request having failed. */
  isMissing: boolean;
  onRetry: () => void;
  session: ReviewSession;
  /** Index into the FLAT ordered row list, which is what j/k walks. */
  focusedIndex: number;
  rows: CaseArgumentReviewItem[];
  onFocusRow: (index: number) => void;
  onApprove: (item: CaseArgumentReviewItem) => void;
  onEdit: (item: CaseArgumentReviewItem) => void;
  onReject: (item: CaseArgumentReviewItem) => void;
  onKeepAll: () => void;
  onOpenJudgment: () => void;
  onNextCase: () => void;
  onPrevCase: () => void;
  hasNextCase: boolean;
  hasPrevCase: boolean;
}

function PaneSkeleton() {
  return (
    <div className="rounded-xl border bg-card" aria-busy>
      <div className="space-y-3 border-b px-4 py-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 px-4 py-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-5 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One case at a time: the arguments grouped the way they were argued.
 *
 * ── SIDE, THEN COUNSEL, THEN THE SUBMISSIONS ──────────────────────────────
 * A reviewer is judging whether a paragraph is really something counsel put to
 * the court. That question is much easier to answer with the other submissions
 * by the same advocate beside it, and much harder against a flat list where an
 * appellant's point sits next to a respondent's. The grouping is not
 * decoration; it is the context the decision needs.
 *
 * The keyboard cursor still walks a FLAT list across the groups, so j/k move
 * through the case in reading order and never trap the reviewer inside one
 * counsel's block.
 */
export function CaseReviewPane({
  activeCaseId,
  data,
  isLoading,
  isError,
  isMissing,
  onRetry,
  session,
  focusedIndex,
  rows,
  onFocusRow,
  onApprove,
  onEdit,
  onReject,
  onKeepAll,
  onOpenJudgment,
  onNextCase,
  onPrevCase,
  hasNextCase,
  hasPrevCase,
}: CaseReviewPaneProps) {
  if (activeCaseId === undefined) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
        <FolderSearch className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Pick a case from the list to start reviewing its arguments.
        </p>
      </div>
    );
  }

  if (isLoading) return <PaneSkeleton />;

  if (isMissing) {
    return (
      <div className="rounded-xl border bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          That case is no longer here. Pick another from the list.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3 rounded-xl border bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          The arguments for this case did not load.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const caseRef = data?.items.find((item) => item.case)?.case ?? null;
  const groups = groupCaseArguments(rows);
  const remaining = rows.filter((row) => isActionable(row, session)).length;

  /* The flat index each row occupies, so the grouped render and the keyboard
     cursor agree about what "the third row" means. */
  const indexOf = new Map(rows.map((row, index) => [row.id, index]));

  return (
    <div className="rounded-xl border bg-card">
      <div className="space-y-3 border-b px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold leading-snug">
              {caseRef ? getCaseDisplayTitle(caseRef) : 'This case'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {remaining === 0
                ? 'Nothing left to decide on this case.'
                : `${remaining} of ${rows.length} arguments still to decide`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={onOpenJudgment}>
              <BookOpen className="mr-1 size-4" aria-hidden />
              Judgment
            </Button>
            {caseRef && (
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={`/cases/${caseRef.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1 size-4" aria-hidden />
                  Open case
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onKeepAll}
            disabled={remaining === 0}
          >
            <CheckCheck className="mr-1 size-4" aria-hidden />
            Keep all {remaining > 0 ? remaining : ''}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPrevCase}
              disabled={!hasPrevCase}
            >
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNextCase}
              disabled={!hasNextCase}
            >
              Next case
              <ArrowRight className="ml-1 size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          This case has no arguments waiting.
        </p>
      ) : (
        <div>
          {groups.map((group) => (
            <section key={group.heading} aria-label={group.heading}>
              <h3
                className={cn(
                  'sticky top-0 z-10 border-y bg-muted/40 px-4 py-2',
                  'text-xs font-semibold uppercase tracking-wide text-muted-foreground'
                )}
              >
                {group.heading}
              </h3>
              {group.counsel.map((block, blockIndex) => (
                <div key={`${group.heading}-${blockIndex}`}>
                  <p className="px-4 pt-3 text-sm font-medium">
                    {block.counselName ?? (
                      <span className="font-normal text-muted-foreground">
                        Counsel not recorded
                      </span>
                    )}
                  </p>
                  <div className="divide-y">
                    {block.rows.map((row) => (
                      <ArgumentRow
                        key={row.id}
                        item={row}
                        state={session.get(row.id)}
                        focused={indexOf.get(row.id) === focusedIndex}
                        onFocus={() => onFocusRow(indexOf.get(row.id) ?? 0)}
                        onApprove={() => onApprove(row)}
                        onEdit={() => onEdit(row)}
                        onReject={() => onReject(row)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Re-exported so the page can label a counsel block without importing model. */
export { counselNameOf };
