import type { SpaceRosterEntry } from '@/types/chat';
import type { RosterEntry } from './member-colour';

/**
 * The roster that colours a space chat's people (member-colour.ts), from the
 * chat record itself where it can (17 October 2026).
 *
 * The colours used to wait for a second read: the space's members, which can
 * only be asked once the record has named the space. On a direct open of a
 * chat (a shared link, a notification, a refresh) that was two round trips in
 * a row, and the bubbles turned from grey to their colours 1-3.6 s after the
 * transcript (WebKit, the timed shots of 14 October). Backend now puts the
 * space's newest 100 active members on the record (`space_roster`), so the
 * colours land with the transcript.
 *
 * Only when that list holds every person who asked here. A space with more
 * than 100 members can have an asker outside it, and the colour order is the
 * roster's (the Owner first, then by join time): mixing the two lists would
 * give that asker a different colour on each. So then the members read colours
 * everyone, as before.
 */

/** The record's roster in the colour module's terms. */
export function rosterFromRecord(rows: readonly SpaceRosterEntry[]): RosterEntry[] {
  return rows.map((row) => ({
    uuid: row.user_uuid,
    owner: row.role === 'owner' || row.content_role === 'owner',
    joinedAt: row.joined_at,
  }));
}

/**
 * Which roster colours this chat: the record's when it covers every asker,
 * else the members read (`null` until it answers, which is the grey the
 * bubbles ease in from).
 */
export function colourRosterFor(
  fromRecord: readonly RosterEntry[] | null,
  fromMembers: readonly RosterEntry[] | null,
  askers: readonly string[],
): readonly RosterEntry[] | null {
  if (fromRecord) {
    const listed = new Set(fromRecord.map((row) => row.uuid));
    if (askers.every((uuid) => listed.has(uuid))) return fromRecord;
  }
  return fromMembers;
}
