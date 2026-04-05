'use client';

import { Bell } from 'lucide-react';
import { useBrowserNotifications } from '@/lib/hooks/useBrowserNotifications';

export function NotificationNudge() {
  const { showNudge, requestPermission, dismissNudge } = useBrowserNotifications();

  if (!showNudge) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Bell className="size-3 shrink-0" />
      <span>
        Want to be notified when this is ready?{' '}
        <button
          type="button"
          onClick={requestPermission}
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Enable notifications
        </button>
      </span>
      <button
        type="button"
        onClick={dismissNudge}
        className="ml-auto shrink-0 hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
