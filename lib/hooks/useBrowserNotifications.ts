'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNotificationPrefsStore } from '@/lib/stores/notificationPrefsStore';

export function useBrowserNotifications() {
  const {
    enableNotifications,
    enableSounds,
    nudgeDismissed,
    setEnableNotifications,
    setEnableSounds,
    dismissNudge,
  } = useNotificationPrefsStore();

  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied' as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const showNudge = permission === 'default' && !nudgeDismissed;

  return {
    enableNotifications,
    enableSounds,
    setEnableNotifications,
    setEnableSounds,
    permission,
    requestPermission,
    showNudge,
    dismissNudge,
  };
}
