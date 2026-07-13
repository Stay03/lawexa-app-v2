'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useNotificationPrefsStore } from '@/lib/stores/notificationPrefsStore';
import { useBrowserNotifications } from '@/lib/hooks/useBrowserNotifications';
import { pushApi } from '@/lib/api/push';
import {
  deletePushToken,
  getPushToken,
  isFirebaseConfigured,
} from '@/lib/firebase/messaging';
import { getDeviceName } from '@/lib/utils/device-name';
import {
  getIosBrowser,
  isIOS,
  isStandaloneDisplay,
  type IosBrowser,
} from '@/lib/utils/pwa';

interface PushCapability {
  /** The browser + deploy config can actually do FCM web push here. */
  supported: boolean;
  /** iOS in a browser tab — web push needs an installed PWA first. */
  requiresInstall: boolean;
  iosBrowser: IosBrowser;
}

const SERVER_CAPABILITY: PushCapability = {
  supported: false,
  requiresInstall: false,
  iosBrowser: 'other',
};

// Capability is fixed for the session, so we compute once and cache the object.
// Returning a stable reference is required — useSyncExternalStore loops on a fresh
// object each read (see the Zustand stable-ref rule).
let cachedCapability: PushCapability | null = null;

function getCapabilitySnapshot(): PushCapability {
  if (cachedCapability) return cachedCapability;
  const requiresInstall = isIOS() && !isStandaloneDisplay();
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    isFirebaseConfigured() &&
    !requiresInstall;
  cachedCapability = { supported, requiresInstall, iosBrowser: getIosBrowser() };
  return cachedCapability;
}

const noopSubscribe = () => () => {};

/**
 * Closed-app push, layered on the shared `Notification.permission` grant that also
 * powers the foreground `browserNotify` path. `enable()` MUST be called from a user
 * gesture (browser requirement for `requestPermission`). `syncToken()` is the
 * idempotent boot re-sync (there is no `onTokenRefresh` in the modular SDK).
 */
export function usePushNotifications() {
  const { permission, requestPermission, showNudge, dismissNudge } =
    useBrowserNotifications();
  const enableNotifications = useNotificationPrefsStore((s) => s.enableNotifications);
  const setEnableNotifications = useNotificationPrefsStore((s) => s.setEnableNotifications);
  const pushToken = useNotificationPrefsStore((s) => s.pushToken);
  const setPushToken = useNotificationPrefsStore((s) => s.setPushToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);

  const capability = useSyncExternalStore(
    noopSubscribe,
    getCapabilitySnapshot,
    () => SERVER_CAPABILITY
  );

  const canRegister = isAuthenticated && !isGuest && capability.supported;

  // Fetch this device's FCM token and upsert it server-side. Idempotent; updates
  // the stored token if it rotated. Silent no-op when we can't/shouldn't register.
  const register = useCallback(async () => {
    if (!isAuthenticated || isGuest || !capability.supported) return;
    const token = await getPushToken();
    if (!token) return;
    try {
      await pushApi.register(token, getDeviceName());
      setPushToken(token);
    } catch {
      // non-fatal — a later boot sync retries
    }
  }, [isAuthenticated, isGuest, capability.supported, setPushToken]);

  // Deactivate this device server-side and drop the local token. Best-effort.
  const disable = useCallback(async () => {
    if (pushToken) {
      try {
        await pushApi.deactivate(pushToken);
      } catch {
        // 404 (already gone) is fine
      }
    }
    await deletePushToken();
    setPushToken(null);
  }, [pushToken, setPushToken]);

  // Gesture entry point (nudge + Settings "Enable"): request permission if needed,
  // then flip the master pref on and register. Returns the resulting permission.
  const enable = useCallback(async (): Promise<NotificationPermission> => {
    if (!capability.supported) return 'denied';
    let result: NotificationPermission =
      typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    if (result === 'default') {
      result = await requestPermission();
    }
    if (result !== 'granted') return result;
    setEnableNotifications(true);
    await register();
    return result;
  }, [capability.supported, requestPermission, setEnableNotifications, register]);

  // Settings switch (permission already granted): flip the master pref and
  // register/deactivate to match. The pref also governs the foreground path.
  const setPushEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        await enable();
        return;
      }
      setEnableNotifications(false);
      await disable();
    },
    [enable, disable, setEnableNotifications]
  );

  // Idempotent boot re-sync (PushRegistrar): register when permission is already
  // granted and the master pref is on; otherwise clean up a lingering token.
  const syncToken = useCallback(async () => {
    if (!isAuthenticated || isGuest) return;
    const granted =
      typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (granted && enableNotifications && capability.supported) {
      await register();
    } else if (pushToken) {
      await disable();
    }
  }, [
    isAuthenticated,
    isGuest,
    enableNotifications,
    capability.supported,
    pushToken,
    register,
    disable,
  ]);

  return {
    permission,
    enableNotifications,
    isRegistered: pushToken !== null,
    supported: capability.supported,
    requiresInstall: capability.requiresInstall,
    iosBrowser: capability.iosBrowser,
    canRegister,
    // Shared "should we nudge?" gate (permission unset + not dismissed) and its
    // dismissal — the same flag the chat nudge uses, so we never double-nag.
    showNudge,
    dismissNudge,
    enable,
    setPushEnabled,
    disable,
    syncToken,
  };
}
