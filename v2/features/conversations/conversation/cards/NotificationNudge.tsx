'use client';

import { useCallback, useState } from 'react';
import { Bell } from 'lucide-react';

import { useMounted } from '@/v2/shell/use-mounted';

/**
 * Self-contained v2-native replacement for v1's `NotificationNudge`, which
 * pulled its state from `@/lib/hooks/useBrowserNotifications` +
 * `@/lib/stores/notificationPrefsStore` — both blocked by the v2 import
 * boundary. The behaviour is reproduced inline: read `Notification.permission`,
 * persist a dismissed flag to `localStorage`, and only surface the nudge while
 * the browser permission is still `default` and the user hasn't dismissed it.
 * Visual output/copy is a verbatim port of v1.
 */
const NUDGE_DISMISSED_KEY = 'lawexa-v2-notif-nudge-dismissed';

function readNudgeDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(NUDGE_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function readPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'default';
  return Notification.permission;
}

function useNotificationNudge() {
  // `useMounted` keeps the first paint identical on server and client (both
  // render nothing) so the client-only permission / localStorage reads below
  // never cause a hydration mismatch.
  const mounted = useMounted();
  const [permission, setPermission] = useState<NotificationPermission>(readPermission);
  const [nudgeDismissed, setNudgeDismissed] = useState<boolean>(readNudgeDismissed);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied' as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const dismissNudge = useCallback(() => {
    setNudgeDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(NUDGE_DISMISSED_KEY, 'true');
      } catch {
        // Ignore write failures (private mode / storage disabled).
      }
    }
  }, []);

  const showNudge = mounted && permission === 'default' && !nudgeDismissed;

  return { showNudge, requestPermission, dismissNudge };
}

export function NotificationNudge() {
  const { showNudge, requestPermission, dismissNudge } = useNotificationNudge();

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
