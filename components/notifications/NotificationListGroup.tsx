'use client';

import { cn } from '@/lib/utils';

interface NotificationListGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container wrapper for notification list items with shared borders and dividers.
 */
function NotificationListGroup({ children, className }: NotificationListGroupProps) {
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

export { NotificationListGroup };
