# Channels/Spaces v2 — Backend Contract Digest (compiled 2026-08-04)

Condensed from the backend repo so phase-5 implementers can design without re-reading
the sources. On any doubt, the sources win. Compiled by an agent from the live docs
and cross-checked; one open contradiction is flagged in §F item 7.

Sources (all in `Stay03/lawexa-api-v3`):
- `docs/channels/phases/phase-1-foundations/frontend-contract.md` (§1–19) — "FC"
- `docs/channels/phases/phase-1-foundations/api-contract.md` (§1–12) — "AC" (authoritative for shapes; supersedes FC on disagreement)
- `docs/channels/phases/phase-3{b,c,d,e,f}-*/post-implementation.md` — "3b…3f" (their "Frontend wire contract" sections are authoritative for engagement)
- `docs/api/channel-quiz.md` — "QZ"
- `docs/channel-lists-and-files/frontend-contract.md` — "LF"
- `docs/frontend-replies/reply-2026-08-03-channels-spaces-update.md` — "RP" (names/paths only; contradictions flagged)
- `docs/frontend-replies/reply-2026-08-05-usernames-and-tagging.md` — usernames + tagging (§F.19; supersedes the old mention rule everywhere)

Baseline note: the cross-space `GET /api/channels` list and "recently-viewed" exist (RP calls them consumed baseline) but their contract lives in the July-18 exchange docs, not in any source above — resolve from local code, not this digest.

---

## A. MESSAGE OBJECT today

Sources: AC §6, FC §14, 3b–3f, QZ "Chat cards", RP §1b/§2.

| Field | Type / shape | In REST history | In `message.created`/`updated` broadcasts | Live update path |
|---|---|---|---|---|
| `uuid` | string | yes | yes | — |
| `channel_uuid` | string | yes | yes | — |
| `is_ai` | bool — `true` ⇒ Lawexa-authored (AI reply, `ai_divider`, or quiz card). THE discriminator; never infer AI from `author: null` | yes | yes | — |
| `author` | `{uuid,name,username,avatar_url}` \| `null` (`null` = Lawexa OR hard-deleted human; disambiguate via `is_ai`). `username: string \| null` is the unique `@handle` — the ONLY thing tagging matches (§F.19); `null` = not taggable, and still `null` on every production account as of 2026-08-05 | yes | yes | — |
| `content` | string ≤8000 | yes | yes | `message.updated` replaces bubble |
| `metadata.type` | `"text"` (or absent) · `"ai_divider"` · `"quiz_game_live"` · `"quiz_game_finished"` | yes | yes | — |
| `metadata.mentions` | `[{uuid,name,username}]` — resolved members only; AI messages parse mentions identically. `username` (2026-08-05) is the handle that resolved and the key a renderer must match the body's `@token` on; `null` on mentions recorded before that date (no backfill), whose bodies hold name slugs instead — §F.19 | yes | yes | re-parsed on edit |
| `metadata.unmatched_handles` | `string[]` — handles the writer typed that matched nobody (2026-08-05). **The message still posts**: a hint for the WRITER, never an error. `@lawexa` never appears here. Absent on pre-deploy messages — §F.19 | yes | yes | re-parsed on edit |
| `metadata.lawexa_mentioned` | bool | yes | yes | — |
| `metadata.execution_id` | string \| `null` — on every AI-authored message (since 2026-08-03); equals `ai.turn_started`'s / summon response's `execution_id` exactly. `null` on human messages AND pre-2026-08-03 AI history (no backfill) | yes | yes (one serializer builds both — cannot disagree) | arrives with the bubble |
| `metadata.session_uuid` | string \| `null` — the AI session behind an AI bubble; feed it to `GET /channels/{uuid}/ai/sessions/{session}` for the full transcript. Same null rules as `execution_id` | yes | yes | — |
| `metadata.game_uuid`, `metadata.quiz_uuid` | strings — ONLY on `quiz_game_live` / `quiz_game_finished` system cards (Join / Results actions) | yes | yes | — |
| `reply_to` (3b) | `null` \| `{uuid, is_ai, author(slim\|null), content_preview(~200 chars, null when deleted), is_deleted, type}`. Preview is a **live read**: editing the target updates it; deleting the target sets `is_deleted:true` | yes | yes | rides `message.created`/`updated` |
| `edited_at` | timestamp \| null | yes | yes | `message.updated` |
| `created_at` | ISO-8601 | yes | yes | — |
| `is_pinned` (3e) | bool — **always present**, shared, same for everyone | yes | **yes** (safe: derived from column) | `message.pinned` / `message.unpinned` events |
| `pinned_by {uuid,name}` + `pinned_at` (3e) | detail | **pins list only** | no | — |
| `is_bookmarked` (3d) | bool — per-viewer | feed + saved list **only** | **never** (deliberately omitted after a real bug: broadcasts used to hardcode `false`) | REST list + toggle response only |
| `reactions` (3f) | `[{emoji, count, reacted_by_me}]`, count-desc then first-reacted; `[]` when none | feed **only** | **never** (per-viewer) | apply `reaction.toggled` deltas |

Members-list companion field: `last_read_message_uuid` (3c) rides each row of `GET /channels/{uuid}/members` (null = never read), updated live via `read.updated`.

---

## B. REALTIME EVENTS

Echo names: `Echo.join('channels.{channelUuid}')` (wire: `presence-channels.{channelUuid}`; active channel members ONLY — governors/admins refused) and `Echo.private('users.{myUuid}')` (wire: `private-users.{uuid}`). **All custom names — listen with the leading dot.** Sources: FC §3–6, §12, §18; AC §7, §12c; 3c/3e/3f; LF §5; QZ events.

### On `channels.{channelUuid}` (presence)

| Event | Payload keys | Fires when | Client action |
|---|---|---|---|
| `.message.created` | full message object (minus `is_bookmarked`/`reactions`) | any post, incl. AI replies + quiz cards | append bubble; if AI, clear pill matching `metadata.execution_id` |
| `.message.updated` | same shape, `edited_at` set | edit | replace bubble |
| `.message.deleted` | `{uuid, channel_uuid}` | delete | drop bubble |
| `.member.joined` | `{channel_uuid, member{slim}, role}` | self-join, invite-accept (not creator at creation) | add to roster |
| `.member.left` | same | leave/removal (**NOT** space-leave cascades) | remove; if it's YOU → `Echo.leave` + drop state |
| presence `here/joining/leaving` | `{uuid, name, avatar_url}` (member id **is** the uuid) | connect/disconnect | online list |
| whisper `typing` | `{uuid, name}` (client-to-client, never hits server) | keydown, throttled ~2s | show ~3s indicator |
| `.ai.turn_started` | `{channel_uuid, execution_id, summoner{slim}, message_uuid}` — **flag:** FC §12 includes `message_uuid` (anchor the pill under it); AC §12c's table omits it. AC claims to win on disagreement, but FC is the updated realtime contract — verify on the wire before relying on `message_uuid` | summon dispatched | show "Lawexa is responding" pill; optionally open glance SSE |
| `.ai.turn_failed` | `{channel_uuid, execution_id}` | turn ended with no postable reply (**nothing posts on failure** — only signal) | clear pill |
| `.read.updated` (3c) | `{user_uuid, last_read_message_uuid}` | only on a real pointer advance (no-ops silent) | mark all messages up to that uuid read-by-that-user |
| `.message.pinned` / `.message.unpinned` (3e) | `{message_uuid, is_pinned, pinned_by_uuid, pinned_at}` | actual state change only | update pinned bar + pin icon |
| `.reaction.toggled` (3f) | `{message_uuid, emoji, count, user_uuid, reacted}` | actual change only | set that emoji's count; if `user_uuid` is me, set my `reacted_by_me = reacted` |
| `.list.changed` (LF) | `{action: created\|updated\|deleted\|item_changed, list}` — `list` is the FULL object WITH `items` | every list/item mutation, human or Lawexa | replace whole list in place; on `deleted` drop by uuid |
| `.file.changed` (LF) | `{action: added\|removed, file}` | upload/delete | add/drop file |
| `.quiz.game.live` | `{game}` (full game shape incl. players) | go-live | show lobby/join card state |
| `.quiz.game.player_joined` | `{game_uuid, user{slim}, player_count}` | join | update lobby list |
| `.quiz.game.countdown` | `{game_uuid, countdown_ends_at, question_count}` | host starts | render 30s countdown from server timestamp |
| `.quiz.game.question_opened` | `{game_uuid, index, question_count, question (no is_correct!), opens_at, ends_at}` | question opens | show question + timer from `ends_at − now` |
| `.quiz.game.answer_progress` | `{game_uuid, index, answered_count, player_count}` | per accepted answer | progress meter |
| `.quiz.game.question_closed` | `{game_uuid, index, correct_option_id, option_counts[{option_id,count}], no_answer_count, is_final, leaderboard?}` (`leaderboard` only when `settings.show_leaderboard`) | reveal | show answer + pick chart (+ leaderboard) |
| `.quiz.game.finished` | `{game_uuid, podium, ranking}` — arrives **immediately after** the final `question_closed` (`is_final:true`) | game ends | hold last reveal ~3–5s, then podium |
| `.quiz.game.cancelled` | `{game_uuid, cancelled_by{slim}\|null (null = stale-lobby auto-cancel), status_before}` | cancel/auto-cancel | tear down; no results, no chat card |

### On `users.{myUuid}` (private)

| Event | Payload keys | Fires when | Client action |
|---|---|---|---|
| `.channel.unread` | `{channel_uuid, space_uuid, unread_count, mention_count, is_mention, message_uuid}` — counts are **ABSOLUTE** | see §D triggers | **assign** badges (never increment); re-roll space badge; toast only after mute check |
| `.notification()` (Echo notification handler) | FC §6 documents `n.type: channel_mention \| channel_invite \| space_invite \| organization_invite` + payload (channel uuid/name, message uuid, author slim, preview, `action_url`) | mention/invite events | bump inbox badge. Note: the DB inbox (`GET /api/notifications`) shows class-style `type` (`ChannelMentionNotification` …, AC §10) — two different surfaces; don't assume the strings match |

---

## C. ENDPOINTS (member-facing v2)

Envelope `{success, message, data}`; length-aware pagination everywhere except **messages + AI session transcript = cursor** (`?cursor=`, newest-first, ≤50/page). Users always slim `{uuid,name,avatar_url}`. Statuses: 401 unauth · 403 policy · 404 unknown/foreign-parent · 409 conflict/state · 422 validation · 429 throttle. Sources: AC (orgs/spaces/channels/messages/push/AI), FC §1/§15, 3d/3e/3f, LF, QZ.

**Organizations** (AC §3)
- `GET /api/organizations` — list; filters `search,type,is_verified,city,state,country,sort,order`
- `POST /api/organizations` — create (`name`,`type` req)
- `GET/PUT/DELETE /api/organizations/{uuid}` — show (roster members-only) / update (owner-admin; type frozen once verified) / delete (owner)
- `GET/POST /api/organizations/{uuid}/members` — roster / invite (`email` XOR `user_uuid` + `role`; **30/min**; dup→409, unknown email→422)
- `PUT/DELETE /api/organizations/{uuid}/members/{userUuid}` — role change / remove
- `GET /api/organization-invitations`; `POST /api/organization-invitations/{memberRowId}/accept|reject` — **path param is the member row's integer id**
- `GET /api/my-organization`; `POST /api/my-organization/leave`
- `POST /api/organizations/{uuid}/request-verification` — multipart `bn_number` + `cac_document` (pdf/jpg/png ≤10 MB)
- `POST/DELETE /api/organizations/{uuid}/logo`

**Spaces** (AC §4)
- `GET /api/spaces` — list stamps `my_role`; + `unread_channels_count`, `mention_count` (FC §17)
- `POST /api/spaces` — `name`,`type(work|study)` req; `organization_uuid` only if org owner/admin; `is_private` defaults `true`
- `GET/PUT/DELETE /api/spaces/{uuid}`
- `GET/POST /api/spaces/{uuid}/members` (invite **30/min**); `PUT/DELETE .../members/{userUuid}`
- `POST /api/spaces/{uuid}/leave` — owner with others present → 400 "Transfer ownership…"
- `POST /api/spaces/{uuid}/transfer-ownership` `{user_uuid}` — old owner demoted to `admin`
- `GET /api/space-invitations`; `POST /api/space-invitations/{memberRowId}/accept|decline`

**Channels** (AC §5)
- `GET /api/spaces/{space}/channels` — non-channel-members see `space_public` only; rows carry `is_member,my_role,my_notify_level,settings(members+governors),unread_count,mention_count,last_message_at`
- `POST /api/spaces/{space}/channels` — space owner/admin; `name ≤80`, `visibility(space_public|private)`
- `GET/PUT/DELETE /api/channels/{uuid}` — settings incl. `ai_mentions_notify` (bool, default false) and `quiz_host_policy` (`all_members` default | `admins_only`)
- `POST /api/channels/{uuid}/join` — public only, must be space member; private → 403
- `POST /api/channels/{uuid}/leave`
- `GET /api/channels/{uuid}/members` — rows carry `last_read_message_uuid`; `notify_level` on **your own row only**; `user.username` is the tag handle, `null` = not taggable (§F.19)
- `POST /api/channels/{uuid}/members` — invite (**30/min**); invitee must be active space member else 422
- `PATCH /api/channels/{uuid}/members/me` `{notify_level: all|mentions_only|muted}` — the ONLY way to change notify level
- `PUT/DELETE /api/channels/{uuid}/members/{userUuid}` — role change (rejects notify_level) / remove
- `GET /api/channel-invitations`; `POST /api/channel-invitations/{memberRowId}/accept|decline`

**Messages + engagement** (AC §6, 3b–3f)
- `GET /api/channels/{uuid}/messages` — cursor, newest-first
- `POST /api/channels/{uuid}/messages` — **60/min**; `content ≤8000`, optional `reply_to_uuid` (must be live message in SAME channel else 422); response gains `data.ai` only when `@lawexa` mentioned
- `PATCH .../messages/{messageUuid}` — author only; edit never summons Lawexa
- `DELETE .../messages/{messageUuid}` — author or admin; soft delete
- `POST /api/channels/{uuid}/read` `{message_uuid}` — monotonic; returns `{last_read_message_uuid, unread_count}`; invalid/foreign uuid → one uniform 422 copy
- `POST .../messages/{messageUuid}/bookmark` — toggle, **60/min** → `{bookmarked}` (201 add/200 remove); any active member (viewMessages)
- `GET /api/channels/{uuid}/messages/bookmarks` — my saved messages here, offset-paginated
- `POST .../messages/{messageUuid}/pin` → `{is_pinned:true}`; `DELETE .../pin` → `{is_pinned:false}` — **any member may pin AND unpin anyone's pin**; first-pinner-wins; idempotent; deleted target→422, cross-channel→404
- `GET /api/channels/{uuid}/messages/pins` — `pinned_at DESC`, rows add `pinned_by{uuid,name}`+`pinned_at`
- `POST .../messages/{messageUuid}/reactions` `{emoji}` — toggle, **60/min** (RP) → `{emoji, count, reacted_by_me}` (200 both ways)

**AI (Lawexa in channels)** (AC §12, FC §11–15) — all gate on active membership
- `data.ai` on message POST: `{status: dispatched|blocked, execution_id?, stream_url?, reason?}`; blocked = show privately to summoner, nothing posted
- `GET /api/chat/stream/{execution_id}?token=…` — glance SSE, any active member, multi-viewer, `Last-Event-ID` replay, late attach safe
- `POST /api/channels/{uuid}/ai/reset` — **10/min**, idempotent 200, posts `ai_divider`
- `GET /api/channels/{uuid}/ai/sessions` — length-aware; `{uuid,status(active|expired|closed),started_by,previous_session_uuid,message_count,started_at,last_activity_at,ended_at}`
- `GET /api/channels/{uuid}/ai/sessions/{session}` — cursor; **complete** transcript incl. tool machinery (distinguish by `role`+`metadata.type`; filter for dialogue); wrong channel → 404

**Lists** (LF §2–3)
- `GET /api/channels/{channelUuid}/lists` — index rows carry `items_count`/`checked_count`, NO items
- `POST /api/channels/{channelUuid}/lists` — **30/min**; optional pre-filled `items` ≤100
- `GET /api/lists/{listUuid}` — with `items` (position-ordered)
- `PUT/DELETE /api/lists/{listUuid}` — creator or governance chain
- `POST /api/lists/{listUuid}/items` — **60/min**, appends
- `PATCH /api/lists/{listUuid}/items/{itemUuid}` — **60/min**; `content` and/or `is_checked`; any member; checking stamps `checked_at/checked_by`
- `DELETE /api/lists/{listUuid}/items/{itemUuid}`
- `POST /api/lists/{listUuid}/items/reorder` — **60/min**; full ordered uuid set exactly once else 422

**Files** (LF §4) — files use **integer id**
- `GET /api/channels/{channelUuid}/files` — completed uploads only
- `POST /api/channels/{channelUuid}/files` — **30/min**, multipart `file`, ≤15 MB, allow-list `pdf doc docx txt rtf csv xlsx pptx zip jpg jpeg png gif webp`, content-sniffed (renamed .exe still 422s)
- `GET /api/files/{id}/download` — member-gated
- `DELETE /api/channels/{channelUuid}/files/{id}` — uploader or governance chain

**Quiz authoring** (QZ) — gated by `settings.quiz_host_policy`
- `POST /api/channels/{channel}/quizzes` — 1–20 questions, 2–4 options exactly one correct, `true_false` = exactly 2, timer 5–60s (default 20); 201 returns author view (with `is_correct`)
- `GET /api/channels/{channel}/quizzes?per_page&page&mine=1` — rows carry `question_count`, no questions
- `GET /api/channel-quizzes/{quiz}` — `is_correct` only for viewers who may edit (author / channel owner-admin / **space governor** / platform admin — note governors DO see quiz answers, unlike messages)
- `PUT /api/channel-quizzes/{quiz}` — `questions` array = full replacement (new uuids/ids); 409 while live or once played
- `DELETE /api/channel-quizzes/{quiz}` — 409 while live
- (Upcoming, additive: `POST /api/channel-quizzes/{quiz}/duplicate`)

**Quiz games** (QZ)
- `POST /api/channel-quizzes/{quiz}/go-live` — 201 lobby, host auto-joined; 409 if a game is live in the channel
- `GET /api/channels/{channel}/quiz-games?active=1&per_page` — history; `active=1` = live probe (0 or 1 rows)
- `GET /api/quiz-games/{game}` — **the reconnect endpoint**; full state envelope
- `POST /api/quiz-games/{game}/join` — idempotent, same envelope; 403 late-join off, 409 over
- `POST /api/quiz-games/{game}/start` — host only; 409 not in lobby
- `POST /api/quiz-games/{game}/answer` `{question:"<uuid>", option_id:12}` → `{option_id, response_ms}` (no correctness); 403 not joined/joined late · 409 not open/stale/deadline/already answered · 422 foreign option
- `POST /api/quiz-games/{game}/cancel` — host or channel owner/admin, space governor, platform admin
- `GET /api/quiz-games/{game}/results` — finished only (409 running/cancelled, distinct messages)

**Infra**
- `POST /api/broadcasting/auth` `{channel_name, socket_id}` — bearer; 401/403
- `POST /api/notification-channels/push` `{token(100–512), device_name?}` — idempotent upsert, reassigns others' tokens; `DELETE` same path — **JSON body required** (form-encoded 422s on DELETE)
- `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`

---

## D. UNREAD / NOTIFICATION MODEL

Source: FC §17–19 (authoritative badge contract), AC §6/§10.

**Channel rows** (list + show, members only — present only when `my_role` is): `unread_count` (non-deleted messages past my pointer) + `mention_count` (unread messages that @mention me). Muted members still get `mention_count`.

**Space rows** (list + show): `unread_channels_count` — count of channels with ≥1 unread (**muted channels EXCLUDED**) → the blue dot; `mention_count` — total unread @mentions across the space's channels (**muted channels INCLUDED**) → the red number. This is Ruling A: mute kills notifications and the bold/unread rollup, never a direct @you badge.

**`.channel.unread`** on `users.{myUuid}`: `{channel_uuid, space_uuid, unread_count, mention_count, is_mention, message_uuid}`. Counts are **absolute, recomputed server-side** — assign, never increment; dropped frames self-heal on the next event. No message content ever rides it. Fires:
1. Message posted → every other active member (author excluded); `is_mention:true` only for mentioned members.
2. Read pointer advanced → **the marking user only** (multi-device echo); always `is_mention:false`; only on a real forward move.
3. Message edited → only members whose mention-membership changed (added → `true`, removed → `false`); everyone else — and the editor — gets nothing; edits never move `unread_count`.
4. Message deleted → ALL active members incl. the deleting author; always `false`.

**Toast/sound gating** is client-side by `my_notify_level`: a muted member still RECEIVES `.channel.unread` (badge stays accurate) but must not toast/sound. Check mute first, then use `is_mention` for mention-toast vs plain bump.

**Ruling B (AI mentions)**: Lawexa's `@mentions` always render from `metadata`, but they move badges/notify ONLY when the channel's `settings.ai_mentions_notify` is on (default **false**). Off ⇒ the AI post's `.channel.unread` has `is_mention:false` and unchanged `mention_count`. Human mentions always count.

**markRead**: `POST /channels/{uuid}/read {message_uuid: newest visible}` when the user views the channel; monotonic (backward/stale = silent no-op, no broadcasts); response `{last_read_message_uuid, unread_count}` syncs the badge without a refetch. A real advance also broadcasts `.read.updated` to the presence room (receipts) and `.channel.unread` to your own devices.

---

## E. LIVE QUIZ

Source: QZ; gaps confirmed in RP §1e.

**Lifecycle**: `lobby → countdown (30s) → question_open ⇄ reveal → finished`; terminal `cancelled` from any non-terminal state. One live game per channel (409). Host plays too (auto-joined). Server is the referee — no "next" button, clients never keep authoritative time; render every countdown from the ISO-8601 sub-second server timestamps (`countdown_ends_at`, `opens_at`, `ends_at`); at zero, wait for the next event (server may be ±1s).

**Rules**: speed scoring `round(1000 × (1 − (response_ms/limit_ms)/2))` (instant ≈1000, buzzer 500, wrong/none 0, ~1s network grace scores 500, ties by first-to-score); one immutable answer per player per question; `is_correct` never on the wire before reveal; late joiners (per-quiz `allow_late_join`, default on) play from the NEXT question; idle lobby auto-cancels at 10 min; cancelled games leave no results and no chat card.

**The 8 events** (payloads in §B): `quiz.game.live`, `player_joined`, `countdown`, `question_opened`, `answer_progress`, `question_closed`, `finished`, `cancelled` — all on the existing `presence-channels.{channelUuid}` room, no new subscription.

**Reconnect**: on socket (re)connect or app resume → `GET /api/quiz-games/{game}` → render from the state envelope (`game` with leaderboard-ordered players, `current_question` — null outside question phases, with `correct_option_id`/`option_counts`/`no_answer_count` and `your_answer.is_correct`/`points` present **only during reveal**) → keep listening. Missed events are harmless; the GET is authoritative. Late join = `POST join` (idempotent, same envelope).

**System cards**: `metadata.type: "quiz_game_live"` (join card) and `"quiz_game_finished"` (results link) arrive as ordinary messages via `message.created` + history, carry `metadata.game_uuid` + `metadata.quiz_uuid`, bump `last_message_at`, and are Lawexa-authored (`is_ai:true`, `author:null`). They can appear in prod feeds **today** — handle them before the quiz UI exists.

**Known gaps**: no duplicate-quiz endpoint yet (question edits 409 once real plays exist; duplicate-as-draft is the planned escape hatch); `quiz.game.finished` arrives immediately after the last reveal — client holds the reveal ~3–5s before the podium.

---

## F. GOTCHAS

1. **Leading dot on every custom event** (`.message.created`, `.channel.unread`, `.quiz.game.live`, `.list.changed`, …). Echo names are `channels.{uuid}` / `users.{uuid}`; the wire prefixes `presence-` / `private-` — that's what goes into `broadcasting/auth`'s `channel_name`. (FC §3–4, AC §7)
2. **Fields that never broadcast**: `is_bookmarked` and `reactions` are per-viewer and are deliberately OMITTED from `message.created`/`updated` and post/edit responses. Never read them off broadcasts — a `message.updated` would silently wipe your state. `is_pinned` is the safe shared one. (3d, 3f, RP §1b table)
3. **`is_ai` is the only AI discriminator.** `is_ai:false` + `author:null` = hard-deleted human, not Lawexa. Same rule for lists (`is_ai` vs null `creator`). (FC §14, LF §7)
4. **uuid-only… with exceptions**: member surface is uuid-only (Jul 25 pass), but files use integer `id` (and `File.uploader` is `{id, name}` — not the slim shape); invitation accept/decline paths take the **member row's integer id**; quiz options use numeric `id` relative to their question; admin routes bind by integer id deliberately. (AC, LF §1, QZ, RP §1a/§1c)
5. **Don't string-match 422 copy**: markRead now returns one uniform `"The message does not belong to this channel."` for foreign AND non-existent uuids (anti-oracle). Key off status + field, never message text. (RP §1c, AC §6)
6. **`metadata.execution_id`/`session_uuid` are `null`** on all AI history before 2026-08-03 (no backfill) — keep a client-side pill timeout as fallback; `ai.turn_failed` covers failures (nothing posts on failure). In `tool_post` mode several bubbles share one `execution_id` — the FIRST match clears the pill. (RP §2, FC §12)
7. **Contradiction flag — `ai.turn_started.message_uuid`**: FC §12 documents it (anchor the pill beneath that message); AC §12c's event table omits it, and AC declares itself the winner on disagreement. FC is the more recently updated realtime doc, but verify on the wire before depending on it.
8. **Notification `type` strings differ by surface**: broadcast handler documented as `channel_mention`/`channel_invite`/… (FC §6) while the REST inbox returns `ChannelMentionNotification`/… with null `title/message/icon` — render from `type` + `action_url`. Don't assume the strings match.
9. **Emoji validation is grapheme-strict**: lone VS16, lone skin-tone, single regional indicator → 422; flags must be exactly two regional indicators; skin-tone/VS16 variants are DISTINCT buckets. The FE owns the picker and sends the exact string. (3f)
10. **Zip files**: download-only (no extracted text — never show "Lawexa can reference this"), and archives are NOT malware-scanned — show the "open only what you trust" note. Upload validation is content-based, never filename-based. (LF §4, RP §3)
11. **No post-auth socket revocation**: a removed member keeps receiving events until disconnect — on `member.left` for yourself or any 403, `Echo.leave` + drop state. Events are fire-and-forget: after reconnect, re-fetch history by cursor (and `GET /quiz-games/{game}` mid-game). (FC §10, QZ)
12. **Editing `@lawexa` into a message never summons** (post-only, D8) — no `ai` field on the edit response. `data.ai` blocked-state is private to the summoner; other members see nothing. (FC §11, AC §12a)
13. **Muted members still receive `.channel.unread`** — badge updates always; toasts/sounds gated client-side by `my_notify_level`. `notify_level` is changeable ONLY via `PATCH /channels/{uuid}/members/me` and visible only on your own member row. (FC §18.3, AC §5)
14. **Read-receipt pointer can rest on a soft-deleted message** — you'll receive a uuid you can't locate in the feed; treat as "read up to an unknown recent point". Soft-deleted messages are also VALID markRead targets. (3c)
15. **Channel invitees** must already be active space members (422 otherwise). (AC §5–6)
16. **Push token DELETE needs a JSON body** (form-encoded 422s on DELETE); registering someone else's token reassigns it (shared-device rule); ignore FCM foreground messages entirely (Reverb covers open app); iOS needs installed PWA. (FC §9, AC §11)
17. **Quiz `settings` are snapshotted into the game at go-live**; `quiz_host_policy` unknown values behave as `all_members`; quiz-card `is_ai` was `false` for the feature's first day only (fixed 2026-08-03 before any quiz UI existed). (QZ, RP §1e/§5)
18. **Reactions/pins/reads broadcast only on actual state change** — no-op toggles/marks are silent; a concurrent double-pin may rarely double-broadcast (benign, idempotent payload). (3c, 3e, 3f)
19. **Mentions match a unique `@username` and NOTHING else** (2026-08-05 — supersedes the name-slug rule this item used to carry, which item 15 held until that date). Every account has one, generated from the name and unique by suffix: "Ada Obi" → `adaobi`, a second "Ada Obi" → `adaobi2`. `@Ada Obi` and `@ada.obi` now tag nobody. Rules: 3–30 chars, `[a-z0-9_]`, must start with a letter or number; reserved words (`lawexa`, `admin`, `support`, …) and taken handles 422 with the reason in `errors.username`; submitting your own current handle is a no-op. Consequences for the client:
    - **`username: string | null` is on every `SlimUser`** (message authors, member rows) and at the top level of `GET /api/profile`; `PUT /api/profile {"username": …}` changes it. **`null` means NOT TAGGABLE** — guests never get one, and neither does any account predating the one-time `users:backfill-usernames`. **Measured 2026-08-05: that backfill has NOT run, so null is the live case on every production account**, not an edge case. A picker must insert `username` and must not offer a member without one.
    - **`metadata.mentions[].username`** is the handle the server resolved — the key a renderer matches the typed `@token` on. **`null` on every mention recorded before 2026-08-05** (history is not backfilled), so the name-slug forms survive as the fallback for exactly those entries and for nothing else.
    - **`metadata.unmatched_handles: string[]`** lists handles the writer typed that resolved to nobody. **The message still posts** — ordinary text is full of `@` — so this is a hint to show the WRITER, never an error. `@lawexa` never appears here; it sets `lawexa_mentioned`. Absent on pre-deploy messages.
    - Notification previews still read the **display name** ("@Ada Obi"), not the raw handle. (reply-2026-08-05-usernames-and-tagging.md; verified against production 2026-08-05 — see `docs/v2-docs/backend-ask-2026-08-05-username-backfill.md`)
