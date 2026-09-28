import type { Session } from '@/types/auth';

/**
 * Signed-in devices — the pure part: how one `GET /auth/sessions` entry is
 * named, which icon kind it gets, and how the list is ordered. No React, so it
 * is tested with Node's runner (`npm test`).
 */

export type DeviceKind = 'desktop' | 'phone' | 'tablet' | 'other';

/**
 * What the row calls the device, most specific first:
 *   "Chrome on Windows"   browser and platform both known
 *   "Chrome" / "Windows"  only one of them known
 *   device.name           the API's own name for it (a script shows "Curl")
 *   session.name          the token's name
 *   "Unknown device"      nothing at all
 */
export function deviceLabel(session: Session): string {
  const device = session.device;
  const browser = device?.browser?.trim();
  const platform = device?.platform?.trim();
  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return platform;
  const name = device?.name?.trim() || session.name?.trim();
  return name || 'Unknown device';
}

export function deviceKind(session: Session): DeviceKind {
  const type = session.device?.type;
  if (type === 'desktop' || type === 'phone' || type === 'tablet') return type;
  return 'other';
}

/**
 * The device you are reading on, and every other one, most recently used
 * first. A session with no `last_used_at` sorts last. When the API marks no
 * session as current (it should always mark one), `current` is null and every
 * session is listed with the others.
 */
export function splitSessions(sessions: readonly Session[]): {
  current: Session | null;
  others: Session[];
} {
  const current = sessions.find((session) => session.is_current) ?? null;
  const others = sessions
    .filter((session) => session !== current)
    .sort((a, b) => lastUsed(b) - lastUsed(a));
  return { current, others };
}

function lastUsed(session: Session): number {
  const time = session.last_used_at ? Date.parse(session.last_used_at) : NaN;
  return Number.isNaN(time) ? -Infinity : time;
}
