# phase-5-collab-notifications — post-implementation

> Written at phase close. The next phase does not start until this is filled in.

**Status: DRAFT at the end of W5 (2026-08-04).** The build is complete and the
static gates are green. Two sections are deliberately left for the phase
coordinator to fill after the LIVE run: **Verification → live pass** and
**Verification → film**. Nothing else is pending.

**Objective (from `plan.md`):** Spaces/Channels rebuilt on a real
communication-grade notification model. **Exit (unchanged):** a message in an
unopened channel produces the correct badge/toast/sound within a second; mention
deep-links land highlighted; muted channels stay silent except @you; testers run
their team comms in v2.

---

## What was built

| Wave | Commit | What landed |
|---|---|---|
| W1 — spine + unread model | `f2d0637` | `v2/runtime/realtime/**` (`spine`, `echo`, `protocol`, `dispatcher`, `preferences`, `active-channel`, `sound`, `app-badge`), the channels + spaces key factories and reference-stable cache writers, `v2/features/channels/mark-read.ts`, `v2/features/collab/**` (gate + designed panels), `lib/utils/collab-audience.ts`, the `app/v2/{spaces,channels}/layout.tsx` gates, and the spine mount in `app/v2/layout.tsx`. Audited (SHIP AFTER FIXES); four MEDIUM findings fixed the same day. |
| W2 — channel screen | `1fad799` | `app/v2/channels/[channelId]/**` + `v2/features/channels/{screen,feed,composer,members,lists,files,dialogs,ui}/**`, `room.ts`, `send-outbox.ts`, `feed-model.ts`, `lists-files-cache.ts`. Tab/list/message state in the URL, forceMount chat, unread divider, jump pill, `?m=` deep-link, optimistic send with failed+retry, long-press sheet. |
| W3 — engagement + Lawexa | `52200ac` | Reactions, pins, saves (`engagement-mutations.ts`, `engagement-throttle.ts`, `panels/MessageCollectionSheet.tsx`), and Lawexa on the v2 engine (`feed/RespondingRow.tsx`, `feed/LawexaGlancePanel.tsx`, `lawexa/**` incl. the sessions sheet and `turns.ts` keyed on `metadata.execution_id`). |
| W4 — spaces, orgs, invitations | `9483896` | `v2/features/spaces/{list,detail,dialogs}/**`, `v2/features/organizations/**` (incl. CAC verification), `v2/features/invitations/**`, the `/channels` index (D6), and the shared membership kit; routes `app/v2/{spaces,invitations,organization}/**`. |
| W5 — push + plumbing | _(this wave)_ | Below. |

### W5 in detail

**A. The manifest flip and the nav gate.**
- `v2/routes.manifest.ts` — `/spaces/*`, `/channels/*`, `/invitations`,
  `/organization`, plus the four legacy addresses. A `'/prefix/*'` entry already
  matches the prefix itself, so `/spaces` and `/channels` need no second entry
  (the `/cases/*` convention).
- `v2/shell/nav.config.ts` — the Spaces row's v1 soft-launch predicate
  (`canAccessSpaces`) is replaced by the v2 audience (`canAccessCollab`): every
  registered account, guests and bots excluded, exactly like the Quiz row.
  Decision D1.
- `v2/shell/designs/WorkHome.tsx`, `StudyHome.tsx` — the same gate was also
  wrapping the home's "Jump back in" section; both flipped, or the flip would
  have invited people into Spaces and then hidden their channels on the home.
- Legacy redirects (D5 + D7): `app/v2/channel-invitations/page.tsx`,
  `app/v2/space-invitations/page.tsx`,
  `app/v2/organization-invitations/page.tsx`,
  `app/v2/settings/organization/page.tsx`.

**B. The push path.**
- `v2/runtime/push/fcm.ts` — v2-owned FCM client (port of
  `lib/firebase/messaging.ts`, which is boundary-blocked). Dynamic `import()`
  so the SDK stays out of the shell bundle. **No `onMessage` handler, ever** —
  digest §F.16.
- `v2/runtime/push/capability.ts` — `supported` / `requiresInstall` /
  `iosBrowser`, computed once and cached.
- `v2/runtime/push/state.ts` — the per-device record (token, enabled,
  nudge-dismissed) on the `preferences.ts` external-store pattern, plus
  `isPushArmed()`, the dispatcher's dedup input. `enabled` is THREE-valued
  (`null` = undecided here) on purpose: a device that granted permission on a
  v1 page has no v2 record, and reading that silence as "no" would leave
  precisely those users un-armed — and so notified twice, once by the OS and
  once by the in-app alert. An explicit `false` is still honoured.
- `v2/runtime/push/register.ts` — register / deactivate / boot re-sync / the
  one-gesture enable. `DELETE` goes through `pushApi.deactivate`, which sends
  the JSON body the endpoint requires (§F.16).
- `v2/runtime/push/lifecycle.tsx` — `V2PushLifecycle`, mounted beside the spine
  in `app/v2/layout.tsx`. Keys on the server-verified `userId`: arrival →
  idempotent re-sync, departure → teardown. The edge is detected in an effect,
  not in cleanup, so leaving v2 for a v1 page never tears a healthy
  registration down.
- `v2/runtime/push/use-push.ts` + `v2/features/channels/screen/EnablePushNudge.tsx`
  — the in-channel bar in three modes (ask / iOS-install / blocked), symmetric
  `grid-rows-[0fr↔1fr]` motion, `motion-reduce`, `inert` while hidden, and a
  labelled dismiss.
- `v2/runtime/realtime/dispatcher.ts` — the push-dedup seam closed: hidden
  document + armed registration silences **the chime only**, never the toast,
  and a toast raised while hidden is persistent (`duration: Infinity` +
  `closeButton`) so it is still there when the reader returns. FCM's own rule
  covers the other direction (no OS notification while any tab is visible).

**C. Promotions and tidy-ups.**
- `v2/features/spaces/membership/**` → `v2/features/collab/membership/**` (git
  moves); consumers updated in `organizations/OrganizationMembersSheet.tsx`,
  `spaces/detail/SpaceMembersSheet.tsx`, `invitations/InvitationRow.tsx`.
- `v2/features/spaces/my-channels/**` → `v2/features/channels/my-channels/**`
  (git moves); `app/v2/channels/(index)/{page,loading}.tsx` updated.
- The duplicated `MemberAvatar` is gone: `v2/features/channels/ui/avatars.tsx`
  now RE-EXPORTS the collab one, so its eight consumers kept their import path.
- `v2/runtime/realtime/spine.tsx` — `.notification` and the reconnect
  gap-recovery now also invalidate `invitationsQueries.all`, so an invite moves
  the pending badge live (W4's reported one-liner).
- N4 closed: `channelsQueries.mine` is viewer-partitioned; spine, `/channels`
  index and `HomeSections` pass `viewerId`. The spine and the index still share
  one cache entry.

**D. The delivery switches (added — see Deviations).**
- `v2/shell/NotificationDeliveryControls.tsx`: Mention alerts / Sound / Push
  notifications / Pause alerts, with visible hints, pause dimming its two
  dependants, and platform-honest disabled states.
- `v2/shell/V2NotificationBell.tsx` — the panel is now two views behind a gear
  (list ⇄ settings) rather than a stack, and the container owns a height cap so
  the footer link stays reachable on a short viewport.

**E. Docs.** `w5-device-verification.md` (52-step owner/tester checklist) and
this file.

### W5 audit round (same day)

Verdict SHIP AFTER FIXES; all applied.

| # | Fix | Where |
|---|---|---|
| H1+M1 | Rule 5 suppresses the SOUND only — a lying `isPushArmed()` mirror (rotated token, unregistered SW, evicted storage) would otherwise destroy the mention on both surfaces. Hidden-document toasts made persistent, so "waits on screen" is true. | `v2/runtime/realtime/dispatcher.ts:29-96,131-160` |
| H2 | Shipped the off switch: `disablePushOnThisDevice()`, the bell's Push row, and a boot re-sync that clears the mirror when no token resolves. | `v2/runtime/push/register.ts:44-72,132-146`, `v2/shell/NotificationDeliveryControls.tsx:129-136` |
| M2 | The `permission === 'granted'` guard moved INTO `registerPushDevice` — the SDK's `getToken()` calls `requestPermission()` itself, so the safety had to live in the callee. | `v2/runtime/push/register.ts:44-62` |
| M3 | Home section dropped `per_page: 6`; it forked a second `mine` cache entry and request per home load. | `v2/shell/designs/sections/HomeSections.tsx:39-52` |
| M4 | The nudge's `blocked` mode. | `v2/features/channels/screen/EnablePushNudge.tsx:40-53` |
| M5 | Hints are visible secondary text; pause dims + `aria-disabled`s its dependants while leaving them operable. | `v2/shell/NotificationDeliveryControls.tsx:47-100` |
| M6 | Module-level promise queue, so an A → signed-out → B transition serializes across effect runs. | `v2/runtime/push/lifecycle.tsx:49-62,84-90` |
| M7 | Checklist steps 1↔2 swapped. | `w5-device-verification.md` |
| L1 | `./armed.ts` → `./state.ts`. | `v2/runtime/push/fcm.ts:16` |
| L2 | `channelUnreadGrammar` moved to the channels feature; the shared vocabulary now lives in `v2/features/collab/unread-grammar.ts`, so neither feature imports the other. | `v2/features/collab/unread-grammar.ts`, `channels/model.ts:36-58`, `spaces/model.ts` |
| L3 | Popover/Sheet cap their own height; the scrolling region flexes. | `v2/shell/V2NotificationBell.tsx:128-160` |
| L4 | Settings SWAP with the list behind a gear instead of stacking between list and footer. | `v2/shell/V2NotificationBell.tsx:180-235` |
| L8 | Two checklist sections added (blocked prompt; push off + persistence). | `w5-device-verification.md` §4, §7 |

---

## Deviations from plan

1. **The delivery switches were built in W5, not planned for it.** W1 shipped
   the preference store (sound / toast / pause) and no surface ever rendered
   it. With sound defaulting OFF (D8) the chime was unreachable code and the
   phase exit criterion could not be tested. A settings view now sits behind
   the bell's gear, and the audit added the push on/off switch to it (H2).
   Scope added deliberately; it closes a hole rather than opening one.
2. **The D1 flip touched three files, not one.** The plan named the nav row.
   The same v1 predicate was also gating the Work/Study home channels section,
   which would have contradicted the nav.
3. **`/spaces` and `/channels` are not separate manifest entries.** The
   wildcard form already matches its own prefix; adding both would have been
   redundant with the file's stated pattern semantics.
4. **The legacy redirects are server pages, not proxy rules** — the mechanism
   the brief prescribed, adopted as-is. They are TEMPORARY (307) redirects, not
   `permanentRedirect`: a 308 is cached by the browser against the origin and
   would keep firing after a user left the v2 preview, which would leak a v2
   decision into v1.
5. **The shared service worker was NOT modified.** The foreground-dedup
   requirement is already satisfied by FCM's own rule (a visible window client
   receives the payload in-page instead of an OS notification) combined with
   v2 registering no `onMessage` handler. Editing a worker shared with v1 to
   re-implement that would have added risk for no behaviour change.
6. **`MemberAvatar` de-duplication** was not in the tidy-up list, but the file's
   own docblock named it a W5 task and it cost one re-export line.

---

## Verification results

**Static gates (W5, run on the full tree):**
- `npx tsc --noEmit` — clean.
- `npx eslint v2 app/v2` — clean (zero warnings; boundaries, React Compiler
  rules and hooks rules all enforced as errors).
- `next build` — **NOT run by this wave, by instruction.** The coordinator runs
  `V2_ENABLED=true next build` before anything ships. A build without that flag
  is meaningless (the kill switch `notFound()`s the whole tree).

**What was verified statically (W5 push path):**
- The deep-link contract is closed end to end IN OUR HALF: the service worker
  navigates to `notification.data.url`; the dispatcher's toast navigates to
  `/channels/{uuid}?m={message}`; `app/v2/channels/[channelId]/page.tsx` reads
  `?m=` into `targetMessageUuid`; and `/channels/*` is now in the manifest, so
  that URL resolves to the v2 screen for an opted-in reader. The one half we
  cannot verify without the wire is what the BACKEND puts in `data.url` — see
  the live pass.
- Foreground dedup: v2 registers no FCM `onMessage` handler anywhere (grep-
  verified), so a foreground payload is discarded by construction.
- The interruption ladder is a pure function (`decideInterruption`); push
  affects only its `sound` term, so no rule above it — and in particular the
  mute rule — changes behaviour because of push.

**Live pass — RUN 2026-08-04 (coordinator, prod wire probe, raw pusher protocol
over ws with a browser Origin; script preserved in the session scratchpad as
`live-wire.js`).**

- `V2_ENABLED=true next build` — green (after regenerating a vanished
  `node_modules/.bin/next` shim via `npm install`).
- REST, all green against prod with the verified film account: space + channel
  create, message post, markRead (response carries `last_read_message_uuid` —
  the uuid-only pass is live), `@lawexa` summon dispatched
  (`status: "dispatched"` + execution_id + stream_url).
- `POST /api/broadcasting/auth` green for `private-users.{uuid}` AND
  `presence-channels.{uuid}`; both subscriptions succeeded. NOTE: Reverb
  enforces allowed origins on the socket (4009 without one) — headless probes
  must send `Origin: https://lawexa.com`.
- Client relay green: a `client-typing` whisper crossed sockets in ~250ms.
- **FINDING (blocking the live badge criteria, NOT the flip): backend event
  EMISSION is down in prod.** Zero server-emitted events arrived on either
  socket across ~2.5 min of activity — no `.message.created`, no
  `.channel.unread` (markRead echo), no `.read.updated`, no `.ai.turn_started`;
  the Lawexa reply never posted within 100s. v1 has the identical dependency
  and is silently degraded the same way today, so the flip is not a regression;
  the v2 spine self-heals the moment emission returns. Reported:
  `backend-ask-2026-08-04-broadcast-emission-down.md`.
- Consequently OPEN until emission returns: F7 (`ai.turn_started.message_uuid`),
  F6 on the wire (`metadata.execution_id` on AI replies), the push `data.url`,
  both dedup directions, and checklist step 52 (muted rows in `/channels`).
  The 1-second badge exit criterion is verified in code + fixtures but NOT yet
  on the live wire — re-run the probe when the backend replies.

**Film — FOR THE COORDINATOR TO FILL.**
> Desktop + mobile shots of: the channel with the push nudge, the blocked
> variant of that bar, the bell's list view and its settings view (four
> switches, and the paused state), a mention alert, `/channels`, `/spaces`,
> `/invitations`, `/organization`.

**On-device — FOR THE OWNER/TESTERS.** `w5-device-verification.md`, 52 steps,
iOS Safari (installed PWA) + Android Chrome.

---

## Known gaps / follow-ups

**G1 — the sign-out `DELETE` usually 401s (carried to phase 7 / cutover).**
v2 has no sign-out; v1's logout revokes the session before the identity edge is
observable in v2, so `DELETE /notification-channels/push` normally fails at
that moment. Mitigations, both real: the FCM token is deleted LOCALLY (the
browser stops receiving anything for the old registration), and the next person
to sign in re-registers the device, which reassigns the row server-side
(the backend's stated shared-device rule). The clean fix arrives when v2 owns
sign-out.

**G2 — one push per device, two records of it.** v1
(`lib/stores/notificationPrefsStore`) and v2 (`lawexa-v2-push`) each keep their
own note of the device token. They converge because the endpoint is an
idempotent upsert by token and both trees resolve the same FCM token, but a
device registered only in v2 is not in v1's record. Dies with v1.

**G3 — CLOSED by the audit round.** v2 now has a real off switch: the bell's
settings view calls `disablePushOnThisDevice()`, which records the explicit
choice and deactivates the device token, and the boot re-sync honours an
explicit `false` for good. The workaround previously written here — "use v1's
settings page" — was actively harmful and is withdrawn: it deletes the FCM
token without deactivating the row v2 registered, and v2's next boot re-sync
then re-registered the device and undid the user's choice. Phase 6's settings
home should link to the same control, not fork a second one.

**G4 — `/channels` and muted rows.** The July 18 exchange says the cross-space
list excludes muted channels unless they hold a mention; `api-digest.md` does
not cover this endpoint. The screen renders correctly either way. Checklist
step 41 asks the tester to report which is true.

**G5 — W1 note N6 still open.** `MarkReadResponse.last_read_message_id` in
`types/collab.ts` is stale (the server ships `last_read_message_uuid`). No wave
has needed to touch that type; fix it in the next one that does.

**G6 — W6 (live quiz) is unbuilt by design** (decision D3). The feed already
renders `quiz_game_live` / `quiz_game_finished` system cards, so prod feeds are
handled, not broken.

**G7 — backend ask still open:** block guest tokens on collab endpoints
server-side. The client gate is product truth, not security.

---

## The v1 collab deletion list (phase 7)

Verified against the tree on 2026-08-04. **Nothing here is deleted by phase 5** —
v1 must keep serving these files until the cutover flips the audience.

**Delete outright — collab surfaces (58 files, ~10,100 lines).**

| Group | Files | Lines |
|---|---|---|
| `components/collab/**` (incl. `files/`, `lists/`, `skeletons.tsx`) | 42 | 7,721 |
| `app/(main)/spaces/{page,layout}.tsx`, `spaces/[spaceId]/page.tsx` | 3 | — |
| `app/(main)/channels/layout.tsx`, `channels/[channelId]/page.tsx` | 2 | — |
| `app/(main)/{invitations,channel-invitations,space-invitations,organization-invitations}/page.tsx` | 4 | — |
| `app/(main)/settings/organization/{page,layout}.tsx` | 2 | — |
| _(the eleven route files together)_ | 11 | 214 |
| `lib/hooks/useCollab.ts` | 1 | 1,638 |
| `lib/hooks/useChannelRealtime.ts` | 1 | 345 |
| `lib/realtime/echo.ts` — only `useChannelRealtime` + `RealtimeNotifications` import it | 1 | 77 |
| `lib/utils/spaces-access.ts` — no v2 consumer after W5 | 1 | 24 |
| `components/auth/SpacesGuard.tsx` | 1 | 67 |

The study counted 63 files / ~11,750 lines; this inventory is 58 / ~10,086
because the study included the four SHARED modules listed below, which do not
die with the feature.

**Edit, do not delete.**
- `app/(main)/layout.tsx` — drop the `<RealtimeNotifications />` and
  `<PushRegistrar />` mounts (lines 38–39, 124–125).
- `components/layout/app-sidebar.tsx`, `components/settings/settings-sidebar-nav.tsx`
  — drop the Spaces entries and the `canAccessSpaces` import.

**KEEP — v2 consumes these (never delete with collab).**
- `types/collab.ts`, `lib/api/collab.ts`, `lib/api/push.ts` — the data layer.
- `lib/utils/collab.ts` (time/mention helpers), `lib/utils/collab-audience.ts`,
  `lib/utils/pwa.ts`, `lib/utils/device-name.ts`.
- `public/firebase-messaging-sw.js` — SHARED. v2 push depends on it.

**Dies with v1 at cutover, not with collab** (v1's own notification plumbing,
still used by v1's settings and conversation screens): `lib/hooks/usePushNotifications.ts`,
`lib/hooks/useBrowserNotifications.ts`, `lib/stores/notificationPrefsStore.ts`,
`lib/firebase/messaging.ts`, `lib/utils/browser-notify.ts`.

---

## Notes for the next phase

- **The manifest is now the live switch for four collab surfaces.** A rollback
  is one commit on `v2/routes.manifest.ts` (or the `V2_ENABLED` kill switch) and
  needs no code revert — the v1 pages are untouched and still resolve.
- **The push nudge is the ONLY place v2 asks for permission.** Keep it that way;
  a second asker on load is what browsers punish.
- **The dispatcher stays the only source of collab toasts and sounds.** Rule 5
  now assumes push and toast are complementary; any new notification surface
  must join the ladder rather than raise its own toast.
- **Phase 6 should give v2 a settings home** — it would close G3, and the
  delivery switches now in the bell would gain a natural second home there.
