import { pushApi } from '@/lib/api/push';
import { getDeviceName } from '@/lib/utils/device-name';
import { pushCapability } from './capability';
import { deleteFcmToken, getFcmToken } from './fcm';
import {
  notificationPermission,
  readPushDeviceState,
  setPushEnabled,
  setPushToken,
} from './state';

/**
 * The push device lifecycle — every call that moves this browser's server-side
 * registration. No React, no JSX: `./lifecycle.tsx` drives it on the identity
 * edge and `./use-push.ts` exposes {@link enablePushOnThisDevice} to the one
 * gesture that may ask for permission.
 *
 * THE CONTRACT (digest §C "Infra" + §F.16):
 *  - `POST /notification-channels/push {token, device_name}` is an IDEMPOTENT
 *    UPSERT keyed by token. Re-registering your own row reactivates it;
 *    registering a token another account holds REASSIGNS it to you — the
 *    backend's stated shared-device rule, and the reason a device handed from
 *    one person to another self-heals without any client bookkeeping.
 *  - `DELETE` on the same path needs a JSON BODY (form-encoded 422s). That is
 *    why every teardown goes through `pushApi.deactivate`, which sends
 *    `{ data: { token } }` — do not hand-roll the call.
 *  - Tokens outside 100–512 chars are rejected server-side; FCM tokens are
 *    well inside that, so we do not pre-validate and invent a second opinion.
 *
 * EVERY FUNCTION HERE IS SILENT ON FAILURE. Push is an enhancement layered on
 * a working in-app notification spine: a failed upsert costs a closed-app
 * notification, never a visible error, and the next boot re-sync retries.
 */

/**
 * Fetch this device's FCM token and upsert it server-side. Idempotent, so it
 * is safe to call on every boot. No-ops when the browser can't do push.
 *
 * THE PERMISSION GUARD LIVES HERE, IN THE CALLEE, ON PURPOSE (audit M2). The
 * installed SDK's `getToken()` does NOT merely resolve null on an undecided
 * permission — it calls `Notification.requestPermission()` itself
 * (`@firebase/messaging` dist, ~line 1457). So a guard in one caller would
 * leave every other caller one line away from firing the exact page-load
 * prompt the nudge exists to avoid. Only an ALREADY-GRANTED permission gets
 * past this line; the one place that may ask a person is
 * {@link enablePushOnThisDevice}, from a user gesture.
 *
 * A NULL TOKEN CLEARS THE MIRROR. If the SDK can no longer produce a token
 * (service worker unregistered, registration revoked, storage evicted), the
 * `token` we have stored is a lie — and `isPushArmed()` reads it. Clearing it
 * is what keeps the dispatcher's dedup honest rather than confidently wrong.
 */
export async function registerPushDevice(): Promise<void> {
  if (!pushCapability().supported) return;
  if (notificationPermission() !== 'granted') return;
  const token = await getFcmToken();
  if (!token) {
    setPushToken(null);
    return;
  }
  try {
    await pushApi.register(token, getDeviceName());
    setPushToken(token);
  } catch {
    // Non-fatal — the next boot re-sync retries.
  }
}

/**
 * Give up this device's registration: deactivate the row server-side, then
 * delete the FCM token locally.
 *
 * THE ORDER IS THE POINT. The REST call needs a live bearer and may well fail
 * (see `./lifecycle.tsx` for the sign-out case, where v1 has already revoked
 * the session); `deleteFcmToken()` needs nothing and is what actually stops
 * this browser receiving anything for the old registration. So the network
 * call is attempted first, its failure is swallowed, and the local deletion
 * always happens.
 */
export async function deactivatePushDevice(): Promise<void> {
  const { token } = readPushDeviceState();
  if (token) {
    try {
      await pushApi.deactivate(token);
    } catch {
      // 404 = not ours / already gone; 401 = the session is already over.
      // Both mean "there is nothing more we can do server-side".
    }
  }
  await deleteFcmToken();
  setPushToken(null);
}

/**
 * Idempotent boot re-sync. The modular FCM SDK has no `onTokenRefresh`, so
 * re-registering on each boot IS how token rotation is handled.
 *
 * Two directions, both self-correcting:
 *  - the OS permission is granted and the viewer has not explicitly turned
 *    push off here → (re)register, which also re-claims the row after a
 *    rotation or a hand-over;
 *  - otherwise, if a token is still recorded → tear it down, so a permission
 *    revoked in browser settings stops a server row from lingering.
 *
 * A GRANTED PERMISSION WITH NO RECORDED CHOICE COUNTS AS YES. The only thing
 * in this product that ever calls `requestPermission()` is a push nudge, so a
 * grant IS the agreement — and the device that granted it on a v1 page has no
 * v2 record at all (v1's store is boundary-invisible). Reading that silence as
 * "no" would leave exactly those users un-armed, and therefore double-chimed
 * (the dedup rule keys on `isPushArmed()`). An EXPLICIT `false` — the off
 * switch in the notification bell — is honoured for good, which is what the
 * three-valued `enabled` exists for.
 *
 * IT ALSO BAILS WHEN THE DEVICE CAN NO LONGER PRODUCE A TOKEN:
 * {@link registerPushDevice} clears the stored token in that case, so a boot
 * against a dead registration leaves the mirror empty rather than re-asserting
 * a subscription that does not exist.
 */
export async function syncPushDevice(): Promise<void> {
  const state = readPushDeviceState();
  const granted = notificationPermission() === 'granted';
  if (granted && state.enabled !== false && pushCapability().supported) {
    await registerPushDevice();
    return;
  }
  if (state.token) await deactivatePushDevice();
}

/**
 * THE ONE GESTURE (the nudge button, and the bell's Push switch on its way
 * ON). Requests permission if it has not been decided, then records the choice
 * and registers — one click, one flow, no second confirmation step. MUST be
 * called from a user gesture: browsers refuse
 * `Notification.requestPermission()` outside one, and this is the ONLY place
 * in v2 permitted to ask.
 *
 * Returns the resulting permission so the caller can render the outcome
 * ('denied' is a real answer and must not read as a failure).
 */
export async function enablePushOnThisDevice(): Promise<NotificationPermission> {
  if (!pushCapability().supported) return 'denied';
  let permission = notificationPermission() ?? 'denied';
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return permission;
  setPushEnabled(true);
  await registerPushDevice();
  return permission;
}

/**
 * THE OFF SWITCH (audit H2). Records the explicit "no" FIRST, then tears the
 * registration down — order matters, because the teardown is asynchronous and
 * a boot re-sync racing it must already see the decision.
 *
 * This exists because the alternative shipped in its place was worse than
 * nothing: "turn it off in v1's settings" kills the FCM token without
 * deactivating the row v2 registered, and then v2's own boot re-sync
 * re-registers the device and quietly undoes the user's choice. A preference
 * the product overwrites is not a preference.
 */
export async function disablePushOnThisDevice(): Promise<void> {
  setPushEnabled(false);
  await deactivatePushDevice();
}
