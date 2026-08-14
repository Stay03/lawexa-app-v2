# Phase 2: the message is already there

Owner: "when I see a notification that I have a new message, if I open the
channel/thread I don't see the new message immediately at the bottom, it takes a
quick second before I see that message at the bottom. Can't the app load it in
the back so when I check it's already there instead of appearing right in front
of my eyes."

## Why it is late, from the code

Traced end to end, and every claim below is a file that was read.

1. The **full body of a new message is broadcast only to the room of the channel
   that is currently on screen**. `v2/features/channels/room.ts` joins the
   presence room when the channel screen mounts and leaves when it unmounts.
2. App wide, the only thing the client receives is `.channel.unread` on the
   viewer's own channel, and it carries `channel_uuid`, `space_uuid`,
   `unread_count`, `mention_count`, `is_mention` and `message_uuid`. The wire
   contract says it in as many words: no message content ever rides it
   (`v2/runtime/realtime/protocol.ts:33`).
3. The spine's handler (`spine.tsx:118-156`) writes the counts, rolls them up to
   the space, and dispatches a toast for a mention. **It never touches the
   channel's message cache.**
4. The transcript query is deliberately never stale
   (`staleTime: Infinity`, `queries.ts:246`), because socket events are meant to
   be the staleness signal and re-entering a busy channel must paint from cache
   instantly.
5. So opening the channel paints the cached transcript, **without the new
   message**, and the only thing that goes and gets it is the reconcile that runs
   when the room joins (`room.ts:575-586`), which starts after the screen has
   already drawn. When it lands, the row animates in. That animation is what the
   owner is watching.

**And there is a second defect underneath it.** The unread line's position is
computed once from `messages.length - unread_count` and then frozen for the view
session (`feed-model.ts:115-122`). Computed against a transcript that is missing
the newest rows, the gold line sits above messages the reader has already read.
Warming the transcript fixes the divider as a side effect, because the count and
the rows finally agree.

## What the industry does

Two shapes, and ours is the first one.

- **Slack** pushes a signal and the client prefetches. Their own engineering
  writing says it plainly: "If at any time you get a new message in a channel, we
  can pre-fetch history and practically guarantee the channel will be synced
  before you view it." It is ranked and capped, one small page per channel.
- **Telegram and WhatsApp** push the content itself, so every conversation is
  warm because delivery is storage.

We are on Slack's wire, so we take Slack's answer, and the backend ask that
would move us to the second shape is written down but not depended on.

## What we build

**One warming step, in the spine, on the event we already receive.**

`v2/features/channels/warm.ts`, called from `handleChannelUnread` after the
counts are written, and from the two places a person can tap a notification.

It refuses to run in five cases, each for a reason:

1. **Somebody is looking at that channel.** Measured by asking the query cache
   whether any messages entry for it has an observer. The room owns the open
   channel, and a fetch racing the room's socket writers is the known TanStack
   race where a resolving fetch silently overwrites a socket write
   (TanStack/query#3579, closed as wontfix).
2. **The message is already in the cache.** `findCachedMessage` already exists
   for this (`cache.ts:463`).
3. **The reader asked for less data.** `navigator.connection.saveData`.
4. **Too soon.** One warm per channel per 15 seconds, the same shape as the
   existing per-space cold-fallback ledger. A burst in a busy channel must not
   become a fetch per message.
5. Except a **mention**, which bypasses the throttle, because a mention is the
   notification a person actually taps.

When it does run there are two cases:

- **Cold** (nothing cached for that channel): `prefetchInfiniteQuery` fetches
  page one. Errors are swallowed, which is what prefetch is for.
- **Warm but stale** (cached, but missing this message): `fetchInfiniteQuery`
  with `staleTime: 0` and `pages: 1`. This refreshes the head **and truncates
  that background entry to one page**, which is deliberate: refetching every
  loaded page costs whatever depth the reader once scrolled to, and a reader
  returning to a channel lands at the bottom anyway. Older pages come back on
  demand when they scroll up.

**And on the tap itself.** The notification bell's row press
(`V2NotificationBell.tsx:349`) knows the channel before it navigates, so it
warms first. This is what covers the case the event-time warm cannot: the app
opened cold from a push notification, where no socket event was ever received
and the press is the first the client hears of that channel.

The toast's Open action needs nothing: a toast only exists because the event
arrived, and the spine warmed on that same event, with the throttle bypassed
because it was a mention.

## What we are not doing

- Not warming every channel the user belongs to. The event stream is the bound.
- Not adding a minimum display time or any other delay to hide the gap.
- Not touching the reconcile. It stays for correctness; after a warm fetch it
  returns identical rows and the feed's stability contract keeps the paint still.

## The backend ask, one sentence

We want the realtime event a member receives about a new message to carry the
same full message body the transcript renders, so a client that is not in the
channel's room can place the message into its history without a follow-up
request. Written to backend, not depended on by this phase.

## How it is verified

Gates, then film.

Playwright at 390x844, against the real API with two accounts is not available,
so the film drives the client directly:

1. With the channel closed, deliver a `.channel.unread` for a message the cache
   does not have, and assert page one of that channel's cache contains the
   message **before** any navigation happens.
2. Open the channel and assert the newest message is present in the very first
   painted frame, measured by reading the transcript's last row immediately
   after the feed mounts, not after a settle.
3. Assert the warm step does nothing at all when that channel is on screen.
4. Assert the throttle: ten events in a row for the same channel produce one
   fetch.
5. Assert a mention bypasses the throttle.
6. Assert nothing warms when `saveData` is on.

## Definition of done

Opening a channel from a notification shows the message that the notification was
about, in the first frame, with the unread line in the right place.
