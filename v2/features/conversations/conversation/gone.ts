import { statusOf } from '@/v2/runtime/persist/policy';

/**
 * Has the server stopped serving a conversation the screen already holds?
 *
 * A conversation deleted (or made private, or no longer shared with this
 * reader) on another device used to stay on screen until a reload: its
 * transcript was in memory, and the re-read on arrival answered 404 while the
 * screen kept the old record (found 7 October 2026, owner's phone test). A
 * failed RE-read (`isRefetchError`: the query had data, the next read failed)
 * with 403, 404 or 410 now means the screen shows "not available".
 *
 * A FIRST read that fails is not this case: the mount flow already maps a 404
 * there to "not available" (`historyErrorMessage`). A 401 is not "gone": the
 * session ended, and the identity guard handles that for every screen. A
 * timeout, 429 or 5xx is a failed request, not a removed conversation.
 */
export function goneOnServer(query: { isRefetchError: boolean; error: unknown }): boolean {
  if (!query.isRefetchError) return false;
  const status = statusOf(query.error);
  return status === 403 || status === 404 || status === 410;
}
