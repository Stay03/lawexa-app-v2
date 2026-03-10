'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminMessagePack } from '@/lib/hooks/useAdmin';
import { AdminMessagePackDetailView } from '@/components/admin/message-packs/AdminMessagePackDetail';

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Message pack detail page.
 */
function MessagePackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = Number(rawId);
  const { data, isLoading, error } = useAdminMessagePack(id);

  // Back button
  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href="/admin/message-packs">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Message Packs
      </Link>
    </Button>
  );

  // Invalid ID
  if (isNaN(id) || id <= 0) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="rounded-lg border py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">Invalid message pack ID</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <Skeleton className="h-8 w-[260px]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[380px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-[200px] rounded-2xl" />
        </div>
      </div>
    );
  }

  // Error / Not found
  if (error || !data?.data) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="rounded-lg border py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">
              {error?.message?.includes('404')
                ? 'Message pack not found'
                : 'Failed to load message pack. Please try again.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const messagePack = data.data;

  return (
    <div className="space-y-6">
      {backLink}

      <h1 className="text-2xl font-semibold tracking-tight">
        Message Pack #{messagePack.id}
      </h1>

      <AdminMessagePackDetailView messagePack={messagePack} />
    </div>
  );
}

export default MessagePackDetailPage;
