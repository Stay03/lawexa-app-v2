'use client';

import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import type { ChannelListResponse } from '@/types/collab';
import { collabAccessState } from '@/v2/features/collab/model';
import { sumSpaceMentions } from '@/v2/features/spaces/cache';
import { SPACES_BASELINE_PARAMS, spacesQueries } from '@/v2/features/spaces/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { CountBadge, UnreadDot } from '@/v2/shell/designs/modules';
import { channelUnreadGrammar } from '../model';
import { channelsQueries } from '../queries';

/**
 * nav-signal — what the "Channels" nav row says before you open it, and the
 * mark that says it. The nav becomes a triage surface: you learn there is
 * something waiting without leaving the page you are on.
 *
 * ── IT COSTS NOTHING ───────────────────────────────────────────────────────
 * Both halves are DERIVED from cache entries the realtime spine already mounts
 * app-wide for every eligible viewer (`v2/runtime/realtime/spine.tsx`, its "two
 * baseline queries"): the cross-space channel list for the dot, and the
 * baseline spaces list for the number. Subscribing here adds observers, never
 * requests, and the spine's `.channel.unread` writers keep both live while the
 * reader is anywhere in the app.
 *
 * ── THE NUMBER COMES FROM THE SPACES ROLLUP, AND THAT IS THE WHOLE POINT ───
 * It used to sum `mention_count` across `GET /channels`, which is a listing of
 * CHANNELS: `listChannels` applies `topLevel()`, so threads have no row in it
 * at all. A reader @-mentioned only inside a thread therefore saw a silent nav
 * row while the thread itself showed the tag — the reported bug.
 *
 * `GET /spaces` answers the same question honestly. Its `mention_count` is a
 * per-space rollup that ALREADY INCLUDES THREADS (`api-digest.md` §17, and
 * measured 2026-08-16: the rollup read 226 against the channel list's 196). So
 * the badge is {@link sumSpaceMentions} over the spine's baseline spaces entry
 * — no thread fetch, no second request, and the nav row now agrees with the
 * title/favicon/OS badge, which the spine derives from that same number.
 *
 * ── WHERE IT IS SHORT: ONE PAGE OF SPACES ──────────────────────────────────
 * `spacesApi.getList` sends `per_page: params.per_page ?? 30`
 * (`lib/api/collab.ts`), and `SPACES_BASELINE_PARAMS` names no `per_page`, so
 * the cached entry is the FIRST 30 SPACES. A reader in more than 30 spaces has
 * their 31st onwards missing from the sum, and any mention living only there is
 * uncounted. NOT SOLVED HERE, deliberately: paging the whole list to render one
 * number would trade the "costs nothing" property for a case no account in this
 * product is near, and the app badge has carried the identical limit since it
 * shipped. The honest fix, when it is needed, is a single rollup field from the
 * backend, not more pages.
 *
 * ── THE SELECTS RETURN PRIMITIVES, ON PURPOSE ──────────────────────────────
 * Two `useQuery` calls rather than one returning a `{unread, mentions}` object:
 * a selector that mints a new object on every run re-renders the whole
 * navigation on every unrelated cache write, and the house rule
 * (`feedback_zustand_selector_stable_refs`, and the same maths for TanStack's
 * `select`) is that a selector returns something comparable. A boolean and a
 * number are. Both selects are module-scope functions, so their identity is
 * stable and TanStack can memoise them.
 *
 * ── THE GRAMMAR IS DERIVED, NEVER RE-INVENTED ──────────────────────────────
 * The dot reads {@link channelUnreadGrammar}, so a muted channel adds nothing
 * to it — Ruling A, decided in one place — and the server applies the other
 * half of that ruling to the rollup the number reads (muted channels still
 * contribute their direct @you). Bold + gold dot = unread; the number is ONLY
 * ever mentions; no red anywhere.
 */

/** Is anything unread anywhere? (Muted channels never say yes — Ruling A.) */
function selectUnreadPresent(response: ChannelListResponse): boolean {
  return response.data.some((channel) => channelUnreadGrammar(channel).unread);
}

/** What a nav row needs to know. `unread` bolds the label; `mentions` badges it. */
export interface CollabNavSignal {
  unread: boolean;
  mentions: number;
}

/** The resting value — signed-out, ineligible, or a cache that has nothing yet. */
export const QUIET_NAV_SIGNAL: CollabNavSignal = { unread: false, mentions: 0 };

/**
 * The live signal for the Channels nav row. Safe to call from any v2 chrome:
 * the queries are `enabled` only for an eligible collab viewer, which is the
 * same predicate that decides whether the row is rendered at all.
 */
export function useCollabNavSignal(): CollabNavSignal {
  const session = useV2Session();
  const eligible = collabAccessState(session) === 'eligible';
  const channels = channelsQueries.mine({ viewerId: session.userId });
  // The spine's own badge key, spread from the shared constant so the two can
  // never drift into two cache entries (see `SPACES_BASELINE_PARAMS`).
  const spaces = spacesQueries.list({
    ...SPACES_BASELINE_PARAMS,
    viewerId: session.userId,
  });

  const unread = useQuery({ ...channels, enabled: eligible, select: selectUnreadPresent });
  const mentions = useQuery({ ...spaces, enabled: eligible, select: sumSpaceMentions });

  return {
    unread: unread.data ?? false,
    mentions: mentions.data ?? 0,
  };
}

/**
 * The trailing mark on a nav row. Renders nothing when there is nothing to
 * say, so a quiet account's navigation is exactly as quiet as before.
 *
 * The mention badge WINS when both are true: a number already implies unread,
 * and a dot beside it would be a second mark for a fact the number carries.
 *
 * It brings NO positioning of its own — each surface owns the slot it goes in
 * (the drawer pushes it right inside the row; the rail drops it into the
 * primitive's own absolutely-positioned badge slot, which the collapsed icon
 * rail hides rather than clips).
 */
export function NavSignalMark({
  signal,
  className,
}: {
  signal: CollabNavSignal;
  className?: string;
}) {
  if (signal.mentions > 0) {
    return (
      <span className={cn('flex shrink-0 items-center', className)}>
        <CountBadge
          count={signal.mentions}
          label={`${signal.mentions} unread ${signal.mentions === 1 ? 'mention' : 'mentions'}`}
        />
      </span>
    );
  }
  if (!signal.unread) return null;
  return (
    <span className={cn('flex shrink-0 items-center', className)}>
      <UnreadDot />
    </span>
  );
}
