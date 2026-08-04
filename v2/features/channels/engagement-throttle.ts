import { useSyncExternalStore } from 'react';
import { AxiosError } from 'axios';

/**
 * engagement-throttle — the tiny store behind "a 429 quiets the affordance,
 * it never raises an error". Phase-5 W3; sources: plan W3 item 1 ("60/min
 * throttle surfaced as quiet disable not errors"), design-research DIRECTION 6
 * (the only justified toast family is actionable failures) and the W2 house
 * rule that this screen raises no toasts at all — 2026-08-04.
 *
 * WHY THIS EXISTS AT ALL. Reactions and saves are 60/min each. A reader who
 * sweeps a laughing face across a busy morning WILL hit that ceiling, and the
 * honest response to "you're doing this faster than we allow" is not an error:
 * it is the control going quiet for a moment. Reactions never notify anyone
 * (Campfire's Boosts precedent, binding) — so their failure must not notify
 * either. The rolled-back optimistic chip already tells the truth visually; a
 * disabled tray for a few seconds explains why a second tap does nothing.
 *
 * SCOPE IS THE ACTION FAMILY, NOT THE MESSAGE. The server's window is per user
 * per endpoint, so a 429 on one message means the next message is refused too.
 * Disabling only the row that failed would invite the reader to keep hitting a
 * wall somewhere else.
 *
 * SNAPSHOT CONTRACT (`useSyncExternalStore`): the snapshot is a stored BOOLEAN
 * flipped by a timer, never a `Date.now()` comparison evaluated in
 * `getSnapshot` — a time-derived snapshot changes without a notify and breaks
 * the store's identity contract (React would warn, and could loop).
 */

/**
 * The throttled action families. `reaction` and `bookmark` are 60/min;
 * `ai-reset` is 10/min — much tighter, and much easier to trip by pressing a
 * confirm dialog twice, which is exactly why it belongs here rather than in an
 * error banner (api-digest §C).
 */
export type ThrottleKind = 'reaction' | 'bookmark' | 'ai-reset';

/** Used when the response carries no `Retry-After`. Long enough to be felt as
 *  "slow down", short enough that nobody thinks the feature broke. */
const DEFAULT_COOLDOWN_MS = 15_000;
/** Never hold a control hostage: a hostile/absurd `Retry-After` is clamped. */
const MAX_COOLDOWN_MS = 60_000;

const active = new Map<ThrottleKind, boolean>();
const timers = new Map<ThrottleKind, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * Read a 429's `Retry-After` (seconds, per RFC 9110 — Laravel's throttle
 * middleware sends the integer form). Returns `null` for any other error, so
 * callers can branch on "was this the throttle?" with one call.
 */
export function throttleCooldownMs(error: unknown): number | null {
  if (!(error instanceof AxiosError) || error.response?.status !== 429) return null;
  const header = error.response.headers?.['retry-after'];
  const seconds = typeof header === 'string' ? Number.parseInt(header, 10) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_COOLDOWN_MS;
  return Math.min(seconds * 1000, MAX_COOLDOWN_MS);
}

/**
 * Put an action family to sleep. Returns `true` when the error WAS a throttle
 * (so the caller knows the failure is explained and needs no other surface),
 * `false` for every other error.
 */
export function noteThrottled(kind: ThrottleKind, error: unknown): boolean {
  const cooldown = throttleCooldownMs(error);
  if (cooldown === null) return false;

  const existing = timers.get(kind);
  if (existing) clearTimeout(existing);
  timers.set(
    kind,
    setTimeout(() => {
      timers.delete(kind);
      active.set(kind, false);
      notify();
    }, cooldown),
  );

  if (active.get(kind) !== true) {
    active.set(kind, true);
    notify();
  }
  return true;
}

/** Is this action family cooling down right now? Drives `disabled` + a quiet
 *  explanatory `title`; never an error state, never a toast. */
export function useEngagementThrottled(kind: ThrottleKind): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active.get(kind) ?? false,
    () => false,
  );
}
