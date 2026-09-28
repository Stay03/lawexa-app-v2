'use client';

import { BellOff, MessageSquareDot, Smartphone, Volume2 } from 'lucide-react';

import { usePushEnablement } from '@/v2/runtime/push/use-push';
import {
  setNotificationsPaused,
  setNotifySound,
  setNotifyToast,
  useNotifyPreferences,
} from '@/v2/runtime/realtime/preferences';
import { SETTINGS_COLUMN } from '../SettingsList';
import { SettingsFormGroup } from '../SettingsForm';
import { SettingsToggleRow } from '../SettingsToggleRow';

/**
 * NotificationsScreen — v2 `/settings/notifications`: how THIS DEVICE tells you
 * about a mention. The same four switches as the bell's menu
 * (`v2/shell/NotificationDeliveryControls.tsx`), reading and writing the same
 * stores, so a change in either place shows in the other at once.
 *
 * ── WHY THERE IS NO "BADGE" HERE ───────────────────────────────────────────
 * v1's page shows a push badge read from this browser's storage alone, so it
 * can say "on" for a device the server no longer sends to, or the reverse
 * (the 21 September study). v2 has no badge to fix: the push switch is on
 * only when this device holds a token AND the browser grants permission, and
 * the v2 app re-registers the token with the server on every start
 * (`v2/runtime/push/register.ts`). The switch is the status.
 *
 * ── WHAT IS PER DEVICE ─────────────────────────────────────────────────────
 * Everything on this screen. Alerts, sound and pause live in this browser's
 * storage; push is this device's registration. The screen says so once, under
 * its first heading, rather than on every row.
 *
 * Pause dims the alert and sound rows but leaves them operable, as in the bell
 * menu: someone arranging their choices before unpausing must not be locked
 * out of them. Counts and badges are never paused (they always tell the truth).
 */
export function NotificationsScreen() {
  const prefs = useNotifyPreferences();
  const { capability, permission, isOn, isBusy, setEnabled } = usePushEnablement();

  const pushUnavailable = !capability.supported || permission === 'denied';
  const pushHint = !capability.supported
    ? capability.requiresInstall
      ? 'Add Lawexa to your Home Screen first, then turn this on.'
      : 'This browser cannot receive push notifications.'
    : permission === 'denied'
      ? 'Blocked in your browser settings. Allow notifications for Lawexa there first.'
      : 'Tell me about mentions when Lawexa is closed.';

  return (
    <div className={SETTINGS_COLUMN}>
      <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
        Notifications
      </h1>

      <div className="flex flex-col gap-5">
        <SettingsFormGroup
          id="notifications-open"
          label="While Lawexa is open"
          description="These choices apply to this device only."
        >
          <SettingsToggleRow
            icon={MessageSquareDot}
            label="Mention alerts"
            hint={
              prefs.paused
                ? 'Paused'
                : 'Show a message when someone mentions you in another channel.'
            }
            checked={prefs.toast}
            onCheckedChange={setNotifyToast}
            dimmed={prefs.paused}
          />
          <SettingsToggleRow
            icon={Volume2}
            label="Sound"
            hint={prefs.paused ? 'Paused' : 'Play a short chime with a mention alert.'}
            checked={prefs.sound}
            onCheckedChange={setNotifySound}
            dimmed={prefs.paused}
          />
        </SettingsFormGroup>

        <SettingsFormGroup id="notifications-closed" label="When Lawexa is closed">
          <SettingsToggleRow
            icon={Smartphone}
            label="Push notifications"
            hint={pushHint}
            checked={isOn}
            onCheckedChange={(next) => void setEnabled(next)}
            disabled={pushUnavailable || isBusy}
          />
        </SettingsFormGroup>

        <SettingsFormGroup id="notifications-pause" label="Pause">
          <SettingsToggleRow
            icon={BellOff}
            label="Pause alerts"
            hint="Stop alerts and sounds for now. Unread counts keep updating."
            checked={prefs.paused}
            onCheckedChange={setNotificationsPaused}
          />
        </SettingsFormGroup>
      </div>
    </div>
  );
}
