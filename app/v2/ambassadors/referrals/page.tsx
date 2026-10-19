import { redirect } from 'next/navigation';

/**
 * AMBASSADOR REFERRALS ADDRESS → `/settings/referrals`.
 *
 * The approval email and the ambassadors landing page link to
 * `/ambassadors/referrals`, a shared screen that sits outside both the v1 and
 * the v2 trees (`app/ambassadors/referrals/page.tsx`), so a reader of the new
 * design landed on it with no menu, no header and no way back (Tester Claude's
 * walk, 18 October 2026; v2 Stage 1, item 10). v2 already holds the same
 * screen, the same states and rules in v2's design, at `/settings/referrals`.
 * This is a redirect shell onto it by the manifest-scoped, TEMPORARY-redirect
 * mechanism of the invitation shells (see `app/v2/channel-invitations/page.tsx`):
 * only a request carrying the v2 cookie is rewritten here, and a v1 reader keeps
 * the shared page untouched.
 *
 * Retire with v1, not before.
 */
export default function V2AmbassadorReferralsRedirect(): never {
  redirect('/settings/referrals');
}
