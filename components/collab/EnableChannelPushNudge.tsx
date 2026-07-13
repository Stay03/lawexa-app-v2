'use client';

import { Bell, Share, X } from 'lucide-react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';

/**
 * Slim, dismissible "enable notifications" bar shown once the user is inside a
 * channel they belong to — the earned moment the backend recommends over a
 * page-load prompt. The button requests permission AND registers the FCM device
 * token in one user gesture. Hidden once permission is set or the user dismisses
 * it (dismissal is shared with the chat nudge, so we never double-nag). On iOS in
 * a browser tab it shows an install hint instead of a prompt.
 */
export function EnableChannelPushNudge() {
  const { showNudge, dismissNudge, supported, requiresInstall, enable } =
    usePushNotifications();

  if (!showNudge || (!supported && !requiresInstall)) return null;

  return (
    <div className="shrink-0 border-b bg-muted/40 px-4 py-2">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 text-sm">
        <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
        {requiresInstall ? (
          <span className="text-muted-foreground">
            <Share className="mr-1 inline h-3.5 w-3.5" />
            Add Lawexa to your Home Screen to get notified about mentions and
            replies.
          </span>
        ) : (
          <span className="text-muted-foreground">
            Get notified about mentions and replies, even when Lawexa is closed.{' '}
            <button
              type="button"
              onClick={() => void enable()}
              className="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
            >
              Enable notifications
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={dismissNudge}
          className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
