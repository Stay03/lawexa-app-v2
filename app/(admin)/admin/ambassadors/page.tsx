'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPagination } from '@/components/admin';
import { AmbassadorsTable, AmbassadorReviewDialog } from '@/components/admin/ambassadors';

import { useAdminAmbassadors } from '@/lib/hooks/useAdminAmbassadors';
import type {
  AmbassadorApplication,
  AmbassadorListParams,
  AmbassadorStatus,
} from '@/types/ambassador';

function AmbassadorsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<AmbassadorApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const params = useMemo<AmbassadorListParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const status = (searchParams.get('status') as AmbassadorStatus) || undefined;
    return { page, per_page: 15, status, sort: 'created_at', direction: 'desc' };
  }, [searchParams]);

  const { data, isLoading } = useAdminAmbassadors(params);

  const updateParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      const qs = next.toString();
      router.push(qs ? `/admin/ambassadors?${qs}` : '/admin/ambassadors');
    },
    [router, searchParams]
  );

  const handleReview = useCallback((application: AmbassadorApplication) => {
    setSelected(application);
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Ambassador Applications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-end">
            <Select
              value={params.status ?? 'all'}
              onValueChange={(value) =>
                updateParams({ status: value === 'all' ? null : value, page: 1 })
              }
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AmbassadorsTable
            applications={data?.data || []}
            isLoading={isLoading}
            onReview={handleReview}
          />

          {data?.pagination && data.pagination.total > 0 && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="application"
            />
          )}
        </CardContent>
      </Card>

      <AmbassadorReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        application={selected}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default function AmbassadorsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <AmbassadorsPageContent />
    </Suspense>
  );
}
