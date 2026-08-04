'use client';

import { useId } from 'react';
import { BellOff, MessageSquareDot, Smartphone, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePushEnablement } from '@/v2/runtime/push/use-push';
import {
  setNotificationsPaused,
  setNotifySound,
  setNotifyToast,
  useNotifyPreferences,
} from '@/v2/runtime/realtime/preferences';

/**
 * NotificationDeliveryControls — every switch that decides how this DEVICE is
 * told about a mention: the in-app alert, its sound, closed-app push, and the
 * pause (foundation-standards §5, plan W1 item 3, plan W5 item 1).
 *
 * WHY THEY ARE ONE GROUP. A person does not think "toast preference" and "push
 * registration"; they think "how do I hear about this, and where". Splitting
 * three of them into the bell and the fourth into a channel bar is how a
 * product ends up with two settings that quietly contradict each other.
 *
 * BADGES ARE NOT LISTED HERE, AND THAT IS THE CONTRACT. Counts, bold rows, the
 * title "(n)" and the favicon dot always tell the truth — even while paused,
 * even in a muted channel (digest §D). These switches govern INTERRUPTION
 * only, which is why "Pause" reads as "pause alerts" and not "pause
 * notifications".
 *
 * PAUSE DIMS ITS DEPENDANTS RATHER THAN DISABLING THEM. While paused, the
 * alert and sound rows say so (`aria-disabled` + a "Paused" hint) but stay
 * operable — someone arranging their preferences before unpausing must not be
 * locked out of them.
 *
 * PUSH IS A REAL TWO-WAY SWITCH (audit H2). Off records an explicit choice AND
 * deactivates the device token; on runs the same one-gesture permission +
 * registration flow as the in-channel nudge. Before it existed the only way
 * off was v1's settings page, which kills the FCM token without deactivating
 * the row v2 registered — and v2's next boot re-sync then quietly undid the
 * choice. A preference the product overwrites is not a preference.
 */

interface DeliveryRowProps {
  icon: LucideIcon;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Has no effect right now: dimmed + `aria-disabled`, but still operable. */
  inactive?: boolean;
  /** Genuinely unavailable (the platform refuses) — the switch is disabled. */
  disabled?: boolean;
}

function DeliveryRow({
  icon: Icon,
  label,
  hint,
  checked,
  onCheckedChange,
  inactive = false,
  disabled = false,
}: DeliveryRowProps) {
  const id = useId();

  return (
    <li
      className={cn(
        'flex items-start gap-3 py-2.5 transition-opacity duration-150 motion-reduce:transition-none',
        (inactive || disabled) && 'opacity-60',
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <Label
          htmlFor={id}
          className={cn(
            'text-sm font-normal text-foreground',
            !disabled && 'cursor-pointer',
          )}
        >
          {label}
        </Label>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-disabled={inactive || undefined}
        className="mt-0.5 shrink-0"
      />
    </li>
  );
}

export function NotificationDeliveryControls() {
  const prefs = useNotifyPreferences();
  const { capability, permission, isOn, isBusy, setEnabled } = usePushEnablement();

  const pushHint = !capability.supported
    ? capability.requiresInstall
      ? 'Add Lawexa to your Home Screen first'
      : 'Not available in this browser'
    : permission === 'denied'
      ? 'Blocked in your browser settings'
      : 'Reach me when Lawexa is closed';

  return (
    <ul className="flex flex-col divide-y divide-border/60 px-4 py-1">
      <DeliveryRow
        icon={MessageSquareDot}
        label="Mention alerts"
        hint={
          prefs.paused
            ? 'Paused'
            : 'Show a message when someone @mentions you elsewhere'
        }
        checked={prefs.toast}
        onCheckedChange={setNotifyToast}
        inactive={prefs.paused}
      />
      <DeliveryRow
        icon={Volume2}
        label="Sound"
        hint={prefs.paused ? 'Paused' : 'Play a short chime with a mention alert'}
        checked={prefs.sound}
        onCheckedChange={setNotifySound}
        inactive={prefs.paused}
      />
      <DeliveryRow
        icon={Smartphone}
        label="Push notifications"
        hint={pushHint}
        checked={isOn}
        onCheckedChange={(next) => void setEnabled(next)}
        disabled={!capability.supported || permission === 'denied' || isBusy}
      />
      <DeliveryRow
        icon={BellOff}
        label="Pause alerts"
        hint="Stop alerts and sounds. Counts keep updating"
        checked={prefs.paused}
        onCheckedChange={setNotificationsPaused}
      />
    </ul>
  );
}
