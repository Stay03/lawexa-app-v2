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
