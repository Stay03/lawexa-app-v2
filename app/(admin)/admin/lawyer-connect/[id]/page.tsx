'use client';

import { Suspense } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LawyerConnectDetailCard } from '@/components/admin/lawyer-connect/LawyerConnectDetailCard';
import { useAdminLawyerConnectDetail } from '@/lib/hooks/useAdminLawyerConnect';

interface PageParams {
  id: string;
}

function LawyerConnectDetailContent({ id }: { id: number }) {
  const { data, isLoading, error } = useAdminLawyerConnectDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[120px] rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-[160px] rounded-xl" />
          <Skeleton className="h-[160px] rounded-xl" />
        </div>
        <Skeleton className="h-[120px] rounded-xl" />
        <Skeleton className="h-[180px] rounded-xl" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        Connection request not found or failed to load.
      </div>
    );
  }

  return <LawyerConnectDetailCard request={data.data} />;
}

function LawyerConnectDetailPage({ params }: { params: Promise<PageParams> }) {
  const { id: idStr } = use(params);
  const id = Number(idStr);

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/lawyer-connect">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Requests
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        Connection Request Details
      </h1>

      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-[120px] rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-[160px] rounded-xl" />
              <Skeleton className="h-[160px] rounded-xl" />
            </div>
            <Skeleton className="h-[120px] rounded-xl" />
            <Skeleton className="h-[180px] rounded-xl" />
          </div>
        }
      >
        <LawyerConnectDetailContent id={id} />
      </Suspense>
    </div>
  );
}

export default LawyerConnectDetailPage;
