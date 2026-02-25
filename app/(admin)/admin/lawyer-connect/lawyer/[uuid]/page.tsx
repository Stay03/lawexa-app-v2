'use client';

import { Suspense, useCallback, useMemo, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { LawyerConnectTable } from '@/components/admin/lawyer-connect/LawyerConnectTable';
import {
  useAdminLawyerRequests,
} from '@/lib/hooks/useAdminLawyerConnect';
import type {
  AdminLawyerConnectListParams,
  LawyerConnectStatus,
} from '@/types/admin-lawyer-connect';

interface PageParams {
  uuid: string;
}

function LawyerRequestsContent({ uuid }: { uuid: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read params from URL
  const params = useMemo<
    Omit<AdminLawyerConnectListParams, 'lawyer_uuid' | 'sort_by'>
  >(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_order =
      (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc';
    const status = searchParams.get('status') as LawyerConnectStatus | null;
    return { page, per_page, sort_order, status: status || undefined };
  }, [searchParams]);

  const { data, isLoading } = useAdminLawyerRequests(uuid, params);

  const updateParams = useCallback(
    (
      updates: Partial<
        Omit<AdminLawyerConnectListParams, 'lawyer_uuid' | 'sort_by'>
      >
    ) => {
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
          ? `/admin/lawyer-connect/lawyer/${uuid}?${queryString}`
          : `/admin/lawyer-connect/lawyer/${uuid}`
      );
    },
    [router, searchParams, uuid]
  );

  // Derive lawyer name from first result for heading
  const lawyerName = data?.data?.[0]?.lawyer?.name;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {lawyerName ? (
          <>
            Requests for{' '}
            <span className="text-primary">{lawyerName}</span>
          </>
        ) : (
          'Lawyer Connection Requests'
        )}
      </h1>

      {/* Status filter */}
      <div className="flex gap-3">
        <Select
          value={params.status ?? 'all'}
          onValueChange={(value) =>
            updateParams({
              status:
                value === 'all'
                  ? undefined
                  : (value as LawyerConnectStatus),
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={params.sort_order ?? 'desc'}
          onValueChange={(value) =>
            updateParams({ sort_order: value as 'asc' | 'desc', page: 1 })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest first</SelectItem>
            <SelectItem value="asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <LawyerConnectTable
        requests={data?.data || []}
        isLoading={isLoading}
        params={{ ...params, sort_by: 'created_at' }}
        onSort={() => {}}
        hideLawyerColumn
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={(page) => updateParams({ page })}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) =>
            updateParams({ per_page: perPage, page: 1 })
          }
          itemLabel="requests"
        />
      )}
    </div>
  );
}

function LawyerRequestsPage({ params }: { params: Promise<PageParams> }) {
  const { uuid } = use(params);

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/lawyer-connect">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to All Requests
          </Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-8 w-[300px]" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-[150px]" />
              <Skeleton className="h-10 w-[140px]" />
            </div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        }
      >
        <LawyerRequestsContent uuid={uuid} />
      </Suspense>
    </div>
  );
}

export default LawyerRequestsPage;
