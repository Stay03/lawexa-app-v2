'use client';

import { useQuery } from '@tanstack/react-query';

import { useV2Session } from '@/v2/runtime/session-context';
import { sharingQueries } from './queries';
import { withReferral } from './referral-link';

/**
 * Turns a link into the link this person should share.
 *
 * For an ambassador that means their code is on it, so a signup from it credits
 * them. For everybody else it is the address unchanged, which is what the app
 * has always copied.
 *
 * ── IT NEVER BLOCKS THE SHARE ─────────────────────────────────────────────
 * The lookup behind it resolves to no-code on any failure, so a share sheet
 * opens at once whether or not the answer has arrived. The worst case is a
 * shared link without a code on it — the behaviour we have today — and never a
 * share that hangs or errors because somebody is not an ambassador.
 *
 * ── DO NOT REACH FOR THIS ON ADMIN SCREENS ────────────────────────────────
 * Twenty three places in this app build a share link and several are internal:
 * an admin user panel, a webhook detail sheet, an invoice table. Those copy
 * addresses for support work, not for the public, and putting a referral code on
 * them would credit staff for their own admin links. This is for the screens a
 * reader shares from.
 */
export function useShareUrl(): (url: string) => string {
  const { userId } = useV2Session();
  const { data: code } = useQuery(sharingQueries.referralCode(userId));

  /* Not memoised deliberately. It closes over one string and callers use it
     inside an event handler, so a new function per render costs nothing and a
     dependency array here would be one more thing to get wrong. */
  return (url: string) => withReferral(url, code ?? null);
}
