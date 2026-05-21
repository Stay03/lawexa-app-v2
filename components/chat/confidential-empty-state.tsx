'use client';

import { useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ConfidentialEmptyState() {
  const router = useRouter();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-600/30 bg-emerald-600/5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <ShieldOff className="h-6 w-6 text-emerald-600 dark:text-emerald-500" />
      </div>
      <h2 className="mb-2 text-xl font-medium">This confidential conversation has ended.</h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Confidential chats stay on your device only. The previous transcript is no longer available.
      </p>
      <Button onClick={() => router.push('/')}>Start new chat</Button>
    </div>
  );
}
