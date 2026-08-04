import { Eye, Loader2, Lock, LogIn, MessagesSquare, WifiOff } from 'lucide-react';

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

/**
 * The designed empty channel — teaches (name + purpose) and acts (focus the
 * composer). Never a blank pane (DIRECTION 13).
 *
 * `onWriteFirstMessage` IS OPTIONAL BECAUSE THE ACT IS. A space member
 * previewing a public channel they have not joined can read this room and not
 * write in it, so the same empty state has to be able to teach WITHOUT
 * offering a button that would only 403 — {@link ChannelPreviewDock} already
 * carries the one way forward, and a second, broken one here would be worse
 * than none. The title changes with it: an unjoined room is not "ready" for
 * you yet.
 */
export function FeedEmptyState({
  channelName,
  description,
  onWriteFirstMessage,
}: {
  channelName: string;
  description: string | null;
  onWriteFirstMessage?: () => void;
}) {
  return (
    <CollabMessage
      icon={MessagesSquare}
      tone="neutral"
      title={onWriteFirstMessage ? `${channelName} is ready` : 'Nothing here yet'}
      description={
        description?.trim() ||
        (onWriteFirstMessage
          ? 'No messages yet. Whatever your group is working on, this is where it starts.'
          : `Nobody has written in ${channelName} yet.`)
      }
      action={
        onWriteFirstMessage ? (
          <Button size="sm" onClick={onWriteFirstMessage}>
            Write the first message
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * ChannelPreviewDock — what stands where the composer stands for a space
 * member reading a `space_public` channel they have not joined.
 *
 * THE ABSENCE IS THE POINT, AND SO IS ITS PLACE. Reading is open here and
 * replying is not, so the honest surface is the one the reply would have come
 * from: the dock keeps the composer's exact column and cap
 * (`max-w-xs` / `sm:max-w-md`), so it sits on the transcript's own axis and the
 * reader meets a way IN rather than a control that fails.
 *
 * IT IS NOT THE COMPOSER'S HEIGHT. It is a taller bordered card, and its
 * sentence wraps to two or three lines on a narrow phone with a long channel
 * name. Nothing has to be reserved for that here: the feed measures whatever
 * occupies this slot (`--v2-chan-dock-h`, a live `ResizeObserver`) and gives
 * the transcript exactly that much clearance, wrapping included.
 *
 * IT IS THE ONLY JOIN ON THE SCREEN. The header carries no second button: two
 * would be the same action twice, and a failure raised at the top would print
 * its sentence at the bottom. Everything about the attempt — the press, the
 * pending spinner, the server's words — happens in this one place.
 *
 * Hook-free: the screen owns the mutation, the pending flag and the error, so
 * this stays a presentational panel like the rest of this file.
 */
export function ChannelPreviewDock({
  channelName,
  onJoin,
  isJoining,
  error,
}: {
  channelName: string;
  onJoin: () => void;
  isJoining: boolean;
  /** The server's own sentence from the last failed attempt, or `null`. */
  error: string | null;
}) {
  return (
    <div className="mx-auto w-full max-w-xs px-4 pb-3 sm:max-w-md">
      <div className="rounded-2xl border bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Eye aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            You&rsquo;re reading {channelName}.{' '}
            <span className="text-foreground">Join to reply.</span>
          </p>
          <Button size="sm" className="shrink-0" onClick={onJoin} disabled={isJoining}>
            {isJoining ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <LogIn aria-hidden className="size-4" />
            )}
            Join
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Screen-level refusals ────────────────────────────────────────────────── */

/**
 * 403 — a POLICY refusal, never auto-mapped to verify-email (collab model's
 * rule).
 *
 * THE COPY DELIBERATELY DOES NOT NAME THE WALL. Since preview landed, a 403
 * here has two possible meanings and we have measured neither: the reader is
 * outside the SPACE (certain), or the channel is PRIVATE and the server refuses
 * its detail to a space member who never joined (unknown — see the open
 * question in `v2/features/collab/access.tsx`). Naming either one would tell
 * half the readers something false: a colleague opening a link to a private
 * channel in a space they are already in must not be told they are not in that
 * space and asked to be invited to it.
 *
 * So it says what is true in both cases, and the way forward is true in both
 * too — someone on the other side of whichever wall this is can let you
 * through. Restore a specific sentence only when the shape has been measured
 * with two accounts in one space.
 */
export function ChannelAccessDeniedState() {
  return (
    <CollabMessage
      icon={Lock}
      tone="neutral"
      title="You don't have access to this channel"
      description="This channel isn't open to you. Ask someone already in it to invite you, or pick a channel from your own spaces."
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
