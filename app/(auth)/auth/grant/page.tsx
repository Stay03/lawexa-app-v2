import { Suspense } from 'react';
import { GrantAuth } from '@/components/auth/GrantAuth';

export default function GrantPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <GrantAuth />
      </Suspense>
    </div>
  );
}
