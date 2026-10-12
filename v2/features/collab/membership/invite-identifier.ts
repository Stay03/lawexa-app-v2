import type { ApiError } from '@/lib/utils/api-error';
import {
  isUsernameShape,
  normaliseUsername,
} from '@/v2/features/settings/profile/form-model';

/**
 * invite-identifier — how the invite dialog reads the one field a person is
 * named in (`InvitePeopleDialog`). Pure, so the parser and the refusal line are
 * pinned without a DOM.
 *
 * A SPACE invite takes an email address or a username (backend 6d11c84: exactly
 * one of `email`, `user_uuid` or `username`). An organization invite takes an
 * email only, so the dialog is told which it is and never guesses.
 */

/** What the dialog's one field accepts. */
export type InviteIdentifierMode = 'email' | 'email-or-username';

/** The person an invite names: one key, never both. */
export type InviteIdentifier = { email: string } | { username: string };

/** Something, an `@`, then a domain with a dot in it. The server stays the
 *  authority on whether the address is real. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The line shown when the field holds neither an email nor a username. */
export const INVITE_IDENTIFIER_HINT =
  'Type an email address, or a username such as @ada_obi.';

/**
 * Reads "email or @username". Text with an `@` and a dot-domain after it is an
 * email; anything else is a username, with a leading `@` dropped and folded to
 * lowercase the way the profile form folds it. `null` when it is neither, so
 * nothing is sent that the server would only refuse.
 */
export function parseInviteIdentifier(raw: string): InviteIdentifier | null {
  const text = raw.trim();
  if (!text) return null;
  if (EMAIL_SHAPE.test(text)) return { email: text };
  const handle = normaliseUsername(text);
  return isUsernameShape(handle) ? { username: handle } : null;
}

/**
 * The line a refused invite shows. An unknown username (422 under
 * `errors.username`) names the handle that was sent; every other refusal is
 * the server's own sentence, as before.
 */
export function inviteRefusalMessage(
  error: ApiError,
  invitee: InviteIdentifier,
): string {
  if ('username' in invitee && error.status === 422 && error.errors?.username) {
    return `No one on Lawexa has the username @${invitee.username}.`;
  }
  return error.message;
}
