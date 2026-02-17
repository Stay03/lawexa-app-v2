'use client';

import { use, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { BroadcastDetailCard } from '@/components/admin/notifications/BroadcastDetailCard';
import { BroadcastRecipientsTable } from '@/components/admin/notifications/BroadcastRecipientsTable';

import {
  useAdminBroadcast,
  useBroadcastRecipients,
} from '@/lib/hooks/useAdminNotifications';
import type { BroadcastRecipientsParams } from '@/types/notification';

/******************************************************************************
                                Types
******************************************************************************/

interface BroadcastDetailPageProps {
  params: Promise<{ uuid: string }>;
}

/******************************************************************************
                                Component
******************************************************************************/

export default function BroadcastDetailPage({
  params: paramsPromise,
}: BroadcastDetailPageProps) {
  const { uuid } = use(paramsPromise);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Recipients pagination params
  const recipientsParams = useMemo<BroadcastRecipientsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    return { page, per_page };
  }, [searchParams]);

  const {
    data: broadcastData,
    isLoading: broadcastLoading,
    error: broadcastError,
  } = useAdminBroadcast(uuid);

  const {
    data: recipientsData,
    isLoading: recipientsLoading,
  } = useBroadcastRecipients(uuid, recipientsParams);

  // Update URL params for recipients pagination
  const updateParams = useCallback(
    (updates: Partial<BroadcastRecipientsParams>) => {
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
          ? `/admin/notifications/${uuid}?${queryString}`
          : `/admin/notifications/${uuid}`
      );
    },
    [router, searchParams, uuid]
  );

  const handlePageChange = useCallback(
    (page: number) => updateParams({ page }),
    [updateParams]
  );

  const handlePerPageChange = useCallback(
    (per_page: number) => updateParams({ per_page, page: 1 }),
    [updateParams]
  );

  // Error state
  if (broadcastError) {
    return (
      <div className="space-y-6">
        <Link href="/admin/notifications">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Broadcasts
          </Button>
        </Link>
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          Broadcast not found or failed to load. Please try again.
        </div>
      </div>
    );
  }

  // Loading state
  if (broadcastLoading) {
    return (
      <div className="space-y-6">
        <Link href="/admin/notifications">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Broadcasts
          </Button>
        </Link>
        <Skeleton className="h-48 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!broadcastData?.data) {
    return (
      <div className="space-y-6">
        <Link href="/admin/notifications">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Broadcasts
          </Button>
        </Link>
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          Broadcast not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/admin/notifications">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Broadcasts
        </Button>
      </Link>

      {/* Broadcast Detail */}
      <BroadcastDetailCard broadcast={broadcastData.data} />

      {/* Recipients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BroadcastRecipientsTable
            recipients={recipientsData?.data || []}
            isLoading={recipientsLoading}
          />

          {recipientsData?.pagination && (
            <AdminPagination
              pagination={recipientsData.pagination}
              onPageChange={handlePageChange}
              perPage={recipientsParams.per_page}
              onPerPageChange={handlePerPageChange}
              itemLabel="recipients"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
