# Backend — CORRECTED: it is not the quiz migration, it is channel deletion (2026-08-05)

**This document replaces what we sent you earlier today. The earlier version blamed
the quiz migration for detaching quizzes. That was wrong, and we are sorry for the
noise.** We re-measured against production, could not reproduce the detachment, and
then found the real cause with a controlled test. The corrected finding is smaller
but real, and it is below.

## What we got wrong

We reported that quizzes created inside a channel came back with `channel_uuid: null`,
and concluded the migration had cleared the column. It had not. Re-measured today:

```
POST /api/channels/{channel}/quizzes  → 201, channel_uuid = that channel   ✅
GET  /api/channels/{channel}/quizzes  → 200, the quiz is on the list       ✅
POST /api/channel-quizzes/{quiz}/go-live {} → 201, game.channel_uuid set   ✅
GET  /api/quiz-games/{game}           → 200 to the host                    ✅
```

Everything in your reply behaves as documented. The three detached quizzes we
measured had simply outlived the channel they were made in — that channel had been
deleted, which is also why its lists later 404'd. We should have checked whether the
channel still existed before writing to you.

## The real finding: deleting a channel strands its games

Controlled test, run end to end on production today. One account, its own space:
create a channel → create a quiz in it → go live → play the game to `finished` →
read everything → delete the channel → read the same things again.

**Before the delete**

```
GET /api/channel-quizzes/{quiz}            → 200, channel_uuid = the channel
GET /api/channels/{channel}/quizzes        → 200, count 1
GET /api/quiz-games/{game}                 → 200
GET /api/quiz-games/{game}/results         → 200
GET /api/public/quiz-games/{game}/results  → 200   (anonymous)
```

**After `DELETE /api/channels/{channel}` — nothing else changed**

```
GET /api/channel-quizzes/{quiz}            → 200, channel_uuid = null
GET /api/channel-quizzes/mine              → 200, still listed, channel_uuid = null
GET /api/quiz-games/{game}                 → 403 "This action is unauthorized."
GET /api/quiz-games/{game}/results         → 403 "This action is unauthorized."
GET /api/public/quiz-games/{game}/results  → 200   (anonymous — full podium)
```

So a finished game becomes unreadable to the host who ran it, the moment the room
it happened in is deleted — while the public link keeps serving that same game to
anyone with no login at all. The signed-in owner is refused; the stranger is not.
That inversion is the part worth fixing.

The quiz surviving in the owner's library with `channel_uuid: null` looks correct
to us under the new model — provenance is gone because the room is gone. We are
only flagging the games.

## What we would like

1. **Authorize a game against the game's own channel, not the quiz's origin.**
   `quiz_games.channel_id` is intact after the delete — it is how the public
   endpoint still resolves the game. When that channel is gone, a played game
   should still be readable by the people who played it (the host at minimum), or
   it should 404 honestly. A 403 that an anonymous request can walk around is the
   one answer that cannot be right.
2. **Tell us which you intend**, so we can build the matching state. Either is
   workable for us and we will design for whichever you pick:
   - the game outlives its channel and its players keep their result; or
   - the game dies with its channel, and the members-only endpoint returns 404.

   Right now we cannot tell a real refusal from a stranded record, so we cannot
   write honest words for the reader.

## For the record — everything else measured clean

`attachment_ids` on send, `attachments` on every message, the duplicate and
unknown-file 422s, `reply_to.attachment_count`, files surviving an edit, deleting a
library file removing it from its messages, the library create, `visibility`,
`is_mine`, go-live with an explicit `channel_uuid`, the 403 on a library quiz with
no room named, and the anonymous public results — all as documented. The only
correction to your prose is that a channel's quiz list returns library quizzes with
`channel_uuid: null`, which your reply does say and which we have now confirmed on
a real wire.

## Response

*(pending)*
