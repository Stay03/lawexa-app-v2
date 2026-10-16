import type { Member } from '@/types/collab';

/**
 * The People tab's Invited list: pending rows from the roster and from
 * `?status=pending`, each person once, the pending list's order first (it is
 * newest first). Only rows marked `is_pending` count, so an API from before
 * the pending list (which ignores `status` and answers the active members)
 * shows nobody as invited rather than everyone.
 */
export function invitedRows(fromRoster: readonly Member[], fromPending: readonly Member[]): Member[] {
  const seen = new Set<string>();
  const rows: Member[] = [];
  for (const member of [...fromPending, ...fromRoster]) {
    if (!member.is_pending || seen.has(member.user.uuid)) continue;
    seen.add(member.user.uuid);
    rows.push(member);
  }
  return rows;
}

/** How long a member reads as "New" on the People tab (backend, 16 October
 *  2026: the members list comes newest-joined first, and the mark is
 *  `joined_at` within the last 7 days, no new field). */
export const NEW_MEMBER_DAYS = 7;

/**
 * Whether a member joined within the last {@link NEW_MEMBER_DAYS} days of
 * `now` (the caller's minute clock, so render stays pure). An invited person
 * who has not joined, a missing or unreadable `joined_at`, and a date in the
 * future (a clock ahead of ours) are never New.
 *
 * NEVER THE OWNER (techlead, 16 October 2026). The mark tells the Owner who
 * joined; an Owner who made the space this week joined it then too, and
 * marking their own row New said nothing.
 */
export function joinedRecently(
  member: Pick<Member, 'joined_at' | 'is_pending' | 'role' | 'content_role'>,
  now: number,
): boolean {
  if (member.content_role === 'owner' || member.role === 'owner') return false;
  if (member.is_pending || !member.joined_at) return false;
  const joined = Date.parse(member.joined_at);
  if (Number.isNaN(joined)) return false;
  const age = now - joined;
  return age >= 0 && age < NEW_MEMBER_DAYS * 24 * 60 * 60 * 1000;
}
