# Phase 5 — Spaces/Channels: the v1 keep / redesign / drop study

Written 2026-08-04, before any phase-5 code, per the standing rule (README "Phase
workflow" item 3). Sources: first-hand read of the v1 code (all files listed per
screen), `foundation-standards.md` §5, `architecture-audit.md` Part 2 §8, and the
backend's 2026-08-03 reply (recorded in
[`backend-ask-2026-08-03-channels-spaces-update.md`](../../backend-ask-2026-08-03-channels-spaces-update.md)).
Backend contract details are condensed separately in [`api-digest.md`](api-digest.md) —
implementers read that; this doc holds the product verdicts.

Verdict vocabulary (house convention): **KEEP** (port behavior as-is, restyle only) ·
**KEEP the model, REDESIGN** (the idea survives, the screen is rebuilt) · **FIX**
(v1 defect, correct in the rebuild) · **DROP** (dies, not rebuilt) · **BUILD NEW**
(no v1 counterpart) · **FOLD IN** (absorbed into another surface) · **DEFER** (later
wave/phase).

## §0 — What v1 is, in one paragraph

63 files, ~11,750 lines, all in the old shell: spaces list → space detail → channel
view (Chat / Lists / Files tabs), three member sheets, a combined invitations inbox
served by four URLs, an organization page with CAC verification, and Lawexa-in-channels
(summon, responding row, glance panel, history sheet). The data layer
(`types/collab.ts`, `lib/api/collab.ts`) is current and stays; the hook logic
(`useCollab.ts`, 1,638 lines) gets **ported** onto v2 keys, never imported (boundary
rule). The realtime cache-writer pattern in `useChannelRealtime.ts` is explicitly the
model for the v2 spine (overhaul-plan §5). Nothing inside a channel has a URL.

## §1 — API facts that shape the design (verified 2026-08-03/04)

1. All phase-1 notification-spine asks are DELIVERED (counts in payloads,
   `.channel.unread` on the user channel, push confirmed sending). The spine can be
   built exactly as specced.
2. Since July 18 the backend added: replies (`reply_to`), read receipts
   (`last_read_message_uuid` + `.read.updated`), private message bookmarks, pins,
   emoji reactions, `.zip` files, and live quiz in channels — see the ask doc's
   Response section. All events ride the presence room we already hold.
3. `metadata.execution_id` + `metadata.session_uuid` now ride every AI reply — exact
   pill matching and "tap a Lawexa message → view that whole conversation." `null`
   before 2026-08-03 (keep the TTL fallback for old history).
4. Two new message `metadata.type` values (`quiz_game_live`, `quiz_game_finished`)
   already occur in prod feeds. v1 renders them as plain Lawexa bubbles (degraded,
   not broken).
5. The member surface is uuid-only since Jul 25 (key member rows on
   `member.user.uuid`; don't string-match 422 copy).
6. The role gate is FRONTEND-ONLY. The backend gates on membership + verified email,
   not on researcher/admin. Guests are blocked by our client code, not the server.

---

## Part A — screen by screen

### A0 — Access & audience

| v1 element | Verdict | Why |
|---|---|---|
| `SpacesGuard` (`router.replace('/')` for outsiders) | **DROP** | v2 rule: refusals are designed states, never redirects (quiz pattern). One synchronous gate in `app/v2/spaces` + `app/v2/channels` layouts off the server session snapshot. |
| Role list `SPACES_ROLES` (researcher/admin/superadmin) | **Owner decision D1** | Product call, not engineering. The gate mechanism is the same either way. |
| Guest exclusion (`useIsCollabEnabled`) | **KEEP the model, REDESIGN** | Guests get the create-account panel (registering IS the door), signed-out gets sign-in. Frontend-only today — a backend ask to block guest tokens server-side goes with this wave (same shape as the quiz ask). |
| Verified-email handling | **BUILD NEW** | v1 has none for collab. v2: same designed state the quiz ships (`VerifyEmailState` pattern, queries `enabled:false` while unverified). |

### A1 — Spaces list (`/spaces`)

Files: `app/(main)/spaces/page.tsx`, `SpaceCard.tsx`, `SpaceFormDialog.tsx`.

| v1 element | Verdict | Why |
|---|---|---|
| Grid of space cards | **KEEP the model, REDESIGN** | Becomes list rows in the house grammar (`ModuleRow` anatomy, LIST_COLUMN, meta line = two zones). Cards don't match any v2 list surface. |
| All / Work / Study filter (`AnimatedTabs`) | **KEEP the model, REDESIGN** | Rebuild on the shared `TabRow` primitive (APG contract). |
| "Invitations" button + pending badge | **FOLD IN** | Invitations become one v2 surface (A7); entry point stays here with the live count. |
| Space activity indicators | **BUILD NEW** | `unread_channels_count` dot + summed `mention_count` badge per row — the payload fields exist now; v1 never rendered them. |
| Create/Edit space dialog | **KEEP** | Behavior is right (org immutable on edit). Restyle on v2 primitives. |
| Skeletons (`SpacesListSkeleton`) | **KEEP the model, REDESIGN** | Three-state contract at real geometry (skeleton ≠ empty ≠ error), per standards §8. |

### A2 — Space detail (`/spaces/[spaceId]`)

Files: `SpaceDetailView.tsx`, `ChannelRow.tsx`, `SpaceMembersSheet.tsx`,
`ChannelFormDialog.tsx`.

| v1 element | Verdict | Why |
|---|---|---|
| Identity header (type, org, member count, lock) | **KEEP the model, REDESIGN** | Same information, v2 header grammar (kicker → name → meta → actions → hairline, the cases pattern). |
| Channel list rows | **KEEP the model, REDESIGN** | Rows gain the live unread model: **bold = unread, number = mentions**, driven by `.channel.unread` (v1 renders a static `unread_count` that only updates on refetch — audit §8 item 2). |
| Members sheet (roster, roles, transfer, leave, invite) | **KEEP** | Dense, correct, complete. Port onto v2 primitives; shared roster row (`MemberListItem`) stays one component. |
| Edit/Delete space menu + confirm | **KEEP** | Standard. |
| Create channel dialog | **KEEP** | Standard. |

### A3 — Channel view shell (`/channels/[channelId]`)

Files: `ChannelView.tsx` (389), `ChannelBody.tsx`, `ChannelMembersSheet.tsx`,
`InviteMemberDialog.tsx`, `EnableChannelPushNudge.tsx`.

| v1 element | Verdict | Why |
|---|---|---|
| Header (name, visibility, space link, member count, online dot) | **KEEP the model, REDESIGN** | Publishes into the v2 header via `header-context` instead of the v1 breadcrumb store. |
| Chat / Lists / Files tabs | **KEEP the model, REDESIGN** + **FIX** | Rebuild on `TabRow`. FIX: the active tab becomes URL state (`?tab=`), so Lists/Files are addressable; today tab + list selection are unaddressable and reset on return. |
| Chat `forceMount` (stream survives tab switches) | **KEEP** | Correct and deliberate; carry the mechanism. |
| Join flow for `space_public` channels | **KEEP** | |
| 403 / error / skeleton states | **KEEP the model, REDESIGN** | Three-state contract; 403 for non-members is a designed state. |
| Per-user notify level control (`all`/`mentions_only`/`muted`) | **KEEP** + **FIX** | The control exists; the value is INERT client-side (audit §8 item 5). The spine makes it real: gates toast/sound/badge (backend's own client rule). |
| Push nudge bar | **KEEP the model, REDESIGN** | Pushes are confirmed sending — the nudge earns its place. Same one-gesture permission+register flow. |
| `/channels` (no index page — bare URL 404s) | **FIX → BUILD NEW or leave** | Owner decision D6: `GET /api/channels` (cross-space, newest activity) exists and already feeds the home "Jump back in" — a real "My channels" index is one query away. |
| Delete channel / edit dialogs | **KEEP** | |

### A4 — Chat panel

Files: `ChannelConversation.tsx` (594), `MessageGroup.tsx`, `MessageRow.tsx`,
`MessageContent.tsx`, `MessageComposer.tsx`, `MemberAvatar.tsx`.

| v1 element | Verdict | Why |
|---|---|---|
| Day separators + 5-min author grouping | **KEEP** | Right model, standard chat grammar. |
| Message feed rendering | **KEEP the model, REDESIGN** | Rebuild on the v2 transcript approach (per-row memo, content-visibility virtualization — the conversation screen's proven pattern, NOT react-virtual). |
| Optimistic send | **KEEP** + **FIX** | v1 sends optimistically but has no failed state. Spec: `sending` → `sent` → `failed` (red + Retry inline, never dropped). |
| Edit/delete (hover) | **KEEP** + **FIX** | Add the touch path: long-press sheet (standards §5). |
| `@mention` autocomplete + chips | **KEEP** | Works well, incl. the synthetic `lawexa` candidate. Port. |
| Self-mention highlight | **BUILD NEW** | Mentions of *you* aren't styled differently today (audit §8 item 6). |
| Unread divider line + land-at-line | **BUILD NEW** | Standards §5; core of the unread model. |
| `?m=` message deep-links (scroll-to + highlight) | **BUILD NEW** | Dead today; mention notifications/pushes land nowhere. |
| Jump-to-latest pill with count | **BUILD NEW** | Shared `NewRowsPill` DNA; count of messages since detach. |
| Typing whispers (3s TTL) + presence count | **KEEP** | Mechanism is right; restyle. |
| Reconnect gap recovery (invalidate on reconnect) | **KEEP** | The documented v1 pattern; becomes a spine responsibility. |
| Replies (`reply_to`) | **BUILD NEW** | Backend shipped Jul 25. Composer reply state + quoted block on the row + tap-to-jump to the original. |
| Emoji reactions | **BUILD NEW** | `reaction.toggled` deltas; picker + count chips with `reacted_by_me`. Throttled 60/min server-side. |
| Pins | **BUILD NEW** | Pin/unpin (any active member may unpin), pinned list surface in the channel header area. |
| Private message saves (bookmarks) | **BUILD NEW** | Never broadcast (per-viewer). A "Saved" list per channel. Deliberately excluded from the global /bookmarks page — owner decision D4 scopes all four. |
| Read receipts UI (others' read state) | **Owner decision D2** | Standards said "No read receipts in v2" (July 17); backend shipped the pointer + `.read.updated` (Jul 25). The pointer ALWAYS powers our own multi-device badge-clear (spine); the question is only whether we SHOW others' read state. |
| Quiz system cards (`quiz_game_live` / `quiz_game_finished`) | **BUILD NEW (v2)** | Designed cards with Join / results actions off `metadata.game_uuid`/`quiz_uuid`. In v1 they stay plain bubbles (accepted). Unknown future types must fall back to text — that fallback is a contract, keep it. |

### A5 — Lists tab

Files: `lists/` (7 files, 1,102 lines) — `ListsPanel`, `ListCard`, `ListDetailView`
(407), `ListItemRow`, `ListFormDialog`, `ListProgress`, `ListCreatorLabel`.

| v1 element | Verdict | Why |
|---|---|---|
| Index grid → detail (local-state master/detail) | **KEEP the model, REDESIGN** + **FIX** | FIX: selection becomes URL state (`?list={uuid}`) so lists are shareable and survive tab switches. |
| dnd-kit drag reorder (grip-handle-only) | **KEEP** | Correct, accessible enough, proven. |
| Inline item edit, checked-by identity, progress bar | **KEEP** | |
| Creator label (Lawexa vs member) | **KEEP** | |
| Realtime `.list.changed` full-snapshot writers | **KEEP** | The two-shape reconciliation (`TaskListSummary` vs `TaskList`) is fiddly but correct — port the writers with their tests, don't reinvent. |

### A6 — Files tab

Files: `files/FilesPanel.tsx`, `files/FileRow.tsx` (569 lines).

| v1 element | Verdict | Why |
|---|---|---|
| Upload + client validation | **KEEP** + **FIX** | Mirror the new allow-list (now incl. `zip`); server decides (content-based). |
| Pending-row optimism, type icons, meta line | **KEEP** | Meta line adopts the two-zone grammar. |
| Download / delete with confirm | **KEEP** | |
| Zip handling | **BUILD NEW** | Download-only (no "Lawexa can read this"), plus the short "archives aren't scanned — open only what you trust" note. Both are stated backend obligations. |

### A7 — Invitations (4 URLs → 1 surface)

Files: `InvitationsView.tsx`, `InvitationCard.tsx`, 4 route files.

| v1 element | Verdict | Why |
|---|---|---|
| Combined inbox (3 sections, accept/decline) | **KEEP the model, REDESIGN** | One surface is right. Rebuild in the shell. |
| Four separate routes rendering the same component | **DROP → redirect** | One `/invitations` in the manifest; the three legacy URLs redirect (old notification `action_url`s keep working). Owner decision D5 confirms. |
| Pending-count badge | **KEEP** | Live via the spine (invites arrive on the user channel). |

### A8 — Organization + CAC (`/settings/organization`)

Files: `OrganizationHome.tsx`, `OrganizationFormDialog.tsx`,
`RequestVerificationDialog.tsx`, `OrganizationMembersSheet.tsx`.

| v1 element | Verdict | Why |
|---|---|---|
| Empty → create → identity header → verification section | **KEEP the model, REDESIGN** | The three verification states (verified / under review / get verified) are well designed — keep them as-is conceptually. |
| CAC request dialog (BN number + document) | **KEEP** | |
| Members sheet | **KEEP** | Same shared roster row. |
| Route location under `/settings/` | **Owner decision D7** | v2 has no settings surface; the natural v2 home is `/organization` (or inside spaces). Pure placement call. |

### A9 — Lawexa-in-channels

Files: `LawexaRespondingRow.tsx`, `LawexaGlancePanel.tsx`,
`LawexaMessageContent.tsx`, `ChannelAiSessionsSheet.tsx` (444), reset dialog.

| v1 element | Verdict | Why |
|---|---|---|
| Summon via `@lawexa`, replies as markdown with mention chips | **KEEP** | |
| Responding row anchored under the summon | **KEEP** + **FIX** | FIX: exact matching by `metadata.execution_id` (shipped 2026-08-03) — the oldest-active-turn guess dies. TTL stays only for pre-Aug-3 history. |
| Glance panel (live turn watch, reuses chat engine) | **KEEP the model, REDESIGN** | Re-point onto the v2 chat engine (`v2/runtime/chat-engine`), not v1's `useChatStream` (boundary-blocked anyway). |
| History sheet (sessions → transcript) | **KEEP the model, REDESIGN** + **BUILD NEW** | Transcript endpoint now returns the COMPLETE conversation incl. tool rows, same shapes as personal chat — render with the v2 conversation components. NEW: "tap a Lawexa message → open its session" via `metadata.session_uuid`. |
| Reset ("Start fresh") + `ai_divider` separators | **KEEP** | |

### A10 — The notification spine (cross-cutting, not a screen)

The audit's §8 list is the build spec's negative image. Verdicts on the five v1
mechanisms:

| v1 mechanism | Verdict | Why |
|---|---|---|
| `useChannelRealtime` cache writers | **KEEP the model, REDESIGN** | Explicitly "the model for the spine" (overhaul-plan §5). Rebuilt in `v2/runtime/realtime/`, owned by v2. |
| `RealtimeNotifications` (user channel → invalidate only) | **KEEP the model, REDESIGN** + **FIX** | Becomes the ONE dispatcher: toast/sound/badge/title per event, visibility-aware. FIX: decoupled from the spaces role gate — every v2 user gets live notifications. |
| Static `unread_count` on rows | **FIX** | Live via `.channel.unread` (absolute, self-healing counts — apply, never increment). |
| Sound util + browser Notification API (never fire for collab) | **FOLD IN** | Into the dispatcher, behind independent toggles + "pause notifications". |
| FCM push client (registration, SW, deep links) | **KEEP** | Verified functional; backend send-side now confirmed. v2 adds dedup (push suppressed while the app is visible on that conversation) and deep-links onto `?m=`. |

### A11 — Live quiz in channels (all-new surface)

No v1 counterpart. Kahoot-style: authoring, lobby, countdown, timed questions,
reveal, podium — 8 events on the existing presence room; reconnect via
`GET /api/quiz-games/{game}` (authoritative state). System cards in the feed are the
entry points. Client must hold the last reveal ~3–5s before the podium (backend-
documented gap). `settings.quiz_host_policy` (`all_members` | `admins_only`) is a
channel setting we surface in channel edit. **Owner decision D3 scopes when this
ships.** Recommendation: its own wave AFTER the core rebuild — it depends on the
rebuilt feed (cards), realtime spine (events), and none of the core depends on it.

---

## Part B — proposed wave breakdown

Every wave: research-first implementer + adversarial checker, `V2_ENABLED=true next
build` before push, v1 pixel-identical with the toggle off.

- **W1 — Spine + unread model** (the foundation): `v2/runtime/realtime/` (echo
  lifecycle, user-channel listener, dispatcher, `notify_level` gating, title/favicon/
  `setAppBadge` rollups, sound/toast toggles), `.channel.unread` cache writers,
  spaces/channels queries+keys, mark-read triggers. Exit: message in an unopened
  channel badges within a second; muted stays silent except @you.
- **W2 — Channel screen, chat core**: route + shell + header + tabs (URL state),
  feed (groups, virtualization, unread divider, jump pill, `?m=` deep-links,
  self-mention highlight), composer (mentions, optimistic send with failed+retry,
  reply state), edit/delete incl. touch, typing/presence, quiz cards as designed
  system cards (render-only), zip-aware file rules seam.
- **W3 — Engagement + Lawexa**: reactions, pins (+ pinned surface), saved messages,
  replies UI polish; responding row on `execution_id`, glance on the v2 engine,
  sessions sheet on the complete transcript, session peek via `session_uuid`; reset.
- **W4 — Spaces, orgs, invitations**: spaces list + space detail with live badges,
  member sheets ×3, create/edit dialogs, one `/invitations` (+ 3 redirects),
  organization + CAC (at the D7 location), `/channels` index if D6 says yes.
- **W5 — Push + cutover plumbing**: push deep-links onto `?m=`, foreground dedup,
  nudge; routes.manifest entries, nav gate removal per D1, sitemap untouched
  (private surfaces, noindex), v1 collab file deletion list for phase 7.
- **W6 (pending D3) — Live quiz**: authoring, lobby/game/podium screens, reconnect.

Wave order note: W1 before W2 is firm (the feed renders the model W1 computes).
W3/W4 can swap or parallelize; W5 closes the phase.

## Part C — Decisions for the owner

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | v2 Spaces audience at ship | (a) keep researcher/admin soft launch, widen later · (b) every registered account at phase-5 ship | **(b)** — the rebuild is the moment; the backend gate is membership anyway, and the create-account panel handles guests. The nav row gate added Aug 3 then simply comes off. |
| D2 | Show others' read state? | (a) no receipts UI (standards' call stands; pointer still powers own multi-device sync) · (b) subtle "seen by" on last message | **(a)** for phase 5 — reversible later; avoids the social-pressure debate mid-rebuild. |
| D3 | Live quiz timing | (a) own wave after core (W6) · (b) inside phase 5 core | **(a)** — depends on the rebuilt feed + spine; core shouldn't wait on it. |
| D4 | Message-engagement scope in the first channel ship | (a) all five (replies, reactions, pins, saves, receipts-per-D2) · (b) replies + reactions first, pins + saves in W3.5 | **(a)** — on the new feed each is small; shipping the channel twice costs more than the extras. |
| D5 | Collapse the four invitation URLs to one `/invitations` with redirects | yes / no | **Yes** — old notification links keep working via redirects. |
| D6 | Build a `/channels` "My channels" index | yes / no | **Yes** — the API exists, the bare URL 404s today, and it's the natural mobile entry. |
| D7 | Organization home location in v2 | (a) `/organization` top-level · (b) stay under settings (v1 parity) | **(a)** — v2 has no settings surface; an org is a thing you visit, not a preference. |
| D8 | Notification sound default | (a) off by default (toasts/badges on) · (b) on by default | **(a)** — legal-work context; one click to enable, per-user. |

Backend asks to send with W1 (drafted after decisions): block guest tokens on collab
endpoints server-side (same shape as the quiz ask); nothing else — every phase-1 ask
is delivered.
