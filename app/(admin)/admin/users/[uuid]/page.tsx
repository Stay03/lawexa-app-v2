'use client';

import { use, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminUser, useAdminUserConversations } from '@/lib/hooks/useAdmin';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { ArrowLeft } from 'lucide-react';
import {
  UserIdentityCard,
  QuickStatsRow,
  AdminConversationsTable,
  AdminPagination,
} from '@/components/admin';
import { AdminUserConversationFilters } from '@/components/admin/AdminUserConversationFilters';
import type { AdminUserConversationsParams } from '@/types/admin';

interface AdminUserDetailPageProps {
  params: Promise<{ uuid: string }>;
}

export default function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const { uuid } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: userData, isLoading: userLoading, error } = useAdminUser(uuid);
  const { exchangeRate, showNGN } = useCurrencyStore();

  // Read params from URL for conversations
  const conversationParams = useMemo<AdminUserConversationsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by =
      (searchParams.get('sort_by') as AdminUserConversationsParams['sort_by']) ||
      'created_at';
    const sort_order =
      (searchParams.get(
        'sort_order'
      ) as AdminUserConversationsParams['sort_order']) || 'desc';
    const status = searchParams.get(
      'status'
    ) as AdminUserConversationsParams['status'] | null;

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      status: status || undefined,
    };
  }, [searchParams]);

  const { data: conversationsData, isLoading: conversationsLoading } =
    useAdminUserConversations(uuid, conversationParams);

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
      router.push(
        queryString ? `/admin/users/${uuid}?${queryString}` : `/admin/users/${uuid}`
      );
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
          conversationParams.sort_by === sortBy &&
          conversationParams.sort_order === 'desc'
            ? 'asc'
            : 'desc',
      });
    },
    [updateParams, conversationParams.sort_by, conversationParams.sort_order]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  if (userLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-col lg:flex-row gap-6">
          <Skeleton className="h-96 w-full lg:w-72" />
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !userData?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/conversations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Conversations
          </Button>
        </Link>
        <div className="rounded-lg border py-8 text-center text-muted-foreground">
          User not found
        </div>
      </div>
    );
  }

  const user = userData.data;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/conversations">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>
      </Link>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar - User Identity */}
        <UserIdentityCard user={user} className="lg:w-72 lg:shrink-0" />

        {/* Right Content - Analytics & Conversations */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Quick Stats Row */}
          <QuickStatsRow
            conversationsCount={user.conversations_count}
            usageSummary={user.usage_summary}
            showNGN={showNGN}
            exchangeRate={exchangeRate}
          />

          {/* Conversations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Conversations</h2>
              <AdminUserConversationFilters />
            </div>

            <AdminConversationsTable
              conversations={conversationsData?.data || []}
              isLoading={conversationsLoading}
              params={{ ...conversationParams, user_uuid: uuid }}
              onSort={handleSort}
              hideUserColumn
            />

            {conversationsData?.pagination && (
              <AdminPagination
                pagination={conversationsData.pagination}
                onPageChange={handlePageChange}
                perPage={conversationParams.per_page || 15}
                onPerPageChange={(perPage) => handleParamsChange({ per_page: perPage, page: 1 })}
                itemLabel="conversations"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
