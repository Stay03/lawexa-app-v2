'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LimitsSettingsContent } from '@/components/admin/settings/LimitsSettingsContent';

function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-[260px]" />
      <Skeleton className="h-4 w-[420px]" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-6 w-[150px]" />
          <div className="rounded-lg border p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <LimitsSettingsContent />
    </Suspense>
  );
}
