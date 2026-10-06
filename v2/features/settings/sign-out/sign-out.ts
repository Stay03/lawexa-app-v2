import type { QueryClient } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { clearAllTranscripts } from '@/v2/runtime/chat-engine';
import { clearDeviceCache } from '@/v2/runtime/persist/device-cache';
import { deactivatePushDevice } from '@/v2/runtime/push/register';

/**
 * Sign this device out, the way v1's `useAuth().logout` does, plus the one
 * thing only v2 has: its own httpOnly session cookie.
 *
 * In order, and each step best-effort, because a device that stays signed in
 * after "Sign out" is worse than a server call that did not land:
 *  1. Stop this device's push notifications while the bearer is still valid
 *     (a shared phone must stop receiving this person's alerts). v2's own
 *     push module does it: the server row, then the browser's registration.
 *  2. Revoke the token on the server.
 *  3. Delete the confidential chats kept in this browser: they are device-only
 *     and must not outlive the session that wrote them.
 *  4. Clear the login and every cached query.
 *  5. Clear v2's session cookie (`DELETE /api/session`). `SessionSync` would do
 *     it on its next run, but the caller leaves the page straight away.
 *
 * v1 clears local state only when the server call succeeds; this does not wait
 * on it. A failed revoke leaves a token the server still honours, which is the
 * lesser harm next to a device that still opens this person's account.
 *
 * Note drafts are not touched: `draft-mirror` stamps each with its account and
 * never shows one account's draft to another.
 */
export async function signOutOfThisDevice(queryClient: QueryClient): Promise<void> {
  try {
    await deactivatePushDevice();
  } catch {
    // Push is optional on this device (no permission, no Firebase): nothing to stop.
  }

  try {
    await authApi.logout();
  } catch {
    // Token revoke failed (offline, already expired): sign the device out anyway.
  }

  try {
    await clearAllTranscripts();
  } catch {
    // IndexedDB unavailable (private mode): there is nothing stored to delete.
  }
  // The pages and lists kept on this device for this account. The identity
  // guard deletes them again on the sign-out edge; this is for the path that
  // leaves the page at once. It never throws.
  await clearDeviceCache();
  useAuthStore.getState().clearAuth();
  queryClient.clear();

  try {
    await fetch('/api/session', { method: 'DELETE' });
  } catch {
    // The cookie is cleared by SessionSync on the next visit if this failed.
  }
}
