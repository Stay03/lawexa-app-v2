# Lawexa v2 — Backend Asks (Phase 1 draft)

Three consumable contracts the v2 **notification spine** needs. We're rebuilding Spaces/Channels
on a communication-grade unread & notification model — the full spec is
`docs/v2-docs/foundation-standards.md` §5 ("Unread & notification model"). That model is two
axes, Slack-style: **bold = unread**, **numeric badge = mentions only**, rolled up
channel → space → app (`document.title (n)` / favicon / app badge). To render it without hammering
the API we need unread/mention counts to arrive **in the list payloads we already fetch** and to
**update live over the socket we already hold open**.

Everything below is stated as the shape/semantics we'll consume, in the API's existing naming
style (snake_case fields, `*_count` counters, `*_label` enum siblings, members-only fields stamped
when known and omitted otherwise, leading-dot `broadcastAs` event names, the
`{ success, message, data }` envelope). Field placement references `types/collab.ts` and
`docs/channel-lists-and-files/frontend-contract.md`.

---

## Ask 1 — Unread & mention counts in the list payloads

**What we're building:** the bold-vs-badge unread model (standards §5). A channel row needs to know
its unread count (bold) and its mention count (badge); a space row needs the rolled-up version of
both so the Spaces list can show an activity dot + a summed mention badge without opening anything.

**Contract we'll consume.**

*On each `Channel` object* — in the space-channels list (`GET /api/spaces/{uuid}/channels`) and on
channel detail (`GET /api/channels/{uuid}`), beside the existing `unread_count`:

| field | type | meaning to us |
|---|---|---|
| `unread_count` | `number` | *(already shipped)* the caller's unread messages in this channel — drives **bold**. |
| `mention_count` | `number` | the caller's **unread** messages in this channel that @-mention them (their uuid ∈ the message's `metadata.mentions`) — drives the **numeric badge**. |

Both are per-requesting-member and **members-only** — stamped when the caller's membership is known,
omitted otherwise, exactly as `unread_count` behaves today.

*On each `Space` object* — in the spaces list (`GET /api/spaces`), beside `active_members_count`:

| field | type | meaning to us |
|---|---|---|
| `unread_channels_count` | `number` | how many channels in this space have ≥1 unread for the caller — any value > 0 drives the space **activity dot**. |
| `mention_count` | `number` | sum of the caller's `mention_count` across the space's channels — drives the space **badge number**. |

**Semantics that matter to us** (this is what the numbers must *mean*, not how to compute them):
a **muted** channel (`notify_level: "muted"`) must not contribute to `unread_channels_count`, but a
personal @-mention in it **still counts** toward `mention_count` — muted kills the bold/rollup, never
a direct @you (standards §5). Same members-only stamping convention as the channel fields.

**What happens if we don't have it:** we ship the model with **unread only** (we already have
`unread_count`) — bold channels, no mention badges, no space-level rollup. Degraded UX, not broken.
We would *not* add per-channel count-fetching loops to fake it.

**Priority:** blocks phase-5 collab — this is the data the whole unread/mention model renders from.

---

## Ask 2 — Live count events on the user channel

**What we're building:** live badges. When a message lands in a channel the caller isn't looking at,
their badges should update **without a refetch**. We already hold the caller's private user channel
open (`echo.private('users.{uuid}')` — the same channel that carries `.notification`), so that's
where we'd consume this.

**Contract we'll consume.** A per-message event on `users.{uuid}` (a leading-dot `broadcastAs` name
in the style of `.message.created` / `.list.changed`, e.g. `.channel.unread`) carrying the affected
ids and the caller's **new** per-channel counts:

```json
{
  "channel_uuid": "81b089c1-…",
  "space_uuid":   "7c7b24d8-…",
  "unread_count":  4,
  "mention_count": 1,
  "is_mention":    true,
  "message_uuid": "cf16cfbc-…"
}
```

| field | type | meaning to us |
|---|---|---|
| `channel_uuid` | `string` | which channel's badge to update. |
| `space_uuid` | `string` | which space's rollup to recompute (we sum our cached channels — no space totals needed in the event). |
| `unread_count` | `number` | the caller's **new** unread count for that channel (post-message). |
| `mention_count` | `number` | the caller's **new** unread mention count for that channel. |
| `is_mention` | `boolean` | whether **this** message is mention-grade for the recipient (their uuid ∈ `metadata.mentions`) — decides whether we surface a toast/sound vs. a silent badge bump. |
| `message_uuid` | `string` *(optional)* | the triggering message, so a mention toast can deep-link to it (`?m=`). Nice-to-have; without it we link to the channel. |

**Frequency / shape:** one event **per message**, to each member who should count it. We do **not**
need the message **body/content** in this event — the visible conversation already receives the full
message on its `channels.{uuid}` `.message.created` event; this one is purely for the badge/toast of
channels that aren't open.

**What happens if we don't have it:** badges only refresh when a list is refetched — we'd fall back
to short-interval polling of the counts (live tier), so badges lag by the poll window and cost extra
requests. Correct, just not live.

**Priority:** blocks phase-5 collab — without it the "message in an unopened channel badges within a
second" exit criterion can't be met live.

---

## Ask 3 — Push send-side status (event-driven pushes)

**What we're building:** push delivery for when the tab is closed — the last leg of the notification
spine (mention/invite/verification pushes deep-linking into the app).

**Context:** direct token delivery is verified working in prod; the open gap is that real in-app
events (channel **mentions**, channel/space/org **invites**, org **verification**) don't appear to be
producing pushes — a **send-side** (server → FCM) question. This is all documented in
`docs/backend-push-notifications.md`; we're not restating it here.

**What we're asking:**
1. **Confirm current status** of the event → push path for those events — is it firing in prod today?
2. **If it's broken**, that those documented events emit pushes using the **already-agreed data-only
   payload** (title/body/`url` in `data`, no top-level `notification` block) with the **relative
   `url` deep link** per the event→url table in that doc. Contract unchanged — `docs/backend-push-notifications.md`
   remains the source of truth; this ask is just "make the documented events actually send."

**What we'll consume:** the data-only payload our service worker already renders (the `data.title` /
`data.body` / `data.url` / optional `data.tag` keys documented in that file). No new shape.

**What happens if we don't have it:** in-app realtime (Ask 2 + Echo) still covers every notification
while a tab is open; only the **app-closed** case goes dark. Push UX is degraded, the rest of the
spine is unaffected.

**Priority:** blocks push UX (the closed-tab path), not the in-app phase-5 flows.

---

## Note on scope

Nothing in here prescribes implementation. We're not specifying how counts are stored or computed,
how the event is queued or fanned out, which broadcaster/transport carries it, auth, caching,
headers, status codes, or retry/dead-token handling — those are the backend team's calls. We've
described only the **payload/event shapes and field semantics** the v2 client will read, in the
naming style the API already uses. Field names, event name, and exact placement are all open to
whatever fits the existing conventions best — treat the shapes above as the contract we need to
consume, not a mandated design.

---

## RESPONSE — DELIVERED (backend team, July 18, 2026)

All three asks answered. **Phase 5 (collab + notification spine) is unblocked** — the realtime
badge model can be built exactly as specced. Authoritative contract now lives in the backend repo
`frontend-contract.md §17–19` (Stay03/lawexa-api-v3 docs/channels) — read it before phase 5.

**Ask 1 — counts in list payloads: COMPLETE.**
- New `channel_message_mentions` pivot maintained transactionally on post/edit/AI-reply; historic
  data via `lawexa:backfill-message-mentions` (chunked, idempotent, `--dry-run`).
- `mention_count` on every channel row + channel detail (same single query as `unread_count`).
- `unread_channels_count` + `mention_count` rollups on the spaces list + space detail. Muted
  channels excluded from the activity-dot count, but their direct @mentions still badge (Slack
  rule = **Ruling A**). **Ruling B**: AI mentions badge only when `ai_mentions_notify` is on. R2
  notification behavior unchanged.

**Ask 2 — live events: COMPLETE (incl. beyond-spec).**
- `ChannelUnreadCountsUpdated` broadcasts **`.channel.unread` on `users.{uuid}`** with exactly the
  6-key contract we asked for — absolute, self-healing counts, never any message content.
- Four firing paths, one shared `ChannelUnreadCountBatch` (drift-guard test locks them to the
  list-payload semantics): **post** (fan-out to other active members, ~6 constant queries
  regardless of channel size), **markRead** (multi-device badge-clear echo, only on a real pointer
  advance), **edit** (only members whose mention-membership changed), **delete** (count correction
  to all).
- **Client-side rule (adopt in phase 5): gate toasts by `my_notify_level`.**

**Ask 3 — push: CONFIRMED code-complete, nothing to build.** It's a prod runtime check, not a
frontend task: push-token rows exist → `php artisan lawexa:diagnose-push {uuid}` → verify queue
worker + `failed_jobs`. (So the audit's "push send-side may be broken" is a deploy/runtime concern,
not code.)

---

## Related — the cases read endpoints (July 25, 2026)

Phase 4 wave 1 rebuilt the case library, the case page and the full judgment. The endpoints
that reader uses, and four open questions about them, are in
[`backend-ask-2026-07-25-cases-read-endpoints.md`](backend-ask-2026-07-25-cases-read-endpoints.md).
The one that can cost a reader something they paid for: **does `GET /api/cases/{slug}`
record a view and spend a plan unit on every request?** One reader reading one case can
produce up to five of those calls, two of them from a shared link's preview.

---

## Related — a second backend exchange (July 18, 2026)

Separate from the three notification-spine asks above, a second backend coordination round — the
statute node-cap / `outline` reader alignment plus **Ask A** (recently-viewed) and **Ask B**
(cross-space my-channels) — is recorded in
[`backend-reply-2026-07-18-statutes-cap-and-asks.md`](backend-reply-2026-07-18-statutes-cap-and-asks.md).
Both endpoints have since been **DELIVERED and consumed** (wired in `6da0025`: recently-viewed →
Study tab, cross-space channels → the Work tab's "Jump back in").
