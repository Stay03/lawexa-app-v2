'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BillingSettingsContent } from '@/components/admin/billing/BillingSettingsContent';

function BillingSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-[250px]" />
      <Skeleton className="h-4 w-[400px]" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-6 w-[150px]" />
          <div className="rounded-lg border p-6 space-y-4">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-6 w-[60px]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BillingSettingsPage() {
  return (
    <Suspense fallback={<BillingSettingsSkeleton />}>
      <BillingSettingsContent />
    </Suspense>
  );
}
