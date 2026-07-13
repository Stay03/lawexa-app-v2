import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationPrefsStore {
  enableNotifications: boolean;
  enableSounds: boolean;
  nudgeDismissed: boolean;
  // The FCM token last registered for THIS device, so we know what to re-sync on
  // boot and what to deactivate on logout/disable. null = no device registered.
  pushToken: string | null;
  setEnableNotifications: (value: boolean) => void;
  setEnableSounds: (value: boolean) => void;
  dismissNudge: () => void;
  setPushToken: (token: string | null) => void;
}

export const useNotificationPrefsStore = create<NotificationPrefsStore>()(
  persist(
    (set) => ({
      enableNotifications: true,
      enableSounds: true,
      nudgeDismissed: false,
      pushToken: null,

      setEnableNotifications: (value) => set({ enableNotifications: value }),
      setEnableSounds: (value) => set({ enableSounds: value }),
      dismissNudge: () => set({ nudgeDismissed: true }),
      setPushToken: (token) => set({ pushToken: token }),
    }),
    {
      name: 'lawexa-notification-prefs',
    }
  )
);
