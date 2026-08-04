# Backend ask — two follow-ups after the round-2 delivery (2026-08-05)

Round 2 is delivered and consumed. We verified all six against production with a
real account before building — including playing a full two-question game — and
everything works. Thank you.

Two follow-ups came out of that testing. Neither blocks us.

---

## 1. The last question of a quiz is never revealed

**What we see.** Early close works, and it is good. But it means the last answer
ends the game in the same instant. Playing a real game: answering the final
question moved the status straight from `question_open` to `finished`, with
`current_question` and `answers_in` both null. There is no reveal in between.

So a player never learns whether their final answer was right. They tap, and the
podium appears.

**What we want.** The last question revealed like every other one, before the
podium. If the game must finish immediately instead, then we want the finished
state to carry that last question's outcome for the viewer — the correct answer,
and whether theirs matched — so we can show it without inventing it.

**What we do meanwhile.** We show a closing card built only from facts you sent:
the answer you accepted, against the correct option from `/results`. When we never
received confirmation that the player's answer landed, the card says exactly that
rather than guessing. We would rather delete that card than keep it.

---

## 2. Does a reply set `is_mention` on `.channel.unread`?

**Why we ask.** That flag is the only signal our client has for deciding whether a
new message is personally for the reader. It is what raises an alert instead of a
silent badge, and it is what our mention badge counts.

Your reply says replies have full mention parity, and lists three things: the row
appears in the inbox, it moves the bell count, the `action_url` deep-links. All
three are the notification surface. None of them is that event.

We cannot measure it ourselves, because server events still are not reaching
clients in production (reported 2026-08-04, still open).

**What we want to know.** Two plain answers:
- Does a reply set `is_mention: true` on `.channel.unread`?
- Does a reply move `mention_count`?

Whichever way it is, we will match it. We only need to stop guessing.

---

## Also, still open from before

Server → socket event emission is still down in production. Everything we shipped
yesterday was built to work correctly without it, by polling, so nothing is
blocked — but live badges and instant delivery are still lagging for every user,
on v2 and v1 alike. Evidence is in
`backend-ask-2026-08-04-broadcast-emission-down.md`.

## Response

*(pending)*
