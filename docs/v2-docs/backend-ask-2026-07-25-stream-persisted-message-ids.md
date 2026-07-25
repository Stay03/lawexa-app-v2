# Backend ask — which messages did this stream save?

**One field, on the event that ends a chat stream.**

---

## What we are building

Cross-tab and cross-device freshness on the conversation screen.

Open `/c/{id}` in two places. Send a message in the second place. Return to the first
place. The first place must show the new message, at the bottom, without a reload.

We do this by fetching the conversation again and adding only the messages we do not
already show. Nothing on screen is replaced, because our rows carry state the history
payload does not return (the model's reasoning trace, and live tool progress).

## What already works

`GET /api/conversations/{id}` identifies every message twice — by `id`, and by
`metadata.seq`. Both are stable and both are the same in every browser tab.

So when a screen only ever loaded history, "which messages am I missing?" is an exact
comparison. That case needs nothing from you.

## The gap

A message the client wrote **itself**.

When the user sends a turn, we draw the rows immediately from the stream, before the
server has saved anything. Those rows never learn which saved messages they became. The
terminal event tells us the turn finished; it does not tell us what was written.

So on a screen that has sent a turn, we cannot tell "the server's copy of the message I
am already showing" apart from "a new message from the other tab". Adding it would show
the user their own message twice.

**We cannot derive this from the `seq` values we already receive.** The user's own
message is never delivered as a stream event, so no event carries its identity.

Today we therefore refuse to merge on such a screen. The user waits until they re-open
the conversation. Nothing is ever wrong; it is simply late.

## Contract we will consume

On the event that **ends** a stream — `completed`, and equally the cancelled and error
terminal events — the identifiers of the messages that execution saved.

| field | type | meaning to us |
|---|---|---|
| `persisted_seqs` | `number[]` | the `metadata.seq` of every message this execution wrote, **including the user's own message** |

Either identifier works for us: the message `id` values or the `metadata.seq` values.
Both appear on the messages returned by `GET /api/conversations/{id}`, and matching
against that payload is the only thing we do with them. Use whichever is natural — if
you send `id` values, name the field to match (`persisted_message_ids`).

Field name and shape are stated in the API's existing style; the substance is the list
itself.

## Semantics that matter to us

- **It must include the user's message.** That is the one we draw before it is saved,
  and the one we cannot identify any other way. Without it the field does not solve the
  problem.
- **It should cover every message the execution wrote** — the user message, tool rows,
  handover rows, and the assistant answer — so a screen that used tools reconciles as
  cleanly as one that did not.
- **Cancelled and errored turns need it too**, on their own terminal event, covering
  whatever was saved (for example a partial assistant message).
- **Order does not matter. Repeats do not matter.** We only ever test membership.
- **Confidential conversations save nothing on the server.** An empty list or an absent
  field is correct there, and we will treat both the same way.

## What happens if we do not get it

We ship the merge with a stated limit: a screen that has sent a message during the
current visit stops merging until it is re-opened. Correct, never wrong, just late.

With the field, the limit disappears and the behaviour is the same everywhere.

## Size

Small. A handful of numbers, on one event, once per turn. No new endpoint, no new
payload shape, no change to any list.
