'use client';

import { cn } from '@/lib/utils';

interface StatuteListGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container wrapper for statute list items with shared borders and dividers
 */
function StatuteListGroup({ children, className }: StatuteListGroupProps) {
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

export { StatuteListGroup };
