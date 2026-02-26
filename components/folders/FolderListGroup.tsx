'use client';

import { cn } from '@/lib/utils';

interface FolderListGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container wrapper for folder list items with shared borders and dividers
 */
function FolderListGroup({ children, className }: FolderListGroupProps) {
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

export { FolderListGroup };
