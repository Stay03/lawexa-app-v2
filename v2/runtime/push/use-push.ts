'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  pushCapability,
  SERVER_PUSH_CAPABILITY,
  type PushCapability,
} from './capability';
import { disablePushOnThisDevice, enablePushOnThisDevice } from './register';
import {
  dismissPushNudge,
  notificationPermission,
  usePushDeviceState,
} from './state';

/**
 * usePushEnablement — the React face of the push device lifecycle, for the two
 * surfaces a person can act on: the in-channel nudge and the bell's Push
 * switch. Everything else (boot re-sync, the identity edge) is owned by
 * `./lifecycle.tsx` and needs no hook.
 *
 * PERMISSION IS READ THROUGH `useSyncExternalStore`, not `useState` + effect.
 * `Notification.permission` is browser state that does not exist during SSR,
 * so the server snapshot is `'default'` and the client's real value arrives at
 * hydration — the sanctioned v2 pattern for client-only values (and the reason
 * `setState`-in-an-effect never appears here; React-Compiler lint runs as
 * errors). It has no change event, so the subscribe function is a no-op and
 * the value is re-read after our own calls via the local outcome state.
 */

const noopSubscribe = () => () => {};

function getPermissionSnapshot(): NotificationPermission {
  return notificationPermission() ?? 'default';
}

function getServerPermissionSnapshot(): NotificationPermission {
  return 'default';
}

/**
 * What the in-channel bar should say, or `null` for "say nothing".
 *  - `enable`  — the ask (permission is genuinely undecided);
 *  - `install` — iOS in a tab: the platform grants web push only to an
 *    installed PWA, so the honest bar teaches instead of prompting;
 *  - `blocked` — the person refused, or their browser refuses for them. NOT
 *    silence (audit M4): from the inside, a blocked site is indistinguishable
 *    from a broken one, and the only cure lives in browser settings where we
 *    cannot take them. One line, dismissible, no button that would lie.
 */
export type PushNudgeMode = 'enable' | 'install' | 'blocked';

export interface PushEnablement {
  capability: PushCapability;
  /** Live permission, or the outcome of the request we just made. */
  permission: NotificationPermission;
  /** Push is genuinely live on this device (registered AND still permitted). */
  isOn: boolean;
  /** What the in-channel bar should show; `null` = nothing to say. */
  nudgeMode: PushNudgeMode | null;
  /** A call is in flight, so controls can disable themselves and say so. */
  isBusy: boolean;
  /** One gesture: permission + registration. Safe to call once per click. */
  enable: () => Promise<void>;
  /** The switch. `false` records an explicit no and tears the token down. */
  setEnabled: (next: boolean) => Promise<void>;
  /** Dismiss the bar on this device, permanently (the v1 contract, kept). */
  dismiss: () => void;
}

export function usePushEnablement(): PushEnablement {
  const capability = useSyncExternalStore(
    noopSubscribe,
    pushCapability,
    () => SERVER_PUSH_CAPABILITY,
  );
  const livePermission = useSyncExternalStore(
    noopSubscribe,
    getPermissionSnapshot,
    getServerPermissionSnapshot,
  );
  const device = usePushDeviceState();

  // The permission the browser reported to OUR request. `Notification
  // .permission` has no change event, so without this the bar would keep
  // asking after a grant until the next unrelated render pass.
  const [outcome, setOutcome] = useState<NotificationPermission | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const permission = outcome ?? livePermission;

  const enable = useCallback(async () => {
    setIsBusy(true);
    try {
      setOutcome(await enablePushOnThisDevice());
    } finally {
      setIsBusy(false);
    }
  }, []);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (next) {
        await enable();
        return;
      }
      setIsBusy(true);
      try {
        await disablePushOnThisDevice();
      } finally {
        setIsBusy(false);
      }
    },
    [enable],
  );

  const nudgeMode: PushNudgeMode | null = device.nudgeDismissed
    ? null
    : capability.requiresInstall
      ? 'install'
      : !capability.supported
        ? null
        : permission === 'default'
          ? 'enable'
          : permission === 'denied'
            ? 'blocked'
            : null;

  return {
    capability,
    permission,
    isOn: device.token !== null && permission === 'granted',
    nudgeMode,
    isBusy,
    enable,
    setEnabled,
    dismiss: dismissPushNudge,
  };
}
