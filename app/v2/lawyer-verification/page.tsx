import { redirect } from 'next/navigation';

/**
 * LEGACY ADDRESS → `/settings/verification`.
 *
 * v1's lawyer verification lives at `/lawyer-verification`, linked from its
 * sidebar. v2 files it under settings beside Profile, so this address becomes
 * a redirect shell by the same manifest-scoped, TEMPORARY-redirect mechanism
 * as the invitation shells (see `app/v2/channel-invitations/page.tsx` for the
 * full reasoning): only a request carrying the v2 cookie is rewritten here, a
 * v1 reader keeps `app/(main)/lawyer-verification/page.tsx` untouched, and the
 * 307 never outlives the preview in the browser's cache.
 *
 * Retire with v1, not before.
 */
export default function V2LawyerVerificationRedirect(): never {
  redirect('/settings/verification');
}
