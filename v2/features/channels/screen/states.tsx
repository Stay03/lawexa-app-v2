import { Lock, MessagesSquare, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';

/**
 * states — the channel screen's loading shapes and designed refusals, shared
 * by the live screen AND the route fallback (`app/v2/channels/[channelId]/
 * loading.tsx`) so the two silhouettes can never drift (§8's home-frame
 * lesson). Phase-5 W2, 2026-08-04. All panels render through the collab
 * feature's `CollabMessage` (error ≠ empty, refusals are designed states —
 * study A0/A3). Everything here is presentational and hook-free, so the
 * route fallback can render it `aria-hidden` + `inert`.
 *
 * `still` follows the house rule (quiz `states.tsx` precedent): a route
 * fallback reserves shape WITHOUT the pulse (it waits on an RSC payload, not
 * a query); the live screen's `isPending` regions pulse.
 */

/* ── Feed shapes ──────────────────────────────────────────────────────────── */

/** One author-run skeleton — avatar + name/time bar + one or two text bars,
 *  the exact `MessageGroupRow` geometry. */
function MessageGroupSkeleton({
  still,
  lines,
  nameWidth,
}: {
  still: boolean;
  lines: 1 | 2;
  nameWidth: string;
}) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="flex gap-3 px-1">
      <Skeleton className={cn('mt-0.5 size-8 shrink-0 rounded-full', bar)} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline gap-2">
          <Skeleton className={cn('h-3.5 rounded', bar)} style={{ width: nameWidth }} />
          <Skeleton className={cn('h-3 w-10 rounded', bar)} />
        </div>
        <Skeleton className={cn('h-3.5 w-4/5 rounded', bar)} />
        {lines === 2 && <Skeleton className={cn('h-3.5 w-3/5 rounded', bar)} />}
      </div>
    </div>
  );
}

/** The feed's pending shape — a realistic median of author runs with the
 *  house progressive-opacity fade (§8iv: reserve near the middle). */
export function ChannelFeedSkeleton({ still = false }: { still?: boolean }) {
  const rows: { lines: 1 | 2; nameWidth: string }[] = [
    { lines: 2, nameWidth: '7rem' },
    { lines: 1, nameWidth: '5rem' },
    { lines: 2, nameWidth: '6rem' },
    { lines: 1, nameWidth: '8rem' },
    { lines: 2, nameWidth: '5.5rem' },
  ];
  return (
    <div aria-hidden className="flex flex-col gap-5 pt-2">
      {rows.map((row, index) => (
        <div key={index} style={{ opacity: Math.max(0.3, 1 - index * 0.15) }}>
          <MessageGroupSkeleton still={still} lines={row.lines} nameWidth={row.nameWidth} />
        </div>
      ))}
    </div>
  );
}

/** Feed load failure — visually distinct from empty, real in-place retry. */
export function FeedErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabMessage
      icon={WifiOff}
      tone="alert"
      title="Couldn't load messages"
      description="We couldn't load this channel's history. Check your connection and try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** The designed empty channel — teaches (name + purpose) and acts (focus the
 *  composer). Never a blank pane (DIRECTION 13). */
export function FeedEmptyState({
  channelName,
  description,
  onWriteFirstMessage,
}: {
  channelName: string;
  description: string | null;
  onWriteFirstMessage: () => void;
}) {
  return (
    <CollabMessage
      icon={MessagesSquare}
      tone="neutral"
      title={`${channelName} is ready`}
      description={
        description?.trim() ||
        'No messages yet. Whatever your group is working on, this is where it starts.'
      }
      action={
        <Button size="sm" onClick={onWriteFirstMessage}>
          Write the first message
        </Button>
      }
    />
  );
}

/* ── Screen-level refusals ────────────────────────────────────────────────── */

/** 403 — a POLICY refusal (usually "not a member of this private channel"),
 *  never auto-mapped to verify-email (collab model's rule). */
export function ChannelAccessDeniedState() {
  return (
    <CollabMessage
      icon={Lock}
      tone="neutral"
      title="This channel is private"
      description="You don't have access to this channel. Ask a member to invite you, or pick another channel from your spaces."
    />
  );
}

/** Channel detail load failure. */
export function ChannelErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabMessage
      icon={WifiOff}
      tone="alert"
      title="Couldn't load this channel"
      description="Something went wrong on our side. Please try again."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/* ── The whole screen's silhouette (route fallback + live pending) ───────── */

/**
 * The channel screen's frame at rest: identity header row, the tab strip,
 * the feed column, and the floating composer pill. `app/v2/channels/
 * [channelId]/loading.tsx` renders it `still` and inert; the live screen
 * renders it (pulsing) while the channel detail resolves. Geometry mirrors
 * `ChannelScreen` exactly — max-w-3xl column, header paddings, the composer's
 * compact pill cap — so the hand-off is content resolving, not a layout swap.
 */
export function ChannelScreenFrame({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Identity header row */}
      <div className="shrink-0 border-b px-4 pt-3 pb-2">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center gap-2">
            <Skeleton className={cn('size-4 rounded', bar)} />
            <Skeleton className={cn('h-5 w-40 rounded', bar)} />
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Skeleton className={cn('h-3.5 w-24 rounded', bar)} />
            <Skeleton className={cn('h-3.5 w-20 rounded', bar)} />
          </div>
        </div>
      </div>
      {/* Tab strip */}
      <div className="shrink-0 border-b px-4">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4 py-2.5">
          <Skeleton className={cn('h-4 w-12 rounded', bar)} />
          <Skeleton className={cn('h-4 w-12 rounded', bar)} />
          <Skeleton className={cn('h-4 w-12 rounded', bar)} />
        </div>
      </div>
      {/* Feed column */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-3xl px-4 pt-4">
          <ChannelFeedSkeleton still={still} />
        </div>
      </div>
      {/* Floating composer pill (compact cap, matches the live overlay) */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="v2-safe-bottom mx-auto w-full max-w-xs px-4 pb-3 sm:max-w-md">
          <Skeleton className={cn('h-12 w-full rounded-3xl', bar)} />
        </div>
      </div>
    </div>
  );
}
