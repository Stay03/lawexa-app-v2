'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoFreeMessagesBannerProps {
  className?: string;
}

export function NoFreeMessagesBanner({ className }: NoFreeMessagesBannerProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm',
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-amber-800 dark:text-amber-300">
        You don&apos;t have any free AI messages available.{' '}
        <Link
          href="/pricing"
          className="font-semibold underline hover:text-amber-600 dark:hover:text-amber-200"
        >
          Subscribe to a plan
        </Link>{' '}
        for a monthly message allowance, or{' '}
        <Link
          href="/pricing?tab=payg"
          className="font-semibold underline hover:text-amber-600 dark:hover:text-amber-200"
        >
          buy a message pack
        </Link>{' '}
        to get started right away.
      </p>
    </div>
  );
}
