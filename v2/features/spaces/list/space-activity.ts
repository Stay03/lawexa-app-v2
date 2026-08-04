import type { Channel } from '@/types/collab';
import { channelUnreadGrammar } from '@/v2/features/channels/model';

/**
 * space-activity — what is actually HAPPENING in each space, derived for the
 * `/spaces` lanes. Pure: no JSX, no hooks, so the lane, its skeleton and any
 * future preview all read the same answers.
 *
 * ── WHERE THE FACTS COME FROM ──────────────────────────────────────────────
 * `GET /api/spaces` carries NO channel names and NO last-activity timestamp —
 * only `active_members_count` and the two §17 rollups (verified against
 * `types/collab.ts` and `api-digest.md` §C, 2026-08-04). So a lane cannot ask
 * that payload what its channels are called.
 *
 * `GET /api/channels` can: it returns the caller's cross-space channels, each
 * stamped with `space{uuid,name,type}`, `unread_count`, `mention_count`,
 * `my_notify_level` and `last_message_at`. The realtime spine ALREADY mounts
 * that query app-wide for every eligible viewer (`spine.tsx:176`) and keeps
 * its counts live between refetches, so grouping it by space costs the
 * `/spaces` screen nothing: no second request, no skeleton, and chips that
 * move within a second of a message arriving.
 *
 * ── WHAT THIS IS ONE PAGE OF, AND WHY NO COUNT IS EVER STATED ──────────────
 * THE INPUT IS A SINGLE PAGE. `channelsApi.getMine` defaults to `per_page: 20`
 * and the spine mounts it with no params, so this sees at most the caller's 20
 * most recently active channels ACROSS ALL SPACES. Three consequences, all
 * faced rather than papered over:
 *
 *  1. A quiet space can have channels the page never reached, so a lane with
 *     no chips means "none on this page", never "none".
 *  2. A space CAN hold more channels than the page shows, so the overflow is
 *     the word "more" and never a number. `+4` would be a count of the PAGE
 *     printed as though it were a count of the SPACE, and the wire cannot
 *     support it — a viewer in nine channels of one space could be shown `+1`
 *     when the truth is `+6`.
 *  3. Widening the page is NOT the fix. This must resolve to the byte-identical
 *     cache key the spine already mounts, or the screen mints a second entry
 *     and pays a duplicate fetch for the warm paint it was built to avoid. A
 *     per-space channel preview on `GET /api/spaces` is the real answer, and
 *     that is a backend ask, not a param change.
 *
 * The route's own filtering is a further unknown, and deliberately recorded as
 * one: `api-digest.md:15` states that this endpoint's contract lives outside
 * every source we hold and must be resolved from code. The phase-5 review
 * reads it as EXCLUDING muted channels unless they carry a mention, which
 * would mean an all-muted space shows no chips by design — consistent with,
 * and indistinguishable from, (1) above. Nothing here depends on which it is,
 * and nothing here may claim to know.
 *
 * ── ORDERING ───────────────────────────────────────────────────────────────
 * Unread first (so the three shown are the three worth reading), then most
 * recently active, then alphabetical so a quiet space is stable across renders
 * instead of shuffling on every refetch.
 *
 * Unread is taken from `channelUnreadGrammar`, never re-derived: that function
 * is where mute stops the bold, so a muted channel can never surface as a gold
 * chip — Ruling A, for free. Its `last_message_at` still counts toward the
 * lane's age, because an age is a fact about the room and not a notification.
 */

/** How many channel names a lane shows before the overflow word takes over. */
const CHIP_LIMIT = 3;

interface SpaceChannelChip {
  uuid: string;
  name: string;
  /** Drives the gold mark. Derived, never re-invented. */
  unread: boolean;
}

export interface SpaceActivity {
  chips: readonly SpaceChannelChip[];
  /** This space holds more of the caller's channels than the chips show. A
   *  BOOLEAN, not a count — see the docblock for why no number would be true. */
  hasMore: boolean;
  /** Newest `last_message_at` across the viewer's channels here, ISO or null. */
  lastMessageAt: string | null;
}

/** One frozen empty value, so a space with no known channels neither allocates
 *  nor breaks the lane's `memo` on every render. */
export const NO_SPACE_ACTIVITY: SpaceActivity = {
  chips: [],
  hasMore: false,
  lastMessageAt: null,
};

/** Newest first; a missing or unparseable timestamp sorts last. */
function activityRank(iso: string | null): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function spaceActivityIndex(
  channels: readonly Channel[],
): ReadonlyMap<string, SpaceActivity> {
  const bySpace = new Map<string, Channel[]>();
  for (const channel of channels) {
    const group = bySpace.get(channel.space.uuid);
    if (group) group.push(channel);
    else bySpace.set(channel.space.uuid, [channel]);
  }

  const index = new Map<string, SpaceActivity>();
  for (const [spaceUuid, group] of bySpace) {
    const ranked = group
      .map((channel) => ({ channel, unread: channelUnreadGrammar(channel).unread }))
      .sort((left, right) => {
        if (left.unread !== right.unread) return left.unread ? -1 : 1;
        const byRecency =
          activityRank(right.channel.last_message_at) -
          activityRank(left.channel.last_message_at);
        if (byRecency !== 0) return byRecency;
        return left.channel.name.localeCompare(right.channel.name);
      });

    let lastMessageAt: string | null = null;
    let newest = 0;
    for (const { channel } of ranked) {
      const rank = activityRank(channel.last_message_at);
      if (rank > newest) {
        newest = rank;
        lastMessageAt = channel.last_message_at;
      }
    }

    index.set(spaceUuid, {
      chips: ranked.slice(0, CHIP_LIMIT).map(({ channel, unread }) => ({
        uuid: channel.uuid,
        name: channel.name,
        unread,
      })),
      hasMore: ranked.length > CHIP_LIMIT,
      lastMessageAt,
    });
  }
  return index;
}
