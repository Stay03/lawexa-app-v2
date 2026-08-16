'use client';

import { useQueryClient } from '@tanstack/react-query';

import type { Channel } from '@/types/collab';
import { findCachedRow } from '@/v2/runtime/seed-detail';
import { channelsQueries } from '../queries';
import { channelDisplayName, channelPhoneSubtitle } from '../thread-model';
import type { ChannelFrameIdentity } from './states';

/**
 * The identity of a channel that is already in some cached list, or `null`.
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 * Owner, 15 August 2026: "why have full skeletons that are empty when the list
 * page it's coming from already has some of the details needed to load the
 * details page". The row the reader tapped carries the name, the purpose and
 * the space. Painting grey bars over the top of that is not a decision anyone
 * made; it is what happens when a loading state is written without reference to
 * the screen the reader came from.
 *
 * ── ONLY SETTLED FACTS, NEVER A RULING ─────────────────────────────────────
 * A name, a purpose and a space cannot have changed between the tap and the
 * paint. Whether this reader may write, may read the roster, may open Lists —
 * those come off the channel DETAIL and are never seeded at any price. A screen
 * that guessed one would flash a Join button, or a refusal, and take it back;
 * that is worse than an empty skeleton, because a skeleton makes no claim.
 *
 * ── WHAT A COLD ARRIVAL GETS ───────────────────────────────────────────────
 * `null`, and therefore the silhouette that was always there. A shared link, a
 * push, a reload, or a channel in a list this reader never opened all take that
 * path. Nothing here degrades into a placeholder string.
 *
 * `channelsQueries.lists()` is the ONE prefix over every channel-row list: the
 * cross-space `mine()` and `myThreads()`, every per-space `bySpace()` and
 * `threadsBySpace()`. That is what the key geography note in `queries.ts` calls
 * load-bearing, and one lookup reaches whichever list the reader came from.
 *
 * THREADS ARE FOUND HERE NOW, AND ONLY FROM A REAL ROW (2026-08-16). Until the
 * space threads index went live this said threads were never found: every
 * CHANNEL listing applies `topLevel()`, so a thread had no row to have been
 * tapped. `channelsQueries.threadsBySpace` is a thread listing, it sits under
 * this same prefix on purpose (see `queries.ts`), and the row behind the space
 * lobby's thread rows is therefore in the cache when one is tapped. That row is
 * a whole `Channel` off the wire, so seeding from it is the same settled-facts
 * bargain as any other row, not the guess this block used to rule out, which
 * was rebuilding a thread from a message's `thread` stub. That remains
 * forbidden: a stub is shaped for the line under a message, and printing a
 * title off it is how a wrong name reaches the screen.
 *
 * A thread reached from a mention or from the channel's own threads panel still
 * keeps the silhouette: the panel's rows live under a different prefix
 * (`threadsOf`, page-infinite) and a push arrives cold.
 *
 * It reads the cache and never writes it, and holds no state, so it is safe
 * inside a Suspense fallback that React will delete without warning.
 */
export function useCachedChannelIdentity(
  uuid: string | null,
): ChannelFrameIdentity | null {
  const queryClient = useQueryClient();
  if (uuid === null) return null;
  const row = findCachedRow<Channel>(
    queryClient,
    channelsQueries.lists(),
    (candidate) => candidate.uuid === uuid,
  );
  if (!row) return null;
  return {
    name: channelDisplayName(row),
    // THE PARENT NAME IS PASSED, AND IT IS WHAT KEEPS THE TWO BARS AGREEING.
    // `ChannelPlaceHeader` resolves this line as
    // `channelPhoneSubtitle(channel, parent?.name ?? null)` off the same
    // `parent_channel_name` field, so a thread reads "Thread in {parent}" in
    // both. Hardcoding `null` here was correct while no listing could return a
    // thread; today it would seed the visibility label and flip it one paint on,
    // which is the exact divergence `channelPhoneSubtitle` was extracted to
    // prevent. On an ordinary channel the field is absent and this is `null`,
    // so nothing about a channel's subtitle changes.
    subtitle: channelPhoneSubtitle(row, row.parent_channel_name ?? null),
    visibility: row.visibility,
    visibilityLabel: row.visibility_label,
    space: row.space,
  };
}
