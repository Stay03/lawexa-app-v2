'use client';

import { useEffect } from 'react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';

/**
 * Render-nothing boot sync for closed-app push, mounted once beside
 * RealtimeNotifications in the main layout. When the user has already granted
 * notification permission, it re-affirms the FCM device token on each app boot
 * (the modular SDK has no onTokenRefresh, so re-registering is how token rotation
 * is handled). Registration is an idempotent upsert, so this is safe to run freely.
 */
export function PushRegistrar() {
  const { syncToken } = usePushNotifications();

  useEffect(() => {
    void syncToken();
  }, [syncToken]);

  return null;
}
