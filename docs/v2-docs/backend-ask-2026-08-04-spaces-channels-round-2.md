# Backend ask — Spaces, Channels and live quiz, round 2 (2026-08-04)

## Context

Spaces v2 is live for preview users. The owner tested it and raised eleven points.
Six of them are things we cannot build from the current API. They are listed
below, each with what we want to consume. Shape and method are your call.

Two of the six (asks 1 and 2) are new product behaviour. The other four are gaps
between what the screen has to show and what the API returns today.

---

## 1. A new space should start with one channel

**Today.** `POST /api/spaces` returns the space alone. The creator lands in a room
with nothing in it, meets an empty state, opens a second dialog, and creates a
channel by hand before anything can happen. The happy path passes through three
empty screens in a row.

**What we want.** Creating a space also creates one channel inside it, in the same
act. The create response tells us which channel that is, so we can put the creator
straight into a room that works. The name and the visibility are your choice; we
render whatever comes back.

**Why not on our side.** We could make a second call, but then a failed second call
leaves a space with no channels and nothing to repair it. v1 still creates spaces
too, and would keep producing empty ones. The rule "a space always has a channel"
belongs where the space is made.

**Priority: high.** It is the first thing every new user meets.

---

## 2. A reply should notify the person who was replied to

**Today.** `POST /channels/{uuid}/messages` accepts `reply_to_uuid` and stores it.
No notification is created. The author of the original message learns about the
reply only by opening the channel and reading.

**What we want.** When someone replies to a message, the author of that message is
notified. Same treatment a mention gets today: the notification appears in the
notification list, it moves the bell count, and opening it lands on the reply in
the channel. Do not notify a person who replies to their own message. A muted
channel stays silent, the same rule mentions already follow.

**Priority: high.** Owner asked for it directly. Without it a reply is invisible.

---

## 3. Reading a public channel before joining

**Today.** Reading messages needs active channel membership. A person who has not
joined sees the channel name and a member count, and nothing else. There is also
no way to find a space you are not already in — every list is scoped to your own
memberships.

**What we want.** A person can read a public channel before they join it: the
message history, the member list, and the description. They still cannot send,
reply, react, pin, save, upload, tick list items, or join a quiz until they join.

Tell us which of those reads you can open. We will shape the screen around exactly
what you allow, and keep the join wall for everything else.

**Priority: medium.** It changes how people discover the product, so it is worth a
decision even if the answer is no.

---

## 4. Notifications should agree with what the user has already read

**Today.** Reading a channel clears the channel's own unread count. It does not
touch the notification list. So the bell keeps showing a mention long after the
user has read that message, and the count no longer matches what they have seen.

We cannot fix this on our side. `NotificationResource` returns `id`, `type`,
`title`, `message`, `action_url`, `icon`, `read_at`, `created_at` — and for every
channel notification, `title`, `message` and `icon` come back empty, so those rows
render with no words at all. The row also does not say which channel or which
message it belongs to, so we cannot match a notification to the channel the user
just read without guessing from the link text.

**What we want, in order of preference.**

1. When a user reads a channel, the notifications that point into that channel stop
   counting as unread. Then the bell and the channel always agree, on every device.
2. If that is not something you want to do, then each notification row should tell
   us which channel and which message it belongs to, and carry the words it should
   display — who wrote it, in which channel, and a short preview. We will mark them
   read ourselves and render them properly.

Either answer also fixes the second problem: channel notifications currently show
as the bare word "Notification" with no body text.

**Priority: high.** It is visible on every mention, and it makes the count look
broken.

---

## 5. Live quiz — four gaps

The game is playable and the polling path works. These four are what the screen
cannot show honestly today.

**5a. A stalled game should recover.** A game can stop moving and sit on its last
question long past the `ends_at` it published. The only way out is cancel, and
cancel throws the scores away. We want a game that has stopped to recover by
itself and still reach `finished` with its results intact. We are not asking for a
manual next button.

**5b. Tell us when a question is the last one.** `is_final` exists on the
`question_closed` broadcast but nowhere in `GET /api/quiz-games/{game}`. Our
clients receive no websocket events at the moment, so the state read is all we
have. We want the state read alone to tell us the game is on its final question,
so the screen can say what comes next instead of going quiet.

**5c. Who has answered, and how fast.** While a question is open we want to show
the room who has already answered and how quickly. We want a per-question list of
the players whose answers are in, in arrival order, each with their identity and
their response time. We need it inside the state read as well as on the live event.
The list must not show what anyone picked, or whether they were right, until the
reveal.

**5d. The gap between questions.** After a question closes there is a pause before
the next one opens, and it has no published length, so we cannot draw a countdown
for it. We want a server timestamp for when the next question opens, in the same
clock as `opens_at` and `ends_at`. Separately: if every joined player has already
answered, the question could close then instead of running out a timer nobody
needs.

**Priority: 5a and 5b high** (they are why a game appears to freeze), 5c and 5d
medium (they are the missing feel of a live game).

---

## 6. Lawexa conversation history returns the assembled prompt

**Today.** `GET /channels/{uuid}/ai/sessions/{session}` returns the conversation
turns. The `role: "user"` rows do not carry what the person typed. They carry the
prompt that was built for the model: a `<channel_context …>` block wrapping recent
channel history, then `[timestamp] Request from <name>: <the real question>`.

**What we want.** The `user` turns return the person's own words, and say who they
are. If the assembled prompt is still useful to you, keep it somewhere else on the
row — we just need the human's question to be a field of its own.

We are working around this for now by recovering the question from the text, which
breaks the moment the prompt format changes.

**Priority: medium.** The screen is readable with our workaround, but the workaround
is fragile.

---

## Response

*(pending)*
