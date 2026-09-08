'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { JudgmentSheet } from '@/components/admin/case-principles/JudgmentSheet';
import { ArgumentEditDialog } from '@/components/admin/case-arguments/ArgumentEditDialog';
import { ArgumentRejectDialog } from '@/components/admin/case-arguments/ArgumentRejectDialog';
import { CaseRail } from '@/components/admin/case-arguments/CaseRail';
import { CaseReviewPane } from '@/components/admin/case-arguments/CaseReviewPane';
import { ReviewTopStrip } from '@/components/admin/case-arguments/ReviewTopStrip';
import { ShortcutsDialog } from '@/components/admin/case-arguments/ShortcutsDialog';
import {
  chunkIds,
  groupQueueByCase,
  isActionable,
  type RowSessionState,
} from '@/components/admin/case-arguments/model';

import {
  useApproveCaseArgument,
  useBulkApproveCaseArguments,
  useCaseArgumentsSummary,
  useCaseReviewSet,
  useRejectCaseArgument,
  useReviewQueue,
  useUpdateCaseArgument,
} from '@/lib/hooks/useAdminCaseArguments';
import { extractApiError, isNotFoundError } from '@/lib/utils/api-error';
import type {
  CaseArgumentReviewItem,
  UpdateArgumentData,
} from '@/types/admin-case-arguments';

/** The bulk endpoint takes at most this many ids per call. */
const BULK_LIMIT = 100;

/******************************************************************************
                                Page Content
******************************************************************************/

function ArgumentReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const caseParam = Number(searchParams.get('case'));
  const activeCaseId =
    Number.isFinite(caseParam) && caseParam > 0 ? caseParam : undefined;

  /* Everything this visit has decided, keyed by argument id. It survives case
     switches on purpose: the rail's remaining counts and any revisited case
     both read from it. */
  const [session, setSession] = useState<ReadonlyMap<number, RowSessionState>>(
    new Map()
  );

  /* The focused row is a virtual cursor. Keying it by case resets it to the
     top of each newly opened case at render time, with no reset effect. */
  const [focus, setFocus] = useState<{ caseId: number | undefined; index: number }>(
    { caseId: undefined, index: 0 }
  );
  const focusedIndex = focus.caseId === activeCaseId ? focus.index : 0;

  const [editItem, setEditItem] = useState<CaseArgumentReviewItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectItem, setRejectItem] = useState<CaseArgumentReviewItem | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [judgmentOpen, setJudgmentOpen] = useState(false);

  const { data: summaryData, isLoading: summaryLoading } = useCaseArgumentsSummary();
  const {
    data: queueData,
    isLoading: queueLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useReviewQueue();
  const caseSetQuery = useCaseReviewSet(activeCaseId);
  const caseSetData = caseSetQuery.data;

  const approveMutation = useApproveCaseArgument();
  const rejectMutation = useRejectCaseArgument();
  const updateMutation = useUpdateCaseArgument();
  const bulkMutation = useBulkApproveCaseArguments();

  const railEntries = useMemo(() => {
    const entries = groupQueueByCase(
      queueData?.pages.flatMap((page) => page.data) ?? [],
      Boolean(hasNextPage)
    );

    /* A case sitting on the page boundary shows a floor ("7+"). Once it is
       OPENED its whole set is fetched and the pane beside the rail knows the
       real number, so the rail takes it rather than leaving two different
       counts for one case on screen at the same time. */
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

  /* The flat, ordered rows the cursor walks. The pane groups them for reading
     and maps back to these indexes, so both agree on what row three is. */
  const rows = useMemo(() => caseSetData?.items ?? [], [caseSetData]);

  const selectCase = useCallback(
    (caseId: number) => {
      router.push(`/admin/cases/argument-review?case=${caseId}`, { scroll: false });
    },
    [router]
  );

  const setRowState = useCallback((id: number, state: RowSessionState) => {
    setSession((prev) => {
      const next = new Map(prev);
      next.set(id, state);
      return next;
    });
  }, []);

  const handleApprove = useCallback(
    (item: CaseArgumentReviewItem) => {
      setRowState(item.id, { kind: 'approved' });
      approveMutation.mutate(item.id, {
        onError: (error) => {
          setRowState(item.id, {
            kind: 'failed',
            action: 'approve',
            message: extractApiError(error).message,
          });
        },
      });
    },
    [approveMutation, setRowState]
  );

  const handleReject = useCallback(
    (item: CaseArgumentReviewItem, reason: string) => {
      setRowState(item.id, { kind: 'rejected' });
      rejectMutation.mutate(
        { id: item.id, data: reason ? { reason } : {} },
        {
          onError: (error) => {
            setRowState(item.id, {
              kind: 'failed',
              action: 'reject',
              message: extractApiError(error).message,
            });
          },
        }
      );
    },
    [rejectMutation, setRowState]
  );

  const handleSaveEdit = useCallback(
    (id: number, data: UpdateArgumentData, approve: boolean) => {
      updateMutation.mutate(
        { id, data },
        {
          onSuccess: () => {
            if (approve) setRowState(id, { kind: 'approved' });
            setEditOpen(false);
          },
          onError: (error) => {
            toast.error(extractApiError(error).message);
          },
        }
      );
    },
    [updateMutation, setRowState]
  );

  const handleKeepAll = useCallback(() => {
    if (activeCaseId === undefined) return;
    const ids = rows.filter((row) => isActionable(row, session)).map((row) => row.id);
    if (ids.length === 0) return;

    for (const id of ids) setRowState(id, { kind: 'approved' });

    for (const batch of chunkIds(ids, BULK_LIMIT)) {
      bulkMutation.mutate(
        { caseId: activeCaseId, ids: batch },
        {
          onError: (error) => {
            const message = extractApiError(error).message;
            for (const id of batch) {
              setRowState(id, { kind: 'failed', action: 'approve', message });
            }
            toast.error(`Some arguments were not kept: ${message}`);
          },
        }
      );
    }
  }, [activeCaseId, rows, session, setRowState, bulkMutation]);

  const goToCase = useCallback(
    (delta: number) => {
      if (activeIndex === -1) return;
      const next = railEntries[activeIndex + delta];
      if (next) selectCase(next.caseRef.id);
    },
    [activeIndex, railEntries, selectCase]
  );

  /* Keyboard review. Ignored while a dialog is open or a field has focus, so
     typing a rejection reason never approves the row behind it. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editOpen || rejectOpen || shortcutsOpen || judgmentOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      const item = rows[focusedIndex];
      const move = (delta: number) => {
        event.preventDefault();
        setFocus({
          caseId: activeCaseId,
          index: Math.min(Math.max(focusedIndex + delta, 0), Math.max(rows.length - 1, 0)),
        });
      };

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          move(1);
          break;
        case 'k':
        case 'ArrowUp':
          move(-1);
          break;
        case 'a':
          if (item && isActionable(item, session)) handleApprove(item);
          break;
        case 'A':
          handleKeepAll();
          break;
        case 'e':
          if (item) {
            setEditItem(item);
            setEditOpen(true);
          }
          break;
        case 'x':
          if (item && isActionable(item, session)) {
            setRejectItem(item);
            setRejectOpen(true);
          }
          break;
        case 'g':
          setJudgmentOpen(true);
          break;
        case ']':
          goToCase(1);
          break;
        case '[':
          goToCase(-1);
          break;
        case '?':
          setShortcutsOpen(true);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    rows,
    focusedIndex,
    activeCaseId,
    session,
    editOpen,
    rejectOpen,
    shortcutsOpen,
    judgmentOpen,
    handleApprove,
    handleKeepAll,
    goToCase,
  ]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Argument review</h1>
        {/* ── EVERY CLAIM IN THIS SUBTITLE IS ONE A REVIEWER CAN CHECK ─────
            The first version said "nothing here is visible to a reader until
            you keep it". True when written and wrong by the evening: the
            arguments section came off the case page the same day, so keeping
            an argument now shows it to nobody, and a reviewer who kept a
            hundred and then opened the case would have found the sentence
            lying to them.

            "Our extraction" went for a different reason. It is our word, not
            the reader's, and the owner's rule is that a word nobody gave them
            costs them minutes. The AI wrote these; say so.

            The third sentence exists to answer the question the second one
            provokes. Without it the reviewer works, looks at the case, sees
            nothing, and reports a bug against their own afternoon. */}
        <p className="text-sm text-muted-foreground">
          What each side put to the court, written by AI from the report.
          Keeping an argument clears it to be shown. No case page draws
          arguments today.
        </p>
      </div>

      <ReviewTopStrip
        summary={summaryData?.data}
        isLoading={summaryLoading}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
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

        <CaseReviewPane
          activeCaseId={activeCaseId}
          data={caseSetData}
          rows={rows}
          isLoading={caseSetQuery.isLoading}
          isError={caseSetQuery.isError}
          isMissing={isNotFoundError(caseSetQuery.error)}
          onRetry={() => caseSetQuery.refetch()}
          session={session}
          focusedIndex={focusedIndex}
          onFocusRow={(index) => setFocus({ caseId: activeCaseId, index })}
          onApprove={handleApprove}
          onEdit={(item) => {
            setEditItem(item);
            setEditOpen(true);
          }}
          onReject={(item) => {
            setRejectItem(item);
            setRejectOpen(true);
          }}
          onKeepAll={handleKeepAll}
          onOpenJudgment={() => setJudgmentOpen(true)}
          onNextCase={() => goToCase(1)}
          onPrevCase={() => goToCase(-1)}
          hasNextCase={activeIndex > -1 && activeIndex < railEntries.length - 1}
          hasPrevCase={activeIndex > 0}
        />
      </div>

      <ArgumentEditDialog
        argument={editItem}
        open={editOpen}
        onOpenChange={setEditOpen}
        saving={updateMutation.isPending}
        onSave={handleSaveEdit}
      />
      <ArgumentRejectDialog
        argument={rejectItem}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={handleReject}
      />
      {/* Shared with the principle screen on purpose: it already fetches the
          report lazily with include_full_report, and one judgment reader that
          both screens use cannot drift into two that disagree. The focused
          argument is the highlight, so pressing g answers "show me THIS one in
          the report" rather than handing over 600,000 characters. */}
      <JudgmentSheet
        caseRef={activeCaseRef}
        open={judgmentOpen}
        onOpenChange={setJudgmentOpen}
        highlight={rows[focusedIndex]?.argument ?? null}
        quote={rows[focusedIndex]?.verbatim_quote ?? null}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

/******************************************************************************
                                  Main Page
******************************************************************************/

export default function ArgumentReviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <ArgumentReviewPageContent />
    </Suspense>
  );
}
