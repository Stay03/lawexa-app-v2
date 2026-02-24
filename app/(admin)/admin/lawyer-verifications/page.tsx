'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import {
  LawyerVerificationsTable,
  LawyerVerificationFilters,
  LawyerVerificationStatsRow,
  LawyerVerificationApproveDialog,
  LawyerVerificationRejectDialog,
} from '@/components/admin/lawyer-verifications';

import {
  useAdminLawyerVerifications,
  useAdminLawyerVerificationStats,
} from '@/lib/hooks/useAdminLawyerVerifications';
import type {
  AdminLawyerVerificationsParams,
  AdminLawyerVerificationListItem,
} from '@/types/admin-lawyer-verification';

/******************************************************************************
                                Page Content Component
******************************************************************************/

function LawyerVerificationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<AdminLawyerVerificationListItem | null>(null);

  // Read params from URL
  const params = useMemo<AdminLawyerVerificationsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const status = searchParams.get('status') as AdminLawyerVerificationsParams['status'];

    return {
      page,
      per_page,
      status: status || undefined,
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminLawyerVerifications(params);
  const { data: statsData, isLoading: statsLoading } =
    useAdminLawyerVerificationStats();

  // Construct pagination object compatible with AdminPagination
  const pagination = useMemo(() => {
    if (!data?.data) return null;
    const { current_page, per_page, total, last_page } = data.data;
    const from = total > 0 ? (current_page - 1) * per_page + 1 : null;
    const to = total > 0 ? Math.min(current_page * per_page, total) : null;
    return { current_page, per_page, total, last_page, from, to };
  }, [data]);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminLawyerVerificationsParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      const queryString = newParams.toString();
      router.push(
        queryString
          ? `/admin/lawyer-verifications?${queryString}`
          : '/admin/lawyer-verifications'
      );
    },
    [router, searchParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  const handleApprove = useCallback(
    (item: AdminLawyerVerificationListItem) => {
      setSelectedItem(item);
      setApproveDialogOpen(true);
    },
    []
  );

  const handleReject = useCallback(
    (item: AdminLawyerVerificationListItem) => {
      setSelectedItem(item);
      setRejectDialogOpen(true);
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Lawyer Verifications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage lawyer verification submissions
        </p>
      </div>

      {/* Stats Row */}
      <LawyerVerificationStatsRow
        stats={statsData?.data}
        isLoading={statsLoading}
      />

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Submissions</CardTitle>
          <LawyerVerificationFilters
            params={params}
            onParamsChange={updateParams}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <LawyerVerificationsTable
            items={data?.data?.data || []}
            isLoading={isLoading}
            onApprove={handleApprove}
            onReject={handleReject}
          />

          {pagination && pagination.total > 0 && (
            <AdminPagination
              pagination={pagination}
              onPageChange={handlePageChange}
              itemLabel="submission"
            />
          )}
        </CardContent>
      </Card>

      {/* Action Dialogs */}
      <LawyerVerificationApproveDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        item={selectedItem}
      />
      <LawyerVerificationRejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        item={selectedItem}
      />
    </div>
  );
}

/******************************************************************************
                                Default Export
******************************************************************************/

export default function LawyerVerificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <LawyerVerificationsPageContent />
    </Suspense>
  );
}
