import { redirect } from 'next/navigation';

/**
 * LEGACY ADDRESS → `/invitations` (owner decision D5; study A7).
 *
 * v1 served one invitations view from four URLs. v2 has one surface, so the
 * three legacy paths become redirect shells. The mechanism is deliberate:
 *
 *  - the path is in `v2/routes.manifest.ts`, so ONLY a request carrying the
 *    v2 cookie is rewritten here. A v1 user matches no manifest entry and
 *    keeps `app/(main)/channel-invitations/page.tsx`, byte-identically. The
 *    redirect is therefore scoped to v2 by construction, with no runtime
 *    branch to get wrong;
 *  - it is a TEMPORARY redirect (307), never `permanentRedirect`. A 308 is
 *    cached by the browser against the ORIGIN, so it would keep firing for the
 *    same person after they left the v2 preview — a v2 decision leaking into
 *    v1 through the HTTP cache;
 *  - it redirects to the CLEAN path (`/invitations`), which the proxy rewrites
 *    into `app/v2/` on the follow-up request. The `/v2` prefix never reaches
 *    the URL bar.
 *
 * Old notification `action_url`s, old emails and old bookmarks keep working.
 * Retire with v1 (phase 7), not before.
 */
export default function V2ChannelInvitationsRedirect(): never {
  redirect('/invitations');
}
