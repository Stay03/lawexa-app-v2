'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ExternalLink,
  FolderSearch,
  Scale,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import type { CasePrincipleReviewItem } from '@/types/admin-case-principles';
import type { CaseReviewSet } from '@/lib/hooks/useAdminCasePrinciples';
import { isActionable, type ReviewSession } from './model';
import { PrincipleRow } from './PrincipleRow';

interface CaseReviewPaneProps {
  activeCaseId: number | undefined;
  data: CaseReviewSet | undefined;
  isLoading: boolean;
  isError: boolean;
  /** The case itself is gone, as opposed to the request having failed. */
  isMissing: boolean;
  onRetry: () => void;
  session: ReviewSession;
  focusedIndex: number;
  onFocusRow: (index: number) => void;
  onApprove: (item: CasePrincipleReviewItem) => void;
  onEdit: (item: CasePrincipleReviewItem) => void;
  onReject: (item: CasePrincipleReviewItem) => void;
  onApproveAll: () => void;
  onOpenJudgment: () => void;
  onShowShortcuts: () => void;
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
        <Skeleton className="h-1.5 w-full rounded-full" />
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
 * One case, whole. The set is loaded with case_id + per_page=100, so the
 * counts in this header are the server's own, never a page's — the old screen
 * showed "15 unreviewed · 15 total" on a case holding 60 because it could only
 * see the current page. The header sticks while the case scrolls (five cases
 * run past 24,000 characters) so Approve-all and the progress stay reachable.
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
  onFocusRow,
  onApprove,
  onEdit,
  onReject,
  onApproveAll,
  onOpenJudgment,
  onShowShortcuts,
  onNextCase,
  onPrevCase,
  hasNextCase,
  hasPrevCase,
}: CaseReviewPaneProps) {
  if (activeCaseId === undefined) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
        <FolderSearch className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Pick a case from the list, or find one by name, to start reviewing.
        </p>
      </div>
    );
  }

  if (isLoading) return <PaneSkeleton />;

  /* A case that is not there and a request that failed need opposite messages.
     Offering "Try again" for an address that will never resolve invites someone
     to retry forever — and after a merge, an old bookmarked case id is exactly
     the one that 404s. */
  if (isMissing) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
        <FolderSearch className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">That case is no longer here</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been removed or merged into another case. Pick one from the
          list to carry on reviewing.
        </p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          The case&apos;s principles could not be loaded.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const caseRef = data.items.find((item) => item.case)?.case ?? null;
  const total = data.items.length;
  const remaining = data.items.filter((item) => isActionable(item, session)).length;
  const done = total - remaining;
  const complete = total > 0 && remaining === 0;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
        <Check className="size-8 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm text-muted-foreground">
          No unreviewed principles in this case.
        </p>
        {hasNextCase && (
          <Button variant="outline" size="sm" onClick={onNextCase}>
            Next case
            <ArrowRight />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      {/* Sticky case header: identity, the true counts, and approve-all. */}
      <div className="sticky top-0 z-10 rounded-t-xl border-b bg-card/95 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            {caseRef ? (
              <Link
                href={`/admin/cases/${caseRef.slug}`}
                target="_blank"
                rel="noopener"
                className="group inline-flex min-w-0 items-baseline gap-1.5 text-base font-semibold leading-snug hover:underline"
              >
                <span className="min-w-0">{getCaseDisplayTitle(caseRef)}</span>
                <ExternalLink className="size-3.5 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
              </Link>
            ) : (
              <span className="text-base font-semibold text-muted-foreground">
                Unknown case
              </span>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {caseRef?.court && (
                <span className="inline-flex items-center gap-1">
                  <Scale className="size-3" />
                  {caseRef.court}
                </span>
              )}
              {caseRef?.country && <span>{caseRef.country}</span>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={onOpenJudgment}>
              <BookOpen />
              Judgment
            </Button>
            {complete ? (
              <span className="inline-flex h-8 items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
                <Check className="size-4" />
                All reviewed
              </span>
            ) : (
              <Button size="sm" onClick={onApproveAll}>
                <CheckCheck />
                Approve all {remaining}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 pb-3 pt-2.5">
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {done} of {total} reviewed
          </span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progress through this case"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none dark:bg-emerald-400"
              style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onShowShortcuts}
            className="shrink-0 rounded text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            Press <kbd className="font-mono">?</kbd> for shortcuts
          </button>
        </div>
      </div>

      <div className="divide-y">
        {data.items.map((item, index) => (
          <PrincipleRow
            key={item.id}
            item={item}
            state={session.get(item.id)}
            focused={index === focusedIndex}
            onFocus={() => onFocusRow(index)}
            onApprove={() => onApprove(item)}
            onEdit={() => onEdit(item)}
            onReject={() => onReject(item)}
          />
        ))}
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t px-4 py-3',
          complete && 'bg-emerald-500/5'
        )}
      >
        {complete ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 animate-in fade-in-0 duration-300 motion-reduce:animate-none">
            <Check className="size-4" />
            This case is finished
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {remaining} still to review in this case
          </span>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevCase}
            disabled={!hasPrevCase}
          >
            <ArrowLeft />
            Previous case
          </Button>
          <Button
            variant={complete ? 'default' : 'outline'}
            size="sm"
            onClick={onNextCase}
            disabled={!hasNextCase}
          >
            Next case
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
