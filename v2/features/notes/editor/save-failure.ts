import { AxiosError } from 'axios';

import { extractApiError } from '@/lib/utils/api-error';
import type { AutosaveFailure, SaveRequest } from './autosave-machine';

/**
 * save-failure — turn whatever a failed save threw into the four answers the
 * autosave machine knows how to act on.
 *
 * ── THE TWO 429s ────────────────────────────────────────────────────────────
 * The notes bucket allows 60 saves a minute and overflows with 429. The backend
 * uses the SAME status for a second, unrelated refusal — the plan's cap on how
 * many notes an account may create — and distinguishes them by the presence of
 * `Retry-After` (their 2026-08-04 reply, restated in `../types.ts`). Those two
 * need opposite behaviour: one is a window to wait out, the other is a wall no
 * amount of waiting moves.
 *
 * MODE DISAMBIGUATES WHEN THE HEADER CANNOT BE READ. `Retry-After` is not a
 * CORS-safelisted response header, so a browser can only see it if the API
 * lists it in `Access-Control-Expose-Headers`. If it is invisible, a header-only
 * test would misread every rate limit as a create quota and stop autosaving for
 * the rest of the session. The contract closes that gap: the quota answer is
 * documented as CREATE-ONLY, so a 429 on an UPDATE is unambiguously the rate
 * limit no matter what the headers show, and a header-less 429 on a create is
 * the quota exactly as documented.
 */

/** Hold used when a rate limit gives no readable `Retry-After`. */
const DEFAULT_RATE_LIMIT_HOLD_MS = 30_000;

/** Ceiling on a server-supplied hold, so a bad header cannot park autosave for hours. */
const MAX_RATE_LIMIT_HOLD_MS = 10 * 60 * 1000;

/**
 * Floor on a server-supplied hold. `Retry-After: 0` is legal and a proxy can
 * emit it, but honouring it literally means retrying in the same tick against a
 * server that is still refusing — a spin that burns the notes bucket instead of
 * waiting it out. One second is the smallest honest "come back later".
 */
const MIN_RATE_LIMIT_HOLD_MS = 1_000;

/**
 * Read `Retry-After`, which RFC 9110 allows in two forms: delta-seconds
 * ("120") or an HTTP-date. Returns `null` when the header is absent,
 * unreadable, or already in the past.
 */
export function parseRetryAfter(value: unknown, now: number): number | null {
  const raw = typeof value === 'number' ? String(value) : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (/^\d+$/.test(trimmed)) {
    return clampHold(Number(trimmed) * 1000);
  }

  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  const delta = at - now;
  // A date already in the past says "you may retry now" — which still gets the
  // floor, for the same reason `Retry-After: 0` does.
  if (delta <= 0) return MIN_RATE_LIMIT_HOLD_MS;
  return clampHold(delta);
}

/** Keep a server-supplied hold inside the range that is useful to act on. */
function clampHold(ms: number): number {
  return Math.min(Math.max(ms, MIN_RATE_LIMIT_HOLD_MS), MAX_RATE_LIMIT_HOLD_MS);
}

/** The `Retry-After` value on an axios error, if there is a response at all. */
function retryAfterHeader(error: unknown): unknown {
  if (!(error instanceof AxiosError)) return undefined;
  return error.response?.headers?.['retry-after'];
}

/**
 * Classify a failed save.
 *
 * `mode` is required rather than inferred: it is what separates the two 429s
 * when the header is invisible to the browser (see the header note).
 */
export function classifySaveFailure(
  error: unknown,
  mode: SaveRequest['mode'],
  now: number,
): AutosaveFailure {
  const { status, message } = extractApiError(error);

  if (status === 429) {
    const retryAfterMs = parseRetryAfter(retryAfterHeader(error), now);
    if (retryAfterMs !== null) {
      return { kind: 'rate-limited', retryAfterMs, message };
    }
    if (mode === 'create') {
      return { kind: 'create-quota', message };
    }
    // A 429 on an UPDATE is the rate limit by definition — the quota answer is
    // create-only — so hold for a sensible default rather than giving up.
    return {
      kind: 'rate-limited',
      retryAfterMs: DEFAULT_RATE_LIMIT_HOLD_MS,
      message,
    };
  }

  // `extractApiError` reports 0 for a request that never got a response —
  // offline, DNS, a dropped connection. Worth retrying; so is any 5xx.
  if (status === 0 || status >= 500) {
    return { kind: 'transient', message };
  }

  // Every other 4xx is a settled answer (422 too large, 403 not yours, 404
  // deleted elsewhere). Retrying reproduces it, so the chip states it instead.
  return { kind: 'rejected', message };
}
