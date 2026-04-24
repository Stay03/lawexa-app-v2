'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCurrentSubscription } from '@/lib/hooks/useSubscriptions';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'lawexa-get-plus-dismissed';

interface GetPlusPillProps {
  className?: string;
}

export function GetPlusPill({ className }: GetPlusPillProps) {
  const { isAuthenticated, isGuest } = useAuth();
  const { data } = useCurrentSubscription();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(
      typeof window !== 'undefined' &&
        window.localStorage.getItem(DISMISSED_KEY) === 'true'
    );
  }, []);

  const planName = data?.data?.plan?.name ?? 'Free';
  const isFreePlan = planName === 'Free';

  if (!isAuthenticated || isGuest || !isFreePlan || dismissed) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    window.localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <Link
      href="/pricing"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15',
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>Get Plus</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="ml-0.5 -mr-1 rounded-full p-0.5 text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
      >
        <X className="h-3 w-3" />
      </button>
    </Link>
  );
}
