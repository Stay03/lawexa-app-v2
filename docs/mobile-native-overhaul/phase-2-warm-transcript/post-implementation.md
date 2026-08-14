# Phase 2: the message is already there, what shipped

Date: 14 August 2026.

## What is in the app now

**`v2/features/channels/warm.ts`** holds the whole behaviour and every reason to
decline it. It is called from two places:

1. **The spine**, in `handleChannelUnread` (`spine.tsx`), the moment the app
   hears that a message arrived in a channel the reader is not looking at.
   Mentions bypass the throttle.
2. **The notification bell**, in `handleSelect`, one beat before it navigates.
   This is the case the event cannot cover: the app opened cold from a push,
   where no socket event was ever received and the press is the first the client
   hears of that channel.

The toast's Open action needed nothing. A toast only exists because the event
arrived, and the spine already warmed on that event.

**It refuses to run** when somebody is looking at that channel (measured by
asking the query cache whether any messages entry has an observer, which also
keeps a fetch from racing the room's socket writers), when the message is already
cached, when the reader has data saver on, and more than once per channel per 15
seconds unless it is a mention.

**Two fetch shapes.** Cold, it prefetches page one and swallows errors. Warm but
stale, it fetches with `staleTime: 0` and `pages: 1`, which refreshes the head
and truncates that background entry to a single page. That truncation is
deliberate and is written down in the module: a plain refetch of an infinite
query re-downloads every page the reader ever loaded, so its cost scales with how
deep they once scrolled in a channel they are not even looking at.

## What was measured

Both halves were filmed against the production build and the real API.

**The press path**, from a completely cold browser sitting on Notes:

| Measurement | Result |
|---|---|
| Transcript request after the press | 1, at +58ms, before the channel screen existed |
| The first painted transcript | 30 rows, and the message the notification was about was already among them |
| Total transcript requests for the whole journey | 1 |
| Pressing a notification for the channel already on screen | 0 extra requests |

The single request is the point: the screen's own query found the warmed cache
and did not fetch again.

**The socket path.** An unread event only fires for other people's messages, and
I have one account, so the film summons the AI in my own private workspace: a
real message by a real other author, on the real socket, bothering nobody. With
the browser sitting on Notes the whole time:

- the `channel.unread` frame arrived on the websocket, carrying the channel and
  the counts and no content, exactly as the wire contract says;
- the app then fetched that channel's newest page **on its own, without the
  channel ever being opened**, within the first five second window;
- exactly one background request, not a burst.

## The unread line

The gold line's position is `messages.length - unread_count`, computed once and
frozen for the view session. Against a transcript missing its newest rows the
count and the rows disagree, so the line could sit above messages already read.
Warming makes them agree before the freeze. This was found while reading the
feed's model for this phase, not reported by anyone.

## What is left

- **The backend ask** is written in `plan.md` and has not been sent yet: we want
  the realtime event a member receives about a new message to carry the same full
  message body the transcript renders, so a client that is not in the channel's
  room can place it without a follow-up request. That is what makes Telegram and
  WhatsApp conversations already-there. Nothing in this phase depends on it.
- **The writers in `cache.ts` still have no in-flight guard.** Writing into an
  infinite query while a fetch is in flight is silently overwritten when the
  fetch resolves (TanStack/query#3579, closed as wontfix). This phase avoids the
  race by never warming a channel somebody is watching, but the underlying gap is
  real and should be closed the next time that file is opened.
