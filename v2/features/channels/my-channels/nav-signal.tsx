'use client';

import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import type { ChannelListResponse } from '@/types/collab';
import { collabAccessState } from '@/v2/features/collab/model';
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
 * The signal is DERIVED from `channelsQueries.mine({ viewerId })` — the exact
 * cache entry the realtime spine already mounts app-wide for every eligible
 * viewer, and the one `/channels` itself reads. Subscribing here adds an
 * observer, never a request, and the spine's `.channel.unread` writers keep
 * the mark live while the reader is anywhere in the app.
 *
 * ── THE SELECTS RETURN PRIMITIVES, ON PURPOSE ──────────────────────────────
 * Two `useQuery` calls over one key rather than one call returning a `{unread,
 * mentions}` object: a selector that mints a new object on every run re-renders
 * the whole navigation on every unrelated cache write, and the house rule
 * (`feedback_zustand_selector_stable_refs`, and the same maths for TanStack's
 * `select`) is that a selector returns something comparable. A boolean and a
 * number are. Both selects are module-scope functions, so their identity is
 * stable and TanStack can memoise them.
 *
 * ── THE GRAMMAR IS DERIVED, NEVER RE-INVENTED ──────────────────────────────
 * Both selects read {@link channelUnreadGrammar}, so a muted channel adds
 * nothing to the dot and still adds its direct @you to the number — Ruling A,
 * decided in one place. Bold + gold dot = unread; the number is ONLY ever
 * mentions; no red anywhere.
 */

/** Is anything unread anywhere? (Muted channels never say yes — Ruling A.) */
function selectUnreadPresent(response: ChannelListResponse): boolean {
  return response.data.some((channel) => channelUnreadGrammar(channel).unread);
}

/** How many messages @mention the reader across every channel they are in. */
function selectMentionTotal(response: ChannelListResponse): number {
  let total = 0;
  for (const channel of response.data) {
    total += channelUnreadGrammar(channel).mentions;
  }
  return total;
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
  const options = channelsQueries.mine({ viewerId: session.userId });

  const unread = useQuery({ ...options, enabled: eligible, select: selectUnreadPresent });
  const mentions = useQuery({ ...options, enabled: eligible, select: selectMentionTotal });

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
