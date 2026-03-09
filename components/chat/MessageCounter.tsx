'use client';

import Link from 'next/link';
import { MessageSquare, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { useUserLimits } from '@/lib/hooks/useUserLimits';

/******************************************************************************
                               Types
******************************************************************************/

interface IMessageCounterProps {
  className?: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Compact message counter shown near chat input areas.
 */
function MessageCounter(props: IMessageCounterProps) {
  const { className } = props;
  const { isAuthenticated, isGuest } = useAuthStore();
  const limitsQuery = useUserLimits();

  // Hide for guests and unauthenticated users
  if (!isAuthenticated || isGuest) return null;
  // Hide while loading or on error (non-intrusive)
  if (limitsQuery.isLoading || limitsQuery.isError || !limitsQuery.data?.data) return null;

  const aiMessages = limitsQuery.data.data.ai_messages;
  // Hide for unlimited plans
  if (aiMessages.remaining === null && aiMessages.total_remaining === null) return null;

  const planRemaining = aiMessages.remaining ?? 0;
  const paygRemaining = aiMessages.payg_remaining;
  const totalRemaining = aiMessages.total_remaining ?? 0;
  const isUsingPayg = planRemaining === 0 && paygRemaining > 0;
  const isExhausted = totalRemaining === 0;

  // Exhausted — show warning with buy link
  if (isExhausted) {
    return (
      <div className={cn('flex items-center justify-center gap-1.5 py-1', className)}>
        <AlertTriangle className="size-3 text-amber-500" />
        <span className="text-xs text-amber-600 dark:text-amber-400">
          No messages remaining
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <Link
          href="/settings/message-packs"
          className="text-xs font-medium text-primary hover:underline"
        >
          Buy more
        </Link>
      </div>
    );
  }

  // Using PAYG messages
  if (isUsingPayg) {
    return (
      <div className={cn('flex items-center justify-center gap-1.5 py-1', className)}>
        <MessageSquare className="size-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Using PAYG messages ({paygRemaining} left)
        </span>
      </div>
    );
  }

  // Normal — show total remaining
  return (
    <div className={cn('flex items-center justify-center gap-1.5 py-1', className)}>
      <MessageSquare className="size-3 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {totalRemaining} {totalRemaining === 1 ? 'message' : 'messages'} remaining
      </span>
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default MessageCounter;
