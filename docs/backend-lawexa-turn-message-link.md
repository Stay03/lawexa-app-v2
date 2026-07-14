# Backend request — link each Lawexa turn to its triggering message

## What we need
Add **one field** to the `ai.turn_started` realtime broadcast: the uuid of the
channel message that triggered the summon.

## Why
The SPA renders a "Lawexa is responding… · Watch" affordance (and, on Watch, a
live peek of the turn) **anchored directly beneath the message that mentioned
`@lawexa`** — for every channel member watching, not just the summoner.

Today `ai.turn_started` carries `{ channel_uuid, execution_id, summoner }` but
not the message, so a member who did **not** send the summon has no reliable way
to know which message a given turn belongs to. (The summoner's own client already
gets the link from the `POST /channels/{uuid}/messages` response — `data.uuid`
plus `data.ai.execution_id` — so this only needs to reach *other* members, over
realtime.)

## The contract we'll consume
`ai.turn_started` payload gains `message_uuid`:

```jsonc
{
  "channel_uuid": "…",
  "execution_id": "…",
  "summoner": { "uuid": "…", "name": "…", "avatar_url": "…" },
  "message_uuid": "…"   // NEW: uuid of the channel message whose content
                        // mentioned @lawexa and started this turn — the same
                        // message that also broadcasts as `message.created`
                        // with metadata.lawexa_mentioned: true
}
```

That single addition is all we need. Nothing else about the summon/stream flow
changes.
