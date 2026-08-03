# Backend ask — Channels/Spaces: what changed since July 18? (2026-08-03)

## Context

We are about to rebuild Spaces/Channels on the v2 interface (phase 5 of the frontend
overhaul). Before we lock the plan, we need the current state of the API.

Our last full sync was your **July 18, 2026 reply** to the notification-spine asks
(recorded in [`backend-asks.md`](backend-asks.md); contract in your repo at
`docs/channels/.../frontend-contract.md` §17–19). You told us you have **added new
features to channels and spaces since then**. We do not know what they are yet, and we
do not want to design v2 screens against an out-of-date picture.

## What we ask

1. **List everything new or changed since July 18, 2026.** New endpoints, new response
   fields, new realtime events, changed meanings of existing fields — anything the
   frontend can consume or must handle. A pointer to the updated sections of your
   contract docs is enough; we will read them.

2. **AI turn ↔ message link.** Our open ask
   ([`docs/backend-lawexa-turn-message-link.md`](../backend-lawexa-turn-message-link.md)):
   AI reply messages carry no execution/turn id, so the "Lawexa is responding" row
   matches replies to summons by guessing (oldest active turn). Did this ship? If yes:
   which field, on which payloads and events?

3. **Lists and files.** Any additions or changes since
   [`docs/channel-lists-and-files/frontend-contract.md`](../channel-lists-and-files/frontend-contract.md)?

4. **Event pushes in prod.** Your July 18 reply said the event → push path (mentions,
   invites, org verification) was code-complete and only needed a prod runtime check
   (`lawexa:diagnose-push`). What was the result? Are those pushes firing in prod today?

5. **Deprecations.** Is anything in the current channels/spaces API going to be
   renamed, changed, or removed soon? We are about to build a new UI on this surface
   and do not want to build on moving ground.

## For your awareness (no action needed)

The v2 interface preview is now open to **every registered account**, opt-in via the
in-app Developer toggle. The Spaces feature itself keeps its current frontend
soft-launch audience (researcher/admin) until the v2 rebuild ships. We will send the
rebuild's own asks, if any, once the phase-5 study is done.

## Response

*(pending)*
