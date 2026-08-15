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
 * `channelsQueries.lists()` is the ONE prefix over every channel-row list — the
 * cross-space `mine()` and every per-space `bySpace()` — which is what the key
 * geography note in `queries.ts` calls load-bearing. One lookup reaches
 * whichever list the reader actually came from.
 *
 * THREADS ARE DELIBERATELY NOT FOUND HERE. Every channel listing applies
 * `topLevel()`, so a thread has no row to have been tapped, and a thread opened
 * from a mention or the threads panel keeps the silhouette. Rebuilding one from
 * a message's `thread` stub would mean printing a title off a payload shaped
 * for another purpose, which is how a wrong name reaches the screen.
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
    // No parent name: a listed row is never a thread (see above), so this
    // resolves to the purpose or the visibility, exactly as the live bar
    // resolves it for the same row.
    subtitle: channelPhoneSubtitle(row, null),
    visibility: row.visibility,
    visibilityLabel: row.visibility_label,
    space: row.space,
  };
}
