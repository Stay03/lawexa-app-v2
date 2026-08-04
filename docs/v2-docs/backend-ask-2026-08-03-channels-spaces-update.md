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

## Response — DELIVERED (backend team, same day; recorded 2026-08-04)

Full reply:
[`Stay03/lawexa-api-v3` → `docs/frontend-replies/reply-2026-08-03-channels-spaces-update.md`](https://github.com/Stay03/lawexa-api-v3/blob/main/docs/frontend-replies/reply-2026-08-03-channels-spaces-update.md)
— read it in full before locking the phase-5 plan. Headlines:

1. **Six things shipped since July 18** (all on `main`, deployed):
   - **Admin AI-session observability** (Jul 18) — admin-only routes
     (`/api/admin/channel-ai-sessions*`, `/api/admin/memories*`), integer-id binding is
     deliberate. No member-facing change. Matters for phase 8, not phase 5 screens.
   - **Message engagement, phases 3b–3f** (Jul 25) — replies (`reply_to_uuid` →
     `reply_to`), read receipts (`last_read_message_uuid` + `.read.updated`), private
     message bookmarks, pins (`.message.pinned`/`.message.unpinned`), emoji reactions
     (`.reaction.toggled`). All events ride the existing presence room. Authoritative
     contracts are each phase's `post-implementation.md` "Frontend wire contract" —
     the phase-1 contract docs are NOT consolidated for bookmarks/pins/reactions yet.
     Note the field-placement table in the reply (`is_bookmarked` and `reactions`
     never broadcast).
   - **uuid-only cleanup** on read/members (Jul 25, small breaking pass, already live):
     `last_read_message_uuid` replaces the int in the markRead response; member rows
     lost their int `id` (key on `member.user.uuid`); one unified 422 copy.
   - **Channel files accept `.zip`** (Jul 27). Content-based validation. UI duties:
     render archives download-only (no "Lawexa can read this"), plus a short
     "archives aren't scanned" note.
   - **Live quiz in channels** (Aug 3) — Kahoot-style games on
     `/api/channel-quizzes/*` + `/api/quiz-games/*`, 8 events on the same presence
     room. Contract: `docs/api/channel-quiz.md`. Touches surfaces we already render:
     two new message `metadata.type` values (`quiz_game_live`, `quiz_game_finished`,
     Lawexa-authored, carrying `metadata.game_uuid`/`quiz_uuid`) **can appear in prod
     feeds today**, and a new channel setting `settings.quiz_host_policy`
     (`all_members` default | `admins_only`). v1 impact checked: unknown types fall
     through to a normal Lawexa bubble — degraded, not broken.
2. **Turn ↔ message link SHIPPED** (built same day in response to this ask):
   `metadata.execution_id` on every AI channel message, in both the broadcast and
   history (one serializer). Equals `ai.turn_started`'s `execution_id` — pill matching
   becomes exact. `null` on pre-Aug-3 messages, so keep the client TTL as fallback.
   Bonus: `metadata.session_uuid` on every AI reply → the session transcript endpoint,
   which now returns the complete conversation including tool rows (same shapes as the
   personal conversation payload).
3. **Lists/files**: only the zip change.
4. **Event pushes confirmed delivering in prod** (two send-side defects fixed Jul 13).
   Client prerequisite unchanged: token registration per device, delete on logout.
5. **No deprecations** — the surface in the reply is what v2 should be built on; any
   future breaking change comes as an ask first. Upcoming additive:
   `POST /api/channel-quizzes/{quiz}/duplicate`.

Deploy caveat from their side: quiz migrations were being confirmed the same day —
early 500s on quiz endpoints mean the migrations, not our client.
