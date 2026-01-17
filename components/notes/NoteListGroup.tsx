'use client';

import { cn } from '@/lib/utils';

interface NoteListGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container wrapper for note list items with shared borders and dividers
 */
function NoteListGroup({ children, className }: NoteListGroupProps) {
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

export { NoteListGroup };
