'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCurrentSubscription } from '@/lib/hooks/useSubscriptions';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'lawexa-upgrade-pill-dismissed';

interface UpgradePillProps {
  className?: string;
}

export function UpgradePill({ className }: UpgradePillProps) {
  const { isAuthenticated, isGuest } = useAuth();
  const { data } = useCurrentSubscription();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(
      typeof window !== 'undefined' &&
        window.localStorage.getItem(DISMISSED_KEY) === 'true'
    );
  }, []);

  // Treat missing subscription data as free-tier (non-subscribed).
  const isFreeTier = data?.data ? data.data.is_free_tier : true;

  if (!isAuthenticated || isGuest || !isFreeTier || dismissed) {
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
      <span>Upgrade</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="-mr-1 rounded-full p-0.5 text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
      >
        <X className="h-3 w-3" />
      </button>
    </Link>
  );
}
