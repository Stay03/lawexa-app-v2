# Phase 5 — Collab + Notification Spine: plan

**Objective:** Spaces/Channels rebuilt on a real communication-grade notification model.

**Status of prerequisites (2026-08-04):** ALL delivered. The phase-1 asks (counts in
payloads, `.channel.unread`, push send-side) answered July 18; the 2026-08-03 status
reply confirms pushes deliver in prod, adds the July 18→Aug 3 surface (engagement
3b–3f, zip files, live quiz, uuid-only pass), and ships `metadata.execution_id` +
`session_uuid` on AI replies. No deprecations — the backend states this surface is
what v2 should be built on.

**Read in this order before implementing:**
1. [`v1-keep-drop-study.md`](v1-keep-drop-study.md) — the per-screen verdicts and
   owner decisions D1–D8 (this plan's waves assume the recommendations; adjust when
   the owner answers).
2. [`api-digest.md`](api-digest.md) — the condensed backend contract (message object,
   events, endpoints, unread semantics, quiz).
3. `foundation-standards.md` §5 — the unread & notification model, adopt verbatim
   (one standing correction: the read-receipt pointer exists backend-side now; §5's
   "no read receipts" governs UI only, per decision D2).
4. `architecture-audit.md` Part 2 §8 — the gap list the spine exists to close.

**Standing rules:** research-first implementer + adversarial checker per wave; no v1
imports from `components/**`, `lib/hooks/**`, `lib/realtime/**` (port, don't import);
`V2_ENABLED=true next build` before every push; v1 stays byte-identical with the
toggle off; refusals are designed states; skeleton-first, three-state regions,
symmetric motion; list rows follow the two-zone meta grammar.

---

## Waves

### W1 — Spine + unread model (foundation; everything else renders what this computes)

1. `v2/runtime/realtime/` — echo/Reverb lifecycle owned by v2 (singleton, auth via
   the session bridge, disconnect on sign-out, reconnect with gap-recovery
   invalidation). v1's `lib/realtime/echo.ts` stays untouched for v1.
2. User-channel listener (`users.{uuid}`): `.notification` → notification cache
   invalidation (decoupled from any role gate — every v2 user), `.channel.unread` →
   apply absolute counts to channel/space caches (never increment; the event is
   self-healing).
3. The ONE dispatcher: per event decide toast / sound / badge / title, visibility-
   aware (never notify the visible conversation), `my_notify_level` enforced
   client-side, AI-mention rule (`ai_mentions_notify`) honored, sound ≤300ms
   coalesced per channel per ~10s, independent sound/toast toggles + "pause".
4. Rollups: channel → space (activity dot + summed mentions) → app
   (`document.title (n)`, favicon overlay, `setAppBadge`).
5. Query layer: `v2/features/spaces` + `v2/features/channels` grow real key
   factories (list/detail/members/messages-infinite) with viewer-scoped keys; port
   the v1 cache-writer logic (message created/updated/deleted, member join/leave,
   list/file changed) onto v2 keys — the study marks it KEEP-the-model.
6. Mark-read triggers per §5: open AND visible AND newest in viewport ≥1s; or send;
   or jump-pill click. Opening unfocused does NOT mark read. `.read.updated` clears
   badges across the user's own devices.
7. Access gates: `SpacesAccessGate` in `app/v2/spaces` + `app/v2/channels` layouts
   (signed-out / guest-create-account / verify-email designed states, audience per
   D1). Backend ask drafted: server-side guest block on collab endpoints.

**Exit:** a message posted to an unopened channel updates its row bold/badge, the
space rollup, and the app title within one second, with zero refetch loops; muted
channels stay silent except a personal @you; toasts never fire for the visible
channel.

**W1 RECORD (2026-08-04) — BUILT, AUDITED, FIXED.** Fable implementer (22 files:
`v2/runtime/realtime/{spine,echo,protocol,dispatcher,preferences,active-channel,sound,app-badge}`,
channels/spaces key factories + reference-stable cache writers, `mark-read.ts`,
`v2/features/collab/` gate + panels, `lib/utils/collab-audience.ts`, the two
`app/v2/{spaces,channels}/layout.tsx` gates, spine mount in `app/v2/layout.tsx`).
Adversarial audit verdict: SHIP AFTER FIXES — zero blockers; four MEDIUM findings,
all fixed same day: (M1) the dispatcher's preference read now re-reads storage when
no React subscriber holds the cross-tab listener; (M2) the mute oracle fires for
found-but-unstamped rows (`notifyLevel === null`, not `!found`); (M3) the
cold-cache rollup throttle is per-space, so a muted-channel @you can't be starved
by another space's event; (M4) the title observer re-attaches when the `<title>`
ELEMENT is replaced (head-level childList watcher). Gates green after fixes:
tsc, eslint, `V2_ENABLED=true next build` (routes confirmed dark).
**Carry-forwards into W2/W4 briefs (audit notes):**
- N1: the W2+ notify-level mutation MUST assign `my_notify_level` into cached
  channel rows AND invalidate space rollups (stale level breaks Ruling A deltas).
- N2: room hooks must re-acquire the Echo instance on the viewer edge —
  `disconnectV2Echo()` nulls the singleton.
- N3: lists/files cache writers deliberately deferred to W2 (no v2 keys to write
  onto yet) — W2 owns them.
- N4: `channelsQueries.mine` viewer-partitioning is a follow-up owned by the next
  wave that touches the home section.
- N5: the toast's `?m=` link is inert on v1's channel screen — W2 makes it land.
- N6: `MarkReadResponse.last_read_message_id` in `types/collab.ts` is stale
  (server ships `last_read_message_uuid`) — fix in a wave touching that file.
- Film-pass items (couldn't be verified statically): title/favicon behavior under
  real App Router navigations, the live `.channel.unread` wire incl. Ruling B,
  and the 1-second row→space→title path end to end.

### W2 — Channel screen, chat core

1. Routes: `/channels/[channelId]` (+ `?tab=`, `?m=`, `?list=`) as thin server
   shells; route-group `loading.tsx` shaped like the channel; manifest entries land
   in W5 (dark until then — reachable by direct `/v2/...` only in dev).
2. Shell: header via `header-context` (name, visibility, space link, members,
   online), Chat/Lists/Files on `TabRow` with tab-in-URL; Chat keeps its mount
   across tab switches (v1's forceMount contract).
3. Feed: day separators + 5-min grouping (port), per-row memo +
   content-visibility virtualization (the conversation screen's proven pattern),
   unread divider + land-at-line, jump-to-latest pill with count, `?m=` scroll-to +
   highlight, self-mention highlight, reconnect gap recovery wired to the spine.
4. Composer: mention autocomplete incl. `lawexa` (port), optimistic send with
   `sending`/`sent`/`failed`+Retry, reply state (quoted block above input), typing
   whisper (1/s throttle, 10s expiry, clear on send), keyboard-inset behavior from
   the shell's measured-occlusion pattern.
5. Message rows: edit/delete with hover affordances AND long-press sheet on touch;
   deleted-user rendering; `is_ai` discriminator; quiz system cards as designed
   cards (Join / results actions from `metadata.game_uuid`/`quiz_uuid`; unknown
   `metadata.type` falls back to text — contractual).
6. Lists tab: port panels with `?list=` selection; keep dnd-kit reorder and the
   snapshot cache-writers. Files tab: port with the new allow-list, zip =
   download-only + "archives aren't scanned" note.

**Exit:** a member lives in the channel end-to-end (read, send, edit, reply, fail+
retry, deep-link, tab-switch mid-stream) on desktop and mobile film.

### W3 — Engagement + Lawexa

1. Reactions: `reaction.toggled` deltas onto the feed cache, picker + count chips
   (`reacted_by_me`), 60/min throttle surfaced as quiet disable not errors.
2. Pins: pin/unpin per policy (any active member may unpin), pinned-messages
   surface off the channel header, `.message.pinned/.unpinned` writers.
3. Saved messages: toggle + per-channel saved list (REST-only; never broadcast).
4. Read-state UI per D2 (default: none).
5. Lawexa: responding row keyed by `metadata.execution_id` (TTL only for pre-Aug-3
   history), glance panel on `v2/runtime/chat-engine`, sessions sheet rendering the
   complete transcript with the v2 conversation components, message → session peek
   via `metadata.session_uuid`, reset + `ai_divider`.

**Exit:** two concurrent Lawexa summons resolve their own pills; a reaction from a
second account appears live; pins and saves survive reload.

### W4 — Spaces, orgs, invitations

1. `/spaces`: rows in house grammar, All/Work/Study on TabRow, live activity dot +
   mention badge, create/edit dialog, invitations entry with live count.
2. `/spaces/[spaceId]`: v2 header grammar, channel rows on the live unread model,
   members sheet, transfer/leave, create channel.
3. `/invitations`: one surface, three sections; legacy `/channel-invitations`,
   `/space-invitations`, `/organization-invitations` redirect (notification
   `action_url`s keep working).
4. Organization + CAC at the D7 location: three verification states preserved,
   request dialog, members sheet, create/edit (type locked once verified).
5. `/channels` index per D6 ("My channels", `GET /api/channels` — the query the
   home section already shares).

**Exit:** the full membership lifecycle (invite → accept → role change → transfer →
leave) filmed across two accounts; org verification states render from fixtures.

### W5 — Push + plumbing (phase close)

1. Push: deep-links land on `?m=` highlighted; foreground dedup (no push-toast while
   the app is visible on that channel); token register/delete on login/logout; the
   in-channel enable nudge.
2. `routes.manifest.ts`: `/spaces`, `/spaces/*`, `/channels`, `/channels/*`,
   `/invitations` (+ redirect routes), org route per D7. Nav: Spaces row gate per
   D1; drawer + sidebar stay config-driven.
3. v1 deletion list for phase 7 written into `post-implementation.md` (the 63-file
   inventory in the study is the checklist).
4. Device verification script (the phase-3 W6 pattern) run by owner/testers; then
   `post-implementation.md`.

**Exit (phase gate, unchanged):** a message in an unopened channel produces the
correct badge/toast/sound within a second; mention deep-links land highlighted;
muted channels stay silent except @you; testers run their team comms in v2.

### W6 — Live quiz in channels (pending D3; default: after W5)

Authoring flow (host policy honored), lobby → countdown → question → reveal (hold
3–5s) → podium on the 8 events, reconnect from `GET /api/quiz-games/{game}` as the
authoritative state, system cards wired to Join/results. Contract:
`docs/api/channel-quiz.md` (backend repo). Known backend gap: no duplicate-quiz
endpoint yet (question edits 409 after plays).
