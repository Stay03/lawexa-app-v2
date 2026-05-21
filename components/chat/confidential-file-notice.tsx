'use client';

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfidentialFileNoticeProps {
  className?: string;
  hours?: number;
}

export function ConfidentialFileNotice({ className, hours = 24 }: ConfidentialFileNoticeProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
        className,
      )}
    >
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Files in confidential chats are kept for up to {hours} hours, then permanently deleted. Make a local copy if you need to keep this file.
      </span>
    </div>
  );
}
