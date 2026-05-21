'use client';

import { cn } from '@/lib/utils';

interface ConfidentialFileNoticeProps {
  className?: string;
  hours?: number;
}

export function ConfidentialFileNotice({ className, hours = 24 }: ConfidentialFileNoticeProps) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Files in confidential chats are kept for up to {hours} hours, then permanently deleted. Make a local copy if you need to keep this file.
    </p>
  );
}
