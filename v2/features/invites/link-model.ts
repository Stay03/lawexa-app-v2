import type { InviteLink } from '@/types/collab';

/**
 * The address of an invite.
 *
 * ── THE SERVER DOES NOT SEND A URL ─────────────────────────────────────────
 * Measured against production: the row carries `code` and nothing else, so the
 * address is ours to compose. It is composed from `window.location.origin`
 * rather than a constant, because a link copied on staging that points at
 * production quietly invites somebody into the wrong place.
 *
 * ── AND IT IS COMPOSED IN EXACTLY ONE PLACE ────────────────────────────────
 * Two surfaces now offer a link — the admin panel and the invite dialog — and a
 * second copy of this three-line function is how they start disagreeing about
 * what an invite address looks like. Today's other repair was twelve copies of
 * a two-line ternary.
 */
export function inviteUrl(code: string): string {
  const origin =
    typeof window === 'undefined' ? 'https://lawexa.com' : window.location.origin;
  return `${origin}/join/${code}`;
}

/**
 * How the link behaves, in the reader's terms rather than the flag's, and with
 * the role it gives when the space has roles to give. Literal on purpose
 * (design round 1, 12 October 2026): "walks straight in" was a figure of
 * speech, and "you decide who actually gets in" was false for a link that
 * needs no approval.
 */
export function approvalLabel(
  link: Pick<InviteLink, 'requires_approval'>,
  roleLabel?: string | null,
): string {
  const role = roleLabel?.trim();
  if (link.requires_approval) {
    return role
      ? `People who use this link join as ${role} after you approve them.`
      : 'People who use this link join after you approve them.';
  }
  return role
    ? `Anyone with this link joins as ${role} without your approval.`
    : 'Anyone with this link joins without your approval.';
}
