'use client';

import { cn } from '@/lib/utils';

interface CaseListGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container wrapper for case list items with shared borders and dividers
 */
function CaseListGroup({ children, className }: CaseListGroupProps) {
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

export { CaseListGroup };
