'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getEcho } from '@/lib/realtime/echo';
import { useCurrentUserUuid } from '@/lib/hooks/useCollab';
import { notificationKeys } from '@/lib/hooks/useNotifications';
import { useAuthStore } from '@/lib/stores/authStore';
import { canAccessSpaces } from '@/lib/utils/spaces-access';

/**
 * App-wide realtime bridge: subscribes to the caller's private user channel and
 * refreshes the notification badge caches when a live notification lands. Mounted
 * once in the authenticated shell; renders nothing.
 */
export function RealtimeNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const canSpaces = canAccessSpaces(useAuthStore((s) => s.user?.role));
  const myUuid = useCurrentUserUuid();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Realtime rides the Spaces (Channels) socket — only connect for the
    // soft-launch audience so the feature stays dark for everyone else.
    if (!isAuthenticated || isGuest || !canSpaces || !myUuid) return;
    const echo = getEcho();
    if (!echo) return;

    const name = `users.${myUuid}`;
    echo.private(name).notification(() => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });

    return () => {
      echo.leave(name);
    };
  }, [isAuthenticated, isGuest, canSpaces, myUuid, queryClient]);

  return null;
}
