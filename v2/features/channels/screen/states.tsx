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
import { PlaceCrest, SpaceCrest } from '@/v2/features/collab/kit/Crest';
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
 * EVERY SHAPE IN HERE PULSES, in the route fallback and on the live screen
 * alike. One wait gets one appearance: a reader cannot tell an RSC payload from
 * a query, so a frozen fallback that begins shimmering at the hand-off reads as
 * the load starting again, which is exactly what the owner filmed on this
 * screen.
 */

/* ── Feed shapes ──────────────────────────────────────────────────────────── */

/** One author-run skeleton — avatar + name/time bar + one or two text bars, at
 *  the `MessageGroupRow` geometry INCLUDING its measure, so the swap from
 *  skeleton to text moves no line ending. */
function MessageGroupSkeleton({
  lines,
  nameWidth,
}: {
  lines: 1 | 2;
  nameWidth: string;
}) {
  return (
    <div className="flex gap-3 px-1">
      <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
      {/* `text-[0.9375rem]` with no text in it: `ch` resolves against the
          element's own font size, so this is what makes the skeleton's 66ch
          the SAME width as the body text that replaces it. */}
      <div className={cn('min-w-0 flex-1 space-y-2 text-[0.9375rem]', MESSAGE_MEASURE)}>
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-3.5 rounded" style={{ width: nameWidth }} />
          <Skeleton className="h-3 w-10 rounded" />
        </div>
        <Skeleton className="h-3.5 w-4/5 rounded" />
        {lines === 2 && <Skeleton className="h-3.5 w-3/5 rounded" />}
      </div>
    </div>
  );
}

/** The feed's pending shape — a realistic median of author runs with the
 *  house progressive-opacity fade (§8iv: reserve near the middle). */
export function ChannelFeedSkeleton() {
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
          <MessageGroupSkeleton lines={row.lines} nameWidth={row.nameWidth} />
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
 * renders it inert; the live screen renders it while the channel detail
 * resolves. It pulses in both, because both are the same wait to the reader.
 *
 * ── THE BAR IS TRACED OFF `ChannelPlaceHeader`, ELEMENT BY ELEMENT ─────────
 * Same wrapper (`v2-screen-bar`, so the notch strip is padded in BOTH states —
 * without it a notched phone dropped the whole screen by the inset the moment
 * the real bar arrived), same `max-w-3xl px-4` column, same `h-14` row, same
 * `gap-2`, and the same children in the same order at each width:
 *
 *   below `md:`  back chevron (`size-10`, `-ml-2`) · space crest (`size-8`
 *                `rounded-lg`) · a TWO-LINE stack, the channel over its purpose
 *                · the faces · one overflow button
 *   `md:` and up the visibility glyph · the heading-weight name · the space
 *                chip (`md:` → `lg:` only, where the live one runs)
 *
 * That list is the whole contract, and it is worth stating plainly because
 * breaking it is what the owner filmed on 15 August 2026: the frame still drew
 * the pre-phase-3 bar — one small square and a full-width text run — so the
 * channel's name landed 112px to the left of where the real header would put
 * it and slid across the screen on hand-off. A skeleton that reserves the wrong
 * shape is worse than no skeleton: it promises a layout and then breaks it.
 *
 * IF `ChannelPlaceHeader`'S PHONE ROW CHANGES, THIS CHANGES WITH IT. There is
 * no shared component to enforce that — the live bar holds a crest, a heading,
 * a presence stack and a menu, none of which a hook-free inert fallback may
 * mount — so the enforcement is this note and a measured screenshot.
 *
 * THERE IS NO TAB-STRIP ROW HERE, because there is none on the live screen:
 * the sections ride inside the bar at `xl:`+ and a bottom bar on a phone, and
 * neither reserves a row above the transcript.
 *
 * ── AND WHEN THE LIST ALREADY KNEW, IT SAYS SO ─────────────────────────────
 * Owner, 15 August 2026: "why have full skeletons that are empty when the list
 * page it's coming from already has some of the details needed". The row the
 * reader tapped carries the channel's name, its purpose and its space — so with
 * `identity` supplied the bar prints them from the first frame and the only
 * thing that resolves later is the conversation itself.
 *
 * ONLY WHAT CANNOT BE STALE IS TAKEN. A name, a purpose and a space crest are
 * settled facts about the room; whether this reader may WRITE in it is not, and
 * is never seeded — the screen still waits for the detail before it rules on
 * access, so nothing here can put up a Join button it has to take back. See
 * {@link ChannelFrameIdentity}.
 */

/**
 * What the frame may print before the channel detail lands: exactly the fields
 * a cached list row carries and nothing derived from a permission.
 */
export interface ChannelFrameIdentity {
  /** `channelDisplayName` of the row — a thread's title, a channel's name. */
  name: string;
  /** `channelPhoneSubtitle` of the row — the same line the live bar prints. */
  subtitle: string;
  /** The visibility glyph shown at `md:` and up. */
  visibility: Channel['visibility'];
  visibilityLabel: string;
  space: Channel['space'];
}

export function ChannelScreenFrame({
  identity = null,
}: {
  /** The tapped row's identity; `null` on a cold arrival keeps the silhouette. */
  identity?: ChannelFrameIdentity | null;
}) {
  const VisibilityIcon = identity
    ? channelVisibilityFace(identity.visibility).icon
    : null;
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* The one header bar — see the docblock: this traces the live one. */}
      <div className="v2-screen-bar shrink-0 border-b bg-background">
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="flex h-14 items-center gap-2">
            {/* Phone: the way back. A box, not a bar — the glyph inside the
                live control is what this reserves, and it is centred in the
                same 40px target. It stays a shape even when the identity is
                known: the frame is inert, and a chevron that cannot be pressed
                is worse than one that has not arrived. */}
            <div className="-ml-2 flex size-10 shrink-0 items-center justify-center md:hidden">
              <Skeleton className="size-5 rounded" />
            </div>

            {/* Phone: the identity cluster, crest + two lines. `flex-1` because
                the live one is, so the trailing cluster sits at the same end of
                the row in both. */}
            <div className="flex min-w-0 flex-1 items-center gap-2 py-1 pr-1 md:hidden">
              {identity ? (
                <SpaceCrest
                  uuid={identity.space.uuid}
                  name={identity.space.name}
                  type={identity.space.type}
                  size="sm"
                  className="size-8 shrink-0 rounded-lg"
                />
              ) : (
                <Skeleton className="size-8 shrink-0 rounded-lg" />
              )}
              {identity ? (
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="min-w-0 truncate text-sm leading-tight font-semibold text-foreground">
                    {identity.name}
                  </span>
                  <span className="min-w-0 truncate text-[11px] leading-tight text-muted-foreground">
                    {identity.subtitle}
                  </span>
                </span>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32 max-w-full rounded" />
                  <Skeleton className="h-2.5 w-20 max-w-full rounded" />
                </div>
              )}
            </div>

            {/* `md:` and up: glyph, name, space chip. The chip is a `span` and
                not the live `Link` — nothing in a fallback may be pressable. */}
            <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
              {VisibilityIcon ? (
                <VisibilityIcon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
              ) : (
                <Skeleton className="size-4 shrink-0 rounded" />
              )}
              {identity ? (
                <span className="min-w-0 truncate text-base leading-tight font-semibold">
                  {identity.name}
                </span>
              ) : (
                <Skeleton className="h-4 w-36 shrink-0 rounded" />
              )}
              {identity ? (
                <span className="hidden min-w-0 max-w-56 shrink items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 text-xs text-muted-foreground md:inline-flex lg:hidden">
                  <SpaceCrest
                    uuid={identity.space.uuid}
                    name={identity.space.name}
                    type={identity.space.type}
                    size="sm"
                    className="size-5 rounded"
                  />
                  <span className="min-w-0 truncate">{identity.space.name}</span>
                </span>
              ) : (
                <Skeleton className="h-6 w-28 shrink-0 rounded-full lg:hidden" />
              )}
            </div>

            {/* The faces, at `HereNow`'s own resting geometry — three discs,
                `-space-x-1`, ringed in the background so the overlap reads. */}
            <div aria-hidden className="flex shrink-0 -space-x-1">
              {[0, 1, 2].map((index) => (
                <Skeleton
                  key={index}
                  className="ring-background size-6 rounded-full ring-2"
                />
              ))}
            </div>

            {/* The overflow. Icon-only below `sm:`, where the live button drops
                the word "More". */}
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg sm:w-[4.5rem]" />
          </div>
        </div>
      </div>
      {/* Feed column */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-3xl px-4 pt-4">
          <ChannelFeedSkeleton />
        </div>
      </div>
      {/* The composer, on the transcript's own column. 82px is the live
          composer's resting height, measured at 390px — a text row over its
          own row of controls. `h-13` reserved 52px, which is the box without
          the controls, so the transcript's clearance shrank by 30px the moment
          the real one mounted. */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="v2-safe-bottom mx-auto w-full max-w-3xl px-4 pb-3">
          <Skeleton className="h-[5.125rem] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
