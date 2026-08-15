import { format } from 'date-fns';
import {
  Clock,
  Eye,
  Loader2,
  Lock,
  LogIn,
  Radio,
  UserPlus,
  WifiOff,
} from 'lucide-react';

import { channelVisibilityFace } from '@/lib/collab/visibility';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Channel, SlimUser } from '@/types/collab';
import { PlaceCrest } from '@/v2/features/collab/kit/Crest';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { PresenceStack } from '@/v2/features/collab/kit/PresenceStack';
import { CollabMessage } from '@/v2/features/collab/ui/CollabMessage';
import { MESSAGE_MEASURE } from '../feed/measure';
import { channelDisplayName } from '../thread-model';

/**
 * states — the channel screen's loading shapes, its designed refusals, and the
 * block a channel opens with. Shared by the live screen AND the route fallback
 * (`app/v2/channels/[channelId]/loading.tsx`) so the two silhouettes can never
 * drift (§8's home-frame lesson). Phase-5 W2, redesigned in the W2 redesign
 * wave (2026-08-05). Everything here is presentational and hook-free, so the
 * route fallback can render it `aria-hidden` + `inert`.
 *
 * `still` follows the house rule (quiz `states.tsx` precedent): a route
 * fallback reserves shape WITHOUT the pulse (it waits on an RSC payload, not
 * a query); the live screen's `isPending` regions pulse.
 */

/* ── Feed shapes ──────────────────────────────────────────────────────────── */

/** One author-run skeleton — avatar + name/time bar + one or two text bars, at
 *  the `MessageGroupRow` geometry INCLUDING its measure, so the swap from
 *  skeleton to text moves no line ending. */
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
      {/* `text-[0.9375rem]` with no text in it: `ch` resolves against the
          element's own font size, so this is what makes the skeleton's 66ch
          the SAME width as the body text that replaces it. */}
      <div className={cn('min-w-0 flex-1 space-y-2 text-[0.9375rem]', MESSAGE_MEASURE)}>
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

/**
 * Feed load failure — the kit's failure half, as a PANEL rather than a strip
 * because nothing else is on screen when history fails: a 40px line alone in an
 * empty transcript is a leftover, not a state (`CollabFailure`'s own rule).
 */
export function FeedErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabFailure
      presentation="panel"
      icon={WifiOff}
      title="Couldn't load messages"
      message="We couldn't load this channel's history. Check your connection and try again."
      onRetry={onRetry}
    />
  );
}

/**
 * ChannelIntro — how a channel OPENS, and the same block when it is empty.
 *
 * ── ONE COMPONENT FOR BOTH, WHICH IS THE WHOLE IDEA ────────────────────────
 * The shipped screen had two unrelated answers to "what is this room": a 12px
 * muted sentence ("This is the beginning of general.") at the head of loaded
 * history, and a centred `CollabMessage` panel when there was nothing. So a
 * channel taught you what it was for exactly once — on the day it was empty —
 * and never again. This is the birth certificate: the crest, the name, the
 * purpose, who is here, a way to bring someone else, and the day it started.
 * It renders at the top of the FIRST page of history and, unchanged, as the
 * empty state (DIRECTION 13: empty states teach and act).
 *
 * ── THE CREST IS THE CHANNEL'S OWN ─────────────────────────────────────────
 * `PlaceCrest` on the channel's uuid, not the space's: the space is already
 * named in the header's breadcrumb and again in the line below, and a room
 * deserves a mark of its own. Its kind is not guessed — the visibility glyph
 * beside the name states it in words the crest cannot.
 *
 * ── WHAT EACH AUDIENCE IS OFFERED ──────────────────────────────────────────
 * `onWriteFirstMessage` only when the channel is genuinely empty AND the
 * reader may write (it focuses the composer); `onAddPeople` only for a channel
 * admin. A previewer gets the block with no verbs at all — their one way
 * forward is the join dock at the foot of the transcript, and a second, failing
 * button here would be worse than none.
 */
export function ChannelIntro({
  channel,
  members,
  onOpenRoster,
  onAddPeople,
  onWriteFirstMessage,
}: {
  channel: Channel;
  members: readonly SlimUser[];
  onOpenRoster?: () => void;
  onAddPeople?: () => void;
  onWriteFirstMessage?: () => void;
}) {
  const visibilityFace = channelVisibilityFace(channel.visibility);
  const VisibilityIcon = visibilityFace.icon;
  const displayName = channelDisplayName(channel);
  const total = channel.active_members_count;
  const countLabel = `${total} ${total === 1 ? 'member' : 'members'}`;
  const created = channel.created_at ? new Date(channel.created_at) : null;
  const createdLabel =
    created && !Number.isNaN(created.getTime())
      ? `Created ${format(created, 'd MMMM yyyy')}`
      : null;

  return (
    <div className="flex flex-col items-start gap-3 pb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <PlaceCrest uuid={channel.uuid} name={displayName} size="lg" />

      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-xl leading-tight font-semibold">
          <VisibilityIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">{channel.visibility_label}</span>
          <span className="min-w-0 break-words">{displayName}</span>
        </h2>
        <p className={cn('mt-1.5 text-sm leading-relaxed text-muted-foreground', MESSAGE_MEASURE)}>
          {channel.description?.trim() ||
            `This is the very beginning of ${displayName}. Everything written here stays with the channel.`}
        </p>
      </div>

      {/* `min-h-6` IS A SCROLL-CONTRACT DETAIL, not styling. The roster is a
          separate request, so this line starts as the count in WORDS (one line
          of 12px text) and becomes a row of 24px faces when it lands. Without a
          reserved height the intro would grow by ~8px at the very top of the
          transcript, shifting everything below it under a reader who is
          scrolled up. The stack's own height is the floor. */}
      <MetaLine
        className="min-h-6"
        lead={[
          <PresenceStack
            key="people"
            members={members}
            total={total}
            countLabel={countLabel}
            label={countLabel}
            size="sm"
            onClick={onOpenRoster}
          />,
          channel.space.name,
          createdLabel,
        ]}
      />

      {(onWriteFirstMessage || onAddPeople) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onWriteFirstMessage && (
            <Button size="sm" onClick={onWriteFirstMessage}>
              Write the first message
            </Button>
          )}
          {onAddPeople && (
            <Button size="sm" variant="outline" onClick={onAddPeople}>
              <UserPlus aria-hidden className="size-4" />
              Add people
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ChannelPreviewDock — what stands where the composer stands for a space
 * member reading a `space_public` channel they have not joined.
 *
 * THE ABSENCE IS THE POINT, AND SO IS ITS PLACE. Reading is open here and
 * replying is not, so the honest surface is the one the reply would have come
 * from: the dock keeps the composer's exact column and cap (the transcript's
 * own `max-w-3xl`), so it sits on the transcript's axis and the reader meets a
 * way IN rather than a control that fails.
 *
 * IT IS NOT THE COMPOSER'S HEIGHT. It is a taller bordered card, and its
 * sentence wraps on a narrow phone with a long channel name. Nothing has to be
 * reserved for that here: the feed measures whatever occupies this slot
 * (`--v2-chan-dock-h`, a live `ResizeObserver`) and gives the transcript
 * exactly that much clearance, wrapping included.
 *
 * IT IS THE ONLY JOIN ON THE SCREEN. The header carries no second button: two
 * would be the same action twice, and a failure raised at the top would print
 * its sentence at the bottom.
 *
 * ── AND IT IS WHERE A REFUSED QUIZ LINK LANDS (2026-08-05) ─────────────────
 * A `space_public` channel's go-live notification is sent to the WHOLE SPACE, so
 * a previewer is one of its designed recipients — and the lobby is correctly
 * closed to them (joining a game is a members-only write, so their screen must
 * not even ask). Refusing the link is right; landing them on a read-only
 * transcript that mentions no quiz anywhere is not, because that is the only
 * thing the notification could produce for them. `quizIsLive` puts the missing
 * sentence exactly where their one way forward already is.
 *
 * IT SAYS WHAT IS CERTAIN AND NOTHING MORE. This surface may not probe the quiz
 * endpoints, so the only fact it holds is that a game was named in the link that
 * brought them here — "someone started a quiz", which stays true whatever the
 * game is doing by the time they read it. It never claims one is running now.
 *
 * ── IN A THREAD, THE DOOR IS THE PARENT'S DOOR ─────────────────────────────
 * Threads are not joined: `POST /channels/{thread}/join` answers 422 ("Threads
 * are not joined — post in one to follow it"). Every ruling that governs a
 * thread — read it, post in it — is its parent channel's ruling, so the reader
 * standing here is previewing the PARENT, and joining the parent is what turns
 * this dock into a composer. Same one button, aimed at the place that decides.
 *
 * Hook-free: the screen owns the mutation, the pending flag and the error.
 */
export function ChannelPreviewDock({
  channelName,
  parentChannelName,
  quizIsLive,
  onJoin,
  isJoining,
  error,
}: {
  channelName: string;
  /** Non-null when the place being read is a THREAD — see the docblock. */
  parentChannelName: string | null;
  /** The navigation named a `?game=` this reader is not allowed to open. */
  quizIsLive: boolean;
  onJoin: () => void;
  isJoining: boolean;
  /** The server's own sentence from the last failed attempt, or `null`. */
  error: string | null;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-3">
      <div className="rounded-2xl border bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur">
        {quizIsLive && (
          <p className="mb-2 flex items-center gap-2.5 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <Radio aria-hidden className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              Someone started a quiz here.{' '}
              <span className="text-foreground">Join to play.</span>
            </span>
          </p>
        )}
        <div className="flex items-center gap-2.5">
          <Eye aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {parentChannelName === null ? (
              <>
                You&rsquo;re reading {channelName}.{' '}
                <span className="text-foreground">Join to reply.</span>
              </>
            ) : (
              <>
                You&rsquo;re reading a thread in {parentChannelName}.{' '}
                <span className="text-foreground">Join the channel to reply.</span>
              </>
            )}
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

/**
 * ChannelClosedState — a PRIVATE channel a space member is not in, and the one
 * refusal on this screen that is not a dead end.
 *
 * ── THE SHAPE IS MEASURED, NOT ASSUMED (2026-08-10) ────────────────────────
 * The open question recorded in `v2/features/collab/access.tsx` was whether a
 * private channel's detail is even released to a space member who never joined.
 * It is: production answers `200` with `is_member: false`, and refuses only its
 * messages and its roster (`403` each). So this branch is REACHED, the reader
 * holds the channel's real name, and the honest thing to offer is the door.
 *
 * ── WHY THIS IS A REQUEST AND NOT A JOIN ───────────────────────────────────
 * A `space_public` channel is joined by pressing Join — the server simply lets
 * you in, which is why that lives in the dock at the foot of a readable
 * transcript. Private is the other rule: nobody walks in, an admin decides. So
 * the verb is "Ask to join", the panel is where the transcript would have been,
 * and the state after the press is a WAIT, not an arrival. Calling it Join here
 * would promise a door that opens on the press.
 *
 * ── AND WHY THIS PANEL, NOT THE 403 ONE ────────────────────────────────────
 * `ChannelAccessDeniedState` carries no action on purpose. A `403` cannot be
 * told apart from a hidden channel or one that never existed, and the join
 * route answers `404` for exactly those — so a button there would be a control
 * that fails, and its failure would confirm what the `hidden` state exists to
 * conceal. Here the server has already released the channel, so asking about it
 * gives nothing away.
 *
 * ── THE WAIT DOES NOT SURVIVE A RELOAD, AND THAT IS THE SERVER'S GAP ───────
 * The channel resource carries nothing about the viewer's own pending request
 * (measured: `uuid, name, description, visibility, visibility_label, space,
 * is_member, my_role, my_notify_level, active_members_count, created_at,
 * updated_at`). So a reload puts "Ask to join" back. Pressing it again is
 * harmless — the server answers `200` for a request already waiting, a SUCCESS
 * — and lands the reader back on the same wait. Storing the press on this side
 * was the alternative and it would go stale the moment an admin decided, which
 * is worse than one extra press.
 *
 * Hook-free like everything else here: the screen owns the mutation.
 */
export function ChannelClosedState({
  channelName,
  asked,
  onAsk,
  isAsking,
  error,
}: {
  channelName: string;
  /** The server has taken the request — this reader is waiting. */
  asked: boolean;
  onAsk: () => void;
  isAsking: boolean;
  /** The server's own sentence from the last failed attempt, or `null`. */
  error: string | null;
}) {
  if (asked) {
    return (
      <CollabMessage
        icon={Clock}
        tone="neutral"
        title="You asked to join"
        description={`An admin of ${channelName} will decide. If they say yes, the channel opens for you.`}
      />
    );
  }

  return (
    <CollabMessage
      icon={Lock}
      tone="accent"
      title={`${channelName} is private`}
      description="Only its members can read it. Ask to join and an admin of the channel decides."
      action={
        <div className="flex flex-col items-center gap-2">
          <Button onClick={onAsk} disabled={isAsking}>
            {isAsking ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <LogIn aria-hidden className="size-4" />
            )}
            Ask to join
          </Button>
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      }
    />
  );
}

/**
 * ThreadClosedState — a thread whose PARENT the reader may not read.
 *
 * It is reachable and it is not the same shape as {@link ChannelClosedState}.
 * The server releases a thread's metadata to anyone who may see the parent
 * exists (a space member looking at a private channel), so a pasted thread
 * address lands here with a real title in hand and no way into the room it came
 * out of.
 *
 * ── AND IT CARRIES NO ACTION, WHICH IS THE WHOLE DIFFERENCE ────────────────
 * A private CHANNEL has a door: "Ask to join", and an admin decides. A thread
 * has none — `joinChannel` and `requestToJoin` both open with the same guard and
 * answer 422 ("Threads are not joined — post in one to follow it"). The way in
 * is to be let into the parent, which is a conversation with a person and not a
 * button on this screen. Offering one here would be a control that fails, which
 * is the one shape the access model forbids.
 */
export function ThreadClosedState({
  parentChannelName,
}: {
  /** `null` when the payload did not name the parent — see `Channel`. */
  parentChannelName: string | null;
}) {
  return (
    <CollabMessage
      icon={Lock}
      tone="accent"
      title="This thread is out of reach"
      description={
        parentChannelName === null
          ? "It branched out of a channel you are not in, and only that channel's members can read it. If somebody sent you here, ask them to let you in."
          : `It branched out of ${parentChannelName}, and only that channel's members can read it. If somebody sent you here, ask them to let you in.`
      }
    />
  );
}

/* ── Screen-level refusals ────────────────────────────────────────────────── */

/**
 * 403 — a POLICY refusal, never auto-mapped to verify-email (collab model's
 * rule).
 *
 * THE COPY DELIBERATELY DOES NOT NAME THE WALL, and measuring the shape only
 * made that more necessary. A private channel's detail is released to a space
 * member (`200`, measured 2026-08-10 — see `v2/features/collab/access.tsx`), so
 * a `403` here is NOT the private case at all. It is one of three: the reader is
 * outside the space, the channel is `hidden`, or it never existed. Those three
 * are meant to be indistinguishable, and naming any of them would tell the other
 * two readers something false.
 *
 * THAT IS ALSO WHY THIS PANEL CARRIES NO ACTION while the private one does. The
 * join route answers `404` for a hidden or absent channel, so an "Ask to join"
 * button here would be a control that fails — and its failure would be the
 * confirmation the `hidden` state exists to withhold.
 *
 * ── AND SINCE 2026-08-10 IT MUST NOT CONFIRM THE CHANNEL EXISTS ────────────
 * There is now a THIRD state, `hidden`, whose entire promise is that outsiders
 * cannot tell it is there. The old title — "You don't have access to THIS
 * channel" — quietly broke that: you only lack access to something real, so
 * anybody could confirm a hidden channel by pasting its address and reading our
 * refusal. The API is careful about this (it 404s the join route for exactly
 * this reason) and our copy was undoing it.
 *
 * The wording below asserts nothing about existence. It is equally true for a
 * channel that is hidden, one that is private, and one that never existed —
 * which is precisely what makes it safe, because we cannot tell those apart
 * from a 403 and must not appear to.
 */
export function ChannelAccessDeniedState() {
  return (
    <CollabMessage
      icon={Lock}
      tone="neutral"
      title="We couldn't open this channel"
      description="It may not be open to you, or it may not exist. If somebody sent you here, ask them to let you in."
    />
  );
}

/** Channel detail load failure. */
export function ChannelErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CollabFailure
      presentation="panel"
      icon={WifiOff}
      title="Couldn't load this channel"
      message="Something went wrong on our side. Please try again."
      onRetry={onRetry}
    />
  );
}

/* ── The whole screen's silhouette (route fallback + live pending) ───────── */

/**
 * The channel screen's frame at rest: the ONE header bar, the feed column, and
 * the transcript-width composer. `app/v2/channels/[channelId]/loading.tsx`
 * renders it `still` and inert; the live screen renders it (pulsing) while the
 * channel detail resolves. Geometry mirrors the live screen exactly — the same
 * bar height AT EACH WIDTH (`h-14` everywhere since the phone bar became the
 * screen's only bar in the mobile overhaul), the same
 * `max-w-3xl` column, the same composer cap — so the hand-off is content
 * resolving, not a layout swap.
 *
 * THE LEADING BAR IS SHAPED DIFFERENTLY PER WIDTH, because the live bar is: at
 * `md:`+ it reserves a short, heading-weight name; below `md:` the name is in
 * the shell bar and this row carries the channel's purpose on one quiet line,
 * so the shape that resolves is a full-width text run, not a 9rem stub.
 *
 * THERE IS NO TAB-STRIP ROW HERE ANY MORE, because there is none on the live
 * screen: the sections ride inside the bar at `md:`+ and a bottom bar on a
 * phone, and neither of those reserves a row above the transcript.
 */
export function ChannelScreenFrame({ still = false }: { still?: boolean }) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* The one header bar */}
      <div className="shrink-0 border-b">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <Skeleton className={cn('size-4 shrink-0 rounded', bar)} />
          <Skeleton
            className={cn('h-3.5 min-w-0 flex-1 rounded md:h-4 md:w-36 md:flex-none', bar)}
          />
          <Skeleton className={cn('hidden h-6 w-28 rounded-full md:block', bar)} />
          <div className="flex items-center justify-end gap-1.5 md:flex-1">
            <Skeleton className={cn('size-6 shrink-0 rounded-full', bar)} />
            <Skeleton className={cn('h-8 w-16 shrink-0 rounded-lg', bar)} />
          </div>
        </div>
      </div>
      {/* Feed column */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-3xl px-4 pt-4">
          <ChannelFeedSkeleton still={still} />
        </div>
      </div>
      {/* The composer, on the transcript's own column */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="v2-safe-bottom mx-auto w-full max-w-3xl px-4 pb-3">
          <Skeleton className={cn('h-13 w-full rounded-2xl', bar)} />
        </div>
      </div>
    </div>
  );
}
