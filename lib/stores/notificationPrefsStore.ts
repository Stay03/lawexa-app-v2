import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationPrefsStore {
  enableNotifications: boolean;
  enableSounds: boolean;
  nudgeDismissed: boolean;
  setEnableNotifications: (value: boolean) => void;
  setEnableSounds: (value: boolean) => void;
  dismissNudge: () => void;
}

export const useNotificationPrefsStore = create<NotificationPrefsStore>()(
  persist(
    (set) => ({
      enableNotifications: true,
      enableSounds: true,
      nudgeDismissed: false,

      setEnableNotifications: (value) => set({ enableNotifications: value }),
      setEnableSounds: (value) => set({ enableSounds: value }),
      dismissNudge: () => set({ nudgeDismissed: true }),
    }),
    {
      name: 'lawexa-notification-prefs',
    }
  )
);
