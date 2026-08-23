'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { CaseRail } from '@/components/admin/case-principles/CaseRail';
import { CaseReviewPane } from '@/components/admin/case-principles/CaseReviewPane';
import { JudgmentSheet } from '@/components/admin/case-principles/JudgmentSheet';
import { PrincipleEditDialog } from '@/components/admin/case-principles/PrincipleEditDialog';
import { PrincipleRejectDialog } from '@/components/admin/case-principles/PrincipleRejectDialog';
import { ReviewTopStrip } from '@/components/admin/case-principles/ReviewTopStrip';
import { ShortcutsDialog } from '@/components/admin/case-principles/ShortcutsDialog';
import {
  chunkIds,
  groupQueueByCase,
  isActionable,
  type RowSessionState,
} from '@/components/admin/case-principles/model';

import {
  useApproveCasePrinciple,
  useBulkApproveCasePrinciples,
  useCasePrinciplesSummary,
  useCaseReviewSet,
  useRejectCasePrinciple,
  useReviewQueue,
} from '@/lib/hooks/useAdminCasePrinciples';
import { useHeldCommits } from '@/lib/hooks/useHeldCommits';
import { extractApiError } from '@/lib/utils/api-error';
import type { CasePrincipleReviewItem } from '@/types/admin-case-principles';

/** The bulk-approve endpoint accepts at most 100 ids per call. */
const BULK_LIMIT = 100;

/******************************************************************************
                                Page Content
******************************************************************************/

function PrincipleReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const caseParam = Number(searchParams.get('case'));
  const activeCaseId =
    Number.isFinite(caseParam) && caseParam > 0 ? caseParam : undefined;

  /* Session overlay: everything this visit has done, keyed by principle id.
     It survives case switches on purpose — the rail's remaining counts and
     revisited cases both read from it. */
  const [session, setSession] = useState<ReadonlyMap<number, RowSessionState>>(
    new Map()
  );

  /* The focused row is a virtual cursor. Keying it by case makes it reset to
     the top of each newly opened case at render time, with no reset effect. */
  const [focus, setFocus] = useState<{ caseId: number | undefined; index: number }>(
    { caseId: undefined, index: 0 }
  );
  const focusedIndex = focus.caseId === activeCaseId ? focus.index : 0;

  const [editItem, setEditItem] = useState<CasePrincipleReviewItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectItem, setRejectItem] = useState<CasePrincipleReviewItem | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [judgmentOpen, setJudgmentOpen] = useState(false);

  const { data: summaryData, isLoading: summaryLoading } = useCasePrinciplesSummary();
  const {
    data: queueData,
    isLoading: queueLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useReviewQueue();
  const caseSetQuery = useCaseReviewSet(activeCaseId);
  const caseSetData = caseSetQuery.data;

  const approveMutation = useApproveCasePrinciple();
  const rejectMutation = useRejectCasePrinciple();
  const bulkMutation = useBulkApproveCasePrinciples();
  const { hold: holdCommit, flush: flushCommits } = useHeldCommits();

  const railEntries = useMemo(() => {
    const entries = groupQueueByCase(
      queueData?.pages.flatMap((page) => page.data) ?? [],
      Boolean(hasNextPage)
    );

    /* The rail counts what the loaded queue prefix has actually seen, so a case
       sitting on the page boundary shows a floor ("31+"). Once that case is
       OPENED its whole set is fetched, and the pane beside the rail is then
       showing the real number — two different numbers for one case, on screen
       at the same time. So the moment the truth is known, the rail takes it. */
    if (activeCaseId === undefined || !caseSetData) return entries;
    const index = entries.findIndex((entry) => entry.caseRef.id === activeCaseId);
    if (index === -1 || entries[index].countKnown) return entries;

    const next = [...entries];
    next[index] = {
      ...next[index],
      ids: caseSetData.items.map((item) => item.id),
      countKnown: true,
    };
    return next;
  }, [queueData, hasNextPage, activeCaseId, caseSetData]);

  const activeIndex = useMemo(
    () => railEntries.findIndex((entry) => entry.caseRef.id === activeCaseId),
    [railEntries, activeCaseId]
  );

  const activeCaseRef = useMemo(() => {
    const fromSet = caseSetData?.items.find((item) => item.case)?.case;
    if (fromSet) return fromSet;
    return (
      railEntries.find((entry) => entry.caseRef.id === activeCaseId)?.caseRef ?? null
    );
  }, [caseSetData, railEntries, activeCaseId]);

  const sessionReviewed = useMemo(() => {
    let count = 0;
    for (const state of session.values()) {
      if (state.kind === 'approved' || state.kind === 'rejected') count += 1;
    }
    return count;
  }, [session]);

  const setRowStates = useCallback(
    (ids: number[], state: RowSessionState | null) => {
      setSession((prev) => {
        const next = new Map(prev);
        for (const id of ids) {
          if (state) next.set(id, state);
          else next.delete(id);
        }
        return next;
      });
    },
    []
  );

  /****************************************************************************
                                  Navigation
  ****************************************************************************/

  /* Moving on commits anything still held: the Undo window belongs to the
     case it was opened on, and a hold must never be silently forgotten. */
  const selectCase = useCallback(
    (caseId: number) => {
      flushCommits();
      router.push(`/admin/cases/principle-review?case=${caseId}`);
    },
    [flushCommits, router]
  );

  /* Start on the first pending case rather than an empty pane. */
  useEffect(() => {
    if (activeCaseId === undefined && railEntries.length > 0) {
      router.replace(
        `/admin/cases/principle-review?case=${railEntries[0].caseRef.id}`
      );
    }
  }, [activeCaseId, railEntries, router]);

  /* "Next" past the loaded rail extends it first, then advances once the new
     page has produced a new case. The ref survives the fetch round-trip. */
  const pendingAdvanceFromRef = useRef<number | null>(null);

  const goToNextCase = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < railEntries.length - 1) {
      selectCase(railEntries[activeIndex + 1].caseRef.id);
    } else if (activeIndex === railEntries.length - 1 && hasNextPage) {
      pendingAdvanceFromRef.current = activeIndex;
      fetchNextPage();
    } else if (activeIndex === -1 && railEntries.length > 0) {
      selectCase(railEntries[0].caseRef.id);
    }
  }, [activeIndex, railEntries, selectCase, hasNextPage, fetchNextPage]);

  const goToPrevCase = useCallback(() => {
    if (activeIndex > 0) selectCase(railEntries[activeIndex - 1].caseRef.id);
  }, [activeIndex, railEntries, selectCase]);

  useEffect(() => {
    const from = pendingAdvanceFromRef.current;
    if (from === null) return;
    if (railEntries.length > from + 1) {
      pendingAdvanceFromRef.current = null;
      selectCase(railEntries[from + 1].caseRef.id);
    } else if (!hasNextPage) {
      pendingAdvanceFromRef.current = null;
    }
  }, [railEntries, selectCase, hasNextPage]);

  const hasNextCase =
    activeIndex === -1
      ? railEntries.length > 0
      : activeIndex < railEntries.length - 1 || Boolean(hasNextPage);
  const hasPrevCase = activeIndex > 0;

  /****************************************************************************
                                Review actions
  ****************************************************************************/

  const rows = useMemo(() => caseSetData?.items ?? [], [caseSetData]);

  const focusRow = useCallback(
    (index: number) => setFocus({ caseId: activeCaseId, index }),
    [activeCaseId]
  );

  const focusNextActionable = useCallback(
    (fromIndex: number, excludeId: number) => {
      for (let i = fromIndex + 1; i < rows.length; i += 1) {
        if (rows[i].id !== excludeId && isActionable(rows[i], session)) {
          setFocus({ caseId: activeCaseId, index: i });
          return;
        }
      }
    },
    [rows, session, activeCaseId]
  );

  /* Optimistic and quiet: the row ticks itself immediately, the request goes
     in the background, and only failure speaks — a success toast per row
     would fire 1,700 times over this queue. */
  const approveOne = useCallback(
    (item: CasePrincipleReviewItem, options?: { advanceFrom: number }) => {
      setRowStates([item.id], { kind: 'approved' });
      approveMutation.mutate(item.id, {
        onError: (error) => {
          const message = extractApiError(error).message;
          setRowStates([item.id], { kind: 'failed', action: 'approve', message });
          toast.error(`Approve failed: ${message}`);
        },
      });
      if (options) focusNextActionable(options.advanceFrom, item.id);
    },
    [approveMutation, focusNextActionable, setRowStates]
  );

  /* Approve-all is the case-level publish of up to 71 rows at once, so it
     gets the same held window as reject: rows tick instantly, the request
     waits behind an Undo toast, and moving on commits it. */
  const approveAllInCase = useCallback(() => {
    if (activeCaseId === undefined) return;
    const ids = rows
      .filter((item) => isActionable(item, session))
      .map((item) => item.id);
    if (ids.length === 0) return;
    setRowStates(ids, { kind: 'approved' });
    holdCommit({
      key: `approve-case-${activeCaseId}`,
      message: `Approving ${ids.length} principle${ids.length === 1 ? '' : 's'}…`,
      onCommit: () => {
        for (const batch of chunkIds(ids, BULK_LIMIT)) {
          bulkMutation.mutate(
            { caseId: activeCaseId, ids: batch },
            {
              onSuccess: (response) =>
                toast.success(`${response.data.approved} approved`),
              onError: (error) => {
                const message = extractApiError(error).message;
                setRowStates(batch, {
                  kind: 'failed',
                  action: 'approve',
                  message,
                });
                toast.error(`Approve failed: ${message}`);
              },
            }
          );
        }
      },
      onUndo: () => setRowStates(ids, null),
    });
  }, [activeCaseId, rows, session, setRowStates, holdCommit, bulkMutation]);

  /* After the confirm dialog, the delete itself is still held briefly — the
     server keeps no archive, so the only undo that can exist is the one
     before the request leaves. */
  const confirmReject = useCallback(
    (item: CasePrincipleReviewItem) => {
      setRowStates([item.id], { kind: 'rejected' });
      holdCommit({
        key: `reject-${item.id}`,
        message: 'Rejecting principle…',
        onCommit: () => {
          rejectMutation.mutate(item.id, {
            onError: (error) => {
              const message = extractApiError(error).message;
              setRowStates([item.id], {
                kind: 'failed',
                action: 'reject',
                message,
              });
              toast.error(`Reject failed: ${message}`);
            },
          });
        },
        onUndo: () => setRowStates([item.id], null),
      });
      const index = rows.findIndex((row) => row.id === item.id);
      if (index === focusedIndex) focusNextActionable(index, item.id);
    },
    [
      setRowStates,
      holdCommit,
      rejectMutation,
      rows,
      focusedIndex,
      focusNextActionable,
    ]
  );

  const openEdit = useCallback((item: CasePrincipleReviewItem) => {
    setEditItem(item);
    setEditOpen(true);
  }, []);

  const openReject = useCallback((item: CasePrincipleReviewItem) => {
    setRejectItem(item);
    setRejectOpen(true);
  }, []);

  /* A save-and-approve is already committed server-side when this fires; the
     overlay only needs to agree so the rail counts move with it. */
  const handleEditSaved = useCallback(
    (item: CasePrincipleReviewItem, approved: boolean) => {
      if (approved) setRowStates([item.id], { kind: 'approved' });
    },
    [setRowStates]
  );

  /****************************************************************************
                                  Keyboard
  ****************************************************************************/

  const anyDialogOpen = editOpen || rejectOpen || shortcutsOpen || judgmentOpen;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (anyDialogOpen) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      const focusedItem = rows[focusedIndex];
      switch (event.key) {
        case 'j':
          if (rows.length > 0) {
            focusRow(Math.min(focusedIndex + 1, rows.length - 1));
            event.preventDefault();
          }
          break;
        case 'k':
          if (rows.length > 0) {
            focusRow(Math.max(focusedIndex - 1, 0));
            event.preventDefault();
          }
          break;
        case 'a':
          if (focusedItem && isActionable(focusedItem, session)) {
            approveOne(focusedItem, { advanceFrom: focusedIndex });
            event.preventDefault();
          }
          break;
        case 'e':
          if (focusedItem && isActionable(focusedItem, session)) {
            openEdit(focusedItem);
            event.preventDefault();
          }
          break;
        case 'r':
          if (focusedItem && isActionable(focusedItem, session)) {
            openReject(focusedItem);
            event.preventDefault();
          }
          break;
        case 'ArrowRight':
          goToNextCase();
          event.preventDefault();
          break;
        case 'ArrowLeft':
          goToPrevCase();
          event.preventDefault();
          break;
        case '?':
          setShortcutsOpen(true);
          event.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    anyDialogOpen,
    rows,
    focusedIndex,
    focusRow,
    session,
    approveOne,
    openEdit,
    openReject,
    goToNextCase,
    goToPrevCase,
  ]);

  /* Keep the cursor on screen as j/k walk rows that vary from one line to
     eight. block:'nearest' makes this a no-op when the row is already
     visible, so mouse clicks never cause a jump. */
  useEffect(() => {
    const item = rows[focusedIndex];
    if (!item) return;
    const element = document.getElementById(`principle-row-${item.id}`);
    if (!element) return;
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    element.scrollIntoView({
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [rows, focusedIndex]);

  /****************************************************************************
                                    Render
  ****************************************************************************/

  const queueClear =
    !queueLoading &&
    railEntries.length === 0 &&
    activeCaseId === undefined &&
    summaryData?.data.unreviewed === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ClipboardCheck className="size-6 text-primary" />
          Principle Review
        </h1>
        <p className="text-sm text-muted-foreground">
          Approve AI-extracted principles to publish them to case pages and
          search — one case at a time.
        </p>
      </div>

      <ReviewTopStrip
        summary={summaryData?.data}
        isLoading={summaryLoading}
        casePosition={activeIndex >= 0 ? activeIndex + 1 : null}
        sessionReviewed={sessionReviewed}
      />

      {queueClear ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
          <p className="text-base font-medium">The queue is clear</p>
          <p className="text-sm text-muted-foreground">
            Every extracted principle has been reviewed.
          </p>
        </div>
      ) : (
        <div className="items-start gap-4 space-y-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:space-y-0">
          {/* 6rem = the admin top bar (4rem) plus this rail's own top offset
              and breathing room, so the rail bottom stays on screen. */}
          <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
            <CaseRail
              entries={railEntries}
              session={session}
              activeCaseId={activeCaseId}
              casesPendingTotal={summaryData?.data.cases_with_unreviewed}
              isLoading={queueLoading}
              hasMore={Boolean(hasNextPage)}
              isLoadingMore={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
              onSelectCase={selectCase}
            />
          </aside>

          <CaseReviewPane
            activeCaseId={activeCaseId}
            data={caseSetData}
            isLoading={caseSetQuery.isLoading}
            isError={caseSetQuery.isError}
            onRetry={() => caseSetQuery.refetch()}
            session={session}
            focusedIndex={focusedIndex}
            onFocusRow={focusRow}
            onApprove={approveOne}
            onEdit={openEdit}
            onReject={openReject}
            onApproveAll={approveAllInCase}
            onOpenJudgment={() => setJudgmentOpen(true)}
            onShowShortcuts={() => setShortcutsOpen(true)}
            onNextCase={goToNextCase}
            onPrevCase={goToPrevCase}
            hasNextCase={hasNextCase}
            hasPrevCase={hasPrevCase}
          />
        </div>
      )}

      <PrincipleEditDialog
        principle={editItem}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={handleEditSaved}
      />
      <PrincipleRejectDialog
        principle={rejectItem}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={confirmReject}
      />
      {/* The judgment opens at the row the reviewer is on, not at the top. The
          keyboard cursor already tracks that row, so pressing Judgment answers
          "show me THIS one in the report" rather than handing over 235,000
          characters and leaving them to search. */}
      <JudgmentSheet
        caseRef={activeCaseRef}
        open={judgmentOpen}
        onOpenChange={setJudgmentOpen}
        highlight={rows[focusedIndex]?.principle ?? null}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

/******************************************************************************
                                Main Page
******************************************************************************/

export default function PrincipleReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-[84px] w-full" />
          <div className="items-start gap-4 space-y-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:space-y-0">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-[480px] w-full" />
          </div>
        </div>
      }
    >
      <PrincipleReviewPageContent />
    </Suspense>
  );
}
