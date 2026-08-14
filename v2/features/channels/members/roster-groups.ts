import type { Member } from '@/types/collab';
import type { ChannelPresence, PresenceMember } from '../room';

/**
 * Who is here, who is here but not looking, and everyone else.
 *
 * Owner, 14 August 2026: the channel and thread member list should separate the
 * people who are here from the rest. Three groups, from data the app already
 * receives, with no backend ask.
 *
 * ── PRESENCE LEADS, THE ROSTER FOLLOWS ─────────────────────────────────────
 * The obvious shape is to walk the member list and ask each row whether it is
 * present. That shape lies twice, and both lies are silent:
 *
 * 1. THE ROSTER IS ONE PAGE. `GET /channels/{uuid}/members` is a plain query
 *    with `per_page: 100`, and the sheet reads only `data`. In a channel with
 *    more than a hundred members, someone standing in the room RIGHT NOW can be
 *    on page two, and a roster-led grouping would draw them as absent.
 * 2. IN A THREAD, PRESENCE IS WIDER THAN THE ROSTER BY DESIGN. A thread's
 *    roster is its FOLLOWER list, but its presence room admits every member of
 *    the parent channel. So a person can be genuinely here and genuinely not on
 *    the roster at all, and that is not an error to paper over.
 *
 * So the two "here" groups are built FROM THE PRESENCE SET, which carries the
 * name and the face, and each row is enriched with its roster entry when one has
 * been fetched. A present person with no fetched row is still shown; they simply
 * arrive without a role chip and without the management verbs, because we do not
 * know their role and must not invent one.
 *
 * ── "NOT LOOKING" ONLY EVER MEANS SOMEONE SAID SO ──────────────────────────
 * `away` holds the uuids that actually whispered that their tab went quiet. A
 * pocketed phone often never sends it. So absence of the whisper is treated as
 * here, never as away: the group can only ever be wrong in the direction of
 * showing someone as present who has stopped looking, which is the same
 * direction the header's faces already err in.
 *
 * ── AND IT REFUSES TO GROUP WHEN IT DOES NOT KNOW ──────────────────────────
 * `presence` is null for a reader with no room (a previewer, a refusal), and
 * `here` is null until the room first answers. "Not known yet" is not "nobody":
 * grouping then would print "here now: 0" over a room that has simply not
 * replied. In both cases the caller is told to render the roster ungrouped,
 * exactly as it was before this existed.
 */

export interface RosterRow {
  /** The uuid is the join between the two sources: the presence member id IS
   *  the user uuid. */
  uuid: string;
  name: string;
  avatarUrl: string | null;
  /** The fetched roster entry, when this person is on the page we have. Absent
   *  for a present person we have no row for; the row then shows no role and
   *  offers no verbs. */
  member: Member | null;
}

export interface RosterGroups {
  /** In the room, and not saying otherwise. Arrival order, viewer included. */
  hereNow: readonly RosterRow[];
  /** In the room, tab in the background, said so themselves. */
  hereNotLooking: readonly RosterRow[];
  /** Fetched members who are not in the room. */
  everyoneElse: readonly RosterRow[];
  /** How many members the server says there are, beyond the ones fetched. Zero
   *  when the page holds them all. The list must say so rather than imply the
   *  page is the channel. */
  notFetched: number;
}

function rowFromPresence(person: PresenceMember, byUuid: Map<string, Member>): RosterRow {
  const member = byUuid.get(person.uuid) ?? null;
  return {
    uuid: person.uuid,
    // The roster's copy of the name wins when we have it: it is the same
    // person, but the roster row is the fuller record.
    name: member?.user.name ?? person.name,
    avatarUrl: member?.user.avatar_url ?? person.avatar_url,
    member,
  };
}

function rowFromMember(member: Member): RosterRow {
  return {
    uuid: member.user.uuid,
    name: member.user.name,
    avatarUrl: member.user.avatar_url,
    member,
  };
}

/**
 * Partition a fetched roster page against the live presence set.
 *
 * Returns `null` when the reader has no room, or the room has not answered yet:
 * the caller renders the flat list it always did.
 */
export function groupRoster({
  members,
  presence,
  totalMembers,
}: {
  /** The page of members that has actually been fetched. */
  members: readonly Member[];
  presence: ChannelPresence | null;
  /** The server's count for the whole channel, which is not the page's length. */
  totalMembers: number;
}): RosterGroups | null {
  if (!presence || presence.here === null) return null;

  const byUuid = new Map(members.map((member) => [member.user.uuid, member]));
  const hereNow: RosterRow[] = [];
  const hereNotLooking: RosterRow[] = [];
  const inTheRoom = new Set<string>();

  for (const person of presence.here) {
    inTheRoom.add(person.uuid);
    const row = rowFromPresence(person, byUuid);
    if (presence.away.has(person.uuid)) hereNotLooking.push(row);
    else hereNow.push(row);
  }

  const everyoneElse = members
    .filter((member) => !inTheRoom.has(member.user.uuid))
    .map(rowFromMember);

  // Only the people we have NOT fetched are unaccounted for. Someone present
  // but off-page is already drawn above, so counting them again here would
  // overstate what is missing.
  const accountedFor = new Set([...byUuid.keys(), ...inTheRoom]);
  const notFetched = Math.max(0, totalMembers - accountedFor.size);

  return { hereNow, hereNotLooking, everyoneElse, notFetched };
}
