'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck, CheckCheck, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { PrincipleReviewSummary } from '@/components/admin/case-principles/PrincipleReviewSummary';
import { PrincipleReviewFilters } from '@/components/admin/case-principles/PrincipleReviewFilters';
import { PrincipleReviewList } from '@/components/admin/case-principles/PrincipleReviewList';
import { PrincipleEditDialog } from '@/components/admin/case-principles/PrincipleEditDialog';
import { PrincipleRejectDialog } from '@/components/admin/case-principles/PrincipleRejectDialog';

import {
  useApproveCasePrinciple,
  useBulkApproveCasePrinciples,
  useCasePrinciples,
  useCasePrinciplesSummary,
} from '@/lib/hooks/useAdminCasePrinciples';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  CasePrincipleReviewItem,
  CasePrinciplesParams,
  PrincipleType,
} from '@/types/admin-case-principles';

const BULK_LIMIT = 100;

/******************************************************************************
                                Page Content
******************************************************************************/

function PrincipleReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editItem, setEditItem] = useState<CasePrincipleReviewItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectItem, setRejectItem] = useState<CasePrincipleReviewItem | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const params = useMemo<CasePrinciplesParams>(() => {
    const reviewedParam = searchParams.get('reviewed');
    const reviewed =
      reviewedParam === null ? false : reviewedParam === 'all' ? undefined : true;
    const type = searchParams.get('type') as PrincipleType | null;
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      reviewed,
      type: type ?? undefined,
      case_id: searchParams.get('case_id')
        ? Number(searchParams.get('case_id'))
        : undefined,
    };
  }, [searchParams]);

  const { data: summaryData, isLoading: summaryLoading } = useCasePrinciplesSummary();
  const { data, isLoading } = useCasePrinciples(params);

  const approveMutation = useApproveCasePrinciple();
  const bulkMutation = useBulkApproveCasePrinciples();
  const isMutating = approveMutation.isPending || bulkMutation.isPending;

  const updateParams = useCallback(
    (updates: Partial<CasePrinciplesParams>) => {
      setSelectedIds(new Set());
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'reviewed') {
          if (value === false) next.delete('reviewed');
          else if (value === undefined) next.set('reviewed', 'all');
          else next.set('reviewed', '1');
        } else if (value === null || value === undefined) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      const qs = next.toString();
      router.push(
        qs ? `/admin/cases/principle-review?${qs}` : '/admin/cases/principle-review'
      );
    },
    [router, searchParams]
  );

  const deselect = useCallback((ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectCase = useCallback((ids: number[], selectAll: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (selectAll ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);

  const approveOne = useCallback(
    (item: CasePrincipleReviewItem) => {
      approveMutation.mutate(item.id, {
        onSuccess: () => {
          toast.success('Principle approved');
          deselect([item.id]);
        },
        onError: (error) => toast.error(extractApiError(error).message),
      });
    },
    [approveMutation, deselect]
  );

  const approveMany = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return;
      if (ids.length > BULK_LIMIT) {
        toast.error(`You can approve at most ${BULK_LIMIT} principles at once`);
        return;
      }
      bulkMutation.mutate(ids, {
        onSuccess: (response) => {
          toast.success(
            `Approved ${response.data.approved} · ${response.data.cases_reindexed} case(s) reindexed`
          );
          deselect(ids);
        },
        onError: (error) => toast.error(extractApiError(error).message),
      });
    },
    [bulkMutation, deselect]
  );

  const openEdit = useCallback((item: CasePrincipleReviewItem) => {
    setEditItem(item);
    setEditOpen(true);
  }, []);

  const openReject = useCallback((item: CasePrincipleReviewItem) => {
    setRejectItem(item);
    setRejectOpen(true);
  }, []);

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          Principle Review
        </h1>
        <p className="text-sm text-muted-foreground">
          Approve AI-extracted principles to publish them to case pages and search.
        </p>
      </div>

      <PrincipleReviewSummary summary={summaryData?.data} isLoading={summaryLoading} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-lg">Review queue</CardTitle>
          <PrincipleReviewFilters params={params} onParamsChange={updateParams} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk action bar */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
              <span className="text-sm font-medium">
                {selectedCount} selected
                {selectedCount > BULK_LIMIT && (
                  <span className="ml-1 text-destructive">(max {BULK_LIMIT} per approval)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={isMutating}
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveMany([...selectedIds])}
                  disabled={isMutating || selectedCount > BULK_LIMIT}
                >
                  {bulkMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="mr-1.5 h-4 w-4" />
                  )}
                  Approve selected
                </Button>
              </div>
            </div>
          )}

          <PrincipleReviewList
            items={data?.data || []}
            isLoading={isLoading}
            selectedIds={selectedIds}
            isMutating={isMutating}
            onToggleSelect={toggleSelect}
            onSelectCase={selectCase}
            onApprove={approveOne}
            onApproveCase={approveMany}
            onEdit={openEdit}
            onReject={openReject}
          />

          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="principles"
            />
          )}
        </CardContent>
      </Card>

      <PrincipleEditDialog principle={editItem} open={editOpen} onOpenChange={setEditOpen} />
      <PrincipleRejectDialog
        principle={rejectItem}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
      />
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PrincipleReviewPageContent />
    </Suspense>
  );
}
