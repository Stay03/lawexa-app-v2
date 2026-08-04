# Backend report — server-emitted realtime events are not reaching Reverb in prod (2026-08-04)

## Severity

High. Every live feature of Spaces/Channels depends on these events: live message
delivery, unread badges, read sync, the Lawexa responding indicator — and the
whole live quiz. This is not new breakage from our side: v1 in prod has the same
dependency and is silently degraded the same way right now.

## What we measured (prod, 2026-08-04, ~11:34 UTC)

A wire probe using a real verified account (id 10882), its own fresh space and
channel, two websocket connections to `wss://ws.lawexa.com`:

1. **Works:** login; space/channel creation; message POST; markRead POST (the
   response carries the new `last_read_message_uuid` — thank you);
   `POST /api/broadcasting/auth` for both `private-users.{uuid}` and
   `presence-channels.{uuid}` (both subscriptions succeeded); the `@lawexa`
   summon dispatched (`status: "dispatched"`, execution_id + stream_url
   returned).
2. **Works:** a client whisper (`client-typing`) sent on socket A arrived on
   socket B in ~250ms — so the Reverb server itself relays fine and origins/auth
   are correct.
3. **Broken:** ZERO server-emitted events arrived on either socket over ~2.5
   minutes of activity: no `.message.created` (not even for a plain post, on a
   second socket), no `.channel.unread` (markRead echo), no `.read.updated`, no
   `.ai.turn_started`. The Lawexa reply also never appeared within 100s.

Conclusion: the path **backend → Reverb** is not emitting (or a queue that
carries broadcasts is not running). The path **client → Reverb → client** is
healthy.

## What we ask

1. Check the prod broadcast path (queue workers, `BROADCAST_CONNECTION`, Reverb
   app credentials on the emit side) and restore event emission.
2. Tell us when it is back — we will re-run the same probe within minutes. Two
   of our open contract questions can only be answered on a live wire: whether
   `ai.turn_started` carries `message_uuid`, and the `metadata.execution_id` on
   AI replies.
3. If the Lawexa reply failure is a separate queue issue, flag that too — the
   summon dispatched but no reply message ever posted.

## Frontend posture meanwhile

The v2 rebuild ships REST-first and self-heals: feeds load and refetch normally,
and the moment emission returns, badges and live delivery start working with no
frontend change. No action needed from you on our code.

## Response

*(pending)*
