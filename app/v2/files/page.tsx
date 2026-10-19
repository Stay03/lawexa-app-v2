import { redirect } from 'next/navigation';

/**
 * LEGACY ADDRESS → `/folders`.
 *
 * v1's Files page lives at `/files`. v2 unifies files and folders (build 6,
 * 19 October 2026): the Folders page lists the files in no folder under the
 * folders, so this address becomes a redirect shell by the same
 * manifest-scoped, TEMPORARY-redirect mechanism as the invitation shells (see
 * `app/v2/channel-invitations/page.tsx` for the full reasoning): only a request
 * carrying the v2 cookie is rewritten here, a v1 reader keeps
 * `app/(main)/files/page.tsx` untouched, and the 307 never outlives the
 * preview in the browser's cache.
 *
 * Retire with v1, not before.
 */
export default function V2FilesRedirect(): never {
  redirect('/folders');
}
