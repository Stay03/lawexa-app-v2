'use client';

import { Suspense, use, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AdminConversationsTable,
  AdminPagination,
} from '@/components/admin';
import { AdminUserConversationFilters } from '@/components/admin/AdminUserConversationFilters';
import { useAdminUserConversations, useAdminUser } from '@/lib/hooks/useAdmin';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { ArrowLeft, User } from 'lucide-react';
import type { AdminUserConversationsParams } from '@/types/admin';

interface UserConversationsPageContentProps {
  uuid: string;
}

function UserConversationsPageContent({ uuid }: UserConversationsPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setOverride, clearOverride } = useBreadcrumbStore();

  // Fetch user data for breadcrumb
  const { data: userData } = useAdminUser(uuid);

  // Set breadcrumb label to user name
  useEffect(() => {
    if (userData?.data?.name) {
      setOverride(uuid, userData.data.name);
    }
    return () => {
      clearOverride(uuid);
    };
  }, [userData?.data?.name, uuid, setOverride, clearOverride]);

  // Read params from URL
  const params = useMemo<AdminUserConversationsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminUserConversationsParams['sort_by']) || 'created_at';
    const sort_order = (searchParams.get('sort_order') as AdminUserConversationsParams['sort_order']) || 'desc';
    const status = searchParams.get('status') as AdminUserConversationsParams['status'] | null;

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      status: status || undefined,
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminUserConversations(uuid, params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminUserConversationsParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      const queryString = newParams.toString();
      router.push(queryString ? `/admin/users/${uuid}/conversations?${queryString}` : `/admin/users/${uuid}/conversations`);
    },
    [router, searchParams, uuid]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminUserConversationsParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: 'created_at' | 'updated_at' | 'title') => {
      updateParams({
        sort_by: sortBy,
        sort_order:
          params.sort_by === sortBy && params.sort_order === 'desc' ? 'asc' : 'desc',
      });
    },
    [updateParams, params.sort_by, params.sort_order]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href={`/admin/users/${uuid}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to User Details
        </Button>
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {userData?.data?.name ? `${userData.data.name}'s Conversations` : 'User Conversations'}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">{uuid}</p>
          </div>
        </div>
        <AdminUserConversationFilters />
      </div>

      <AdminConversationsTable
        conversations={data?.data || []}
        isLoading={isLoading}
        params={{ ...params, user_uuid: uuid }}
        onSort={handleSort}
      />

      {data?.pagination && (
        <AdminPagination
          pagination={data.pagination}
          onPageChange={handlePageChange}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) => handleParamsChange({ per_page: perPage, page: 1 })}
          itemLabel="conversations"
        />
      )}
    </div>
  );
}

interface AdminUserConversationsPageProps {
  params: Promise<{ uuid: string }>;
}

export default function AdminUserConversationsPage({
  params,
}: AdminUserConversationsPageProps) {
  const { uuid } = use(params);

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-[300px]" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <UserConversationsPageContent uuid={uuid} />
    </Suspense>
  );
}
