# Backend — LIVE REGRESSION: the quiz migration detached existing quizzes (2026-08-05)

Reported after the owner hit an error opening a channel's quiz. Measured against
production the same hour, with a real account that owns everything involved.

**Summary: existing quizzes lost their channel, and their finished games are now
403 to the people who ran them — while the new public link serves the same game
to anyone with no login at all.**

## What we measured

One account. It owns the space, owns the channel, created the quizzes, hosted and
played the game.

**1. Quizzes created inside a channel now have no channel.**

```
GET /api/channel-quizzes/mine        → 200, 3 quizzes
    every one:  "channel_uuid": null
```

All three were created yesterday with `POST /api/channels/{channel}/quizzes` — in
a channel, not in a library. Your reply says *"existing quizzes keep their channel
and every existing call behaves exactly as before"*, and that the migration only
relaxes the column to nullable. These rows read as though the channel was cleared.

**2. So the channel's own lists are now empty.**

```
GET /api/channels/{channel}/quizzes     → 200, count 0
GET /api/channels/{channel}/quiz-games  → 200, count 0
```

The channel has three quizzes created in it and two games played in it. Under the
new meaning — "created here *or* played here at least once" — both paths should
return them. Both return nothing.

**3. And the games are now unauthorized to their own host.**

```
GET /api/quiz-games/{game}          → 403 "This action is unauthorized."
GET /api/quiz-games/{game}/results  → 403 "This action is unauthorized."
GET /api/public/quiz-games/{game}/results → 200, full podium
```

Same game, same moment. The signed-in host, channel owner and space owner is
refused; the anonymous public endpoint serves it. That inversion is the clearest
statement of the problem: the permission chain resolves through the quiz's
channel, the quiz no longer has one, and the check falls into the same refusal
branch you use for an unknown channel.

Game uuid, if it helps you trace it: `771fc24e-cb4c-4f00-baa8-ce93911278a9`.
Quiz uuid: `d3d93ec9-783f-43c6-a910-3bdb89ff9742`.

## What this means for users right now

Every quiz made before this deploy is invisible on the channel it was made in,
and every game already played is unopenable by the people who played it. Opening
a quiz in a channel errors. This is what the owner reported.

## What we would like

1. Restore the channel on quizzes that had one. If the migration cleared it, the
   games still carry their channel — `quiz_games.channel_id` is intact, which is
   how the public endpoint still resolves the game — so the origin can be
   recovered from the earliest game per quiz where nothing else survives.
2. Make the permission check tolerate a quiz with no channel. A library quiz is
   now a legitimate state, and a game already carries the channel it ran in; the
   game's own channel is the right thing to authorize against, not the quiz's
   birthplace.
3. Confirm the two lists return quizzes and games that were played in a channel,
   not only those born there.

We have changed nothing on our side and are not working around it — a client that
papered over a 403 here would be hiding a real refusal.

## Response

*(pending)*
