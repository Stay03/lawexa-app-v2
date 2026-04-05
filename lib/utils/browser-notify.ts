import { useNotificationPrefsStore } from '@/lib/stores/notificationPrefsStore';

let audioCache: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioCache) {
    audioCache = new Audio('/sounds/notification.mp3');
  }
  return audioCache;
}

export function browserNotify(title: string, body: string) {
  if (typeof document === 'undefined' || !document.hidden) return;

  const state = useNotificationPrefsStore.getState();

  if (state.enableSounds) {
    const audio = getAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  if (
    state.enableNotifications &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    try {
      const n = new Notification(title, {
        body,
        icon: '/android-chrome-192x192.png',
        tag: 'lawexa-chat',
      });
      setTimeout(() => n.close(), 5000);
    } catch {
      // Notification constructor can throw in some contexts
    }
  }
}
