'use client';

import { cn } from '@/lib/utils';

interface ConversationListGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container wrapper for conversation list items with shared borders and dividers
 */
function ConversationListGroup({ children, className }: ConversationListGroupProps) {
  return (
    <div
      className={cn(
        'divide-y divide-border overflow-hidden rounded-lg',
        className
      )}
    >
      {children}
    </div>
  );
}

export { ConversationListGroup };
