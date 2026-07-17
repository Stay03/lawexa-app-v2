# Phase 5 — Collab + Notification Spine: plan

**Objective:** Spaces/Channels rebuilt on a real communication-grade notification model.
Prereq: backend asks (sent in phase 1) delivered — unread/mention counts in payloads + realtime
count events + push send-side status.

> Expand to task level at kickoff. Key spec: `foundation-standards.md` §5 "Unread &
> notification model" (adopt verbatim) + audit Part 2 §8 gap list.

## Scope

1. **Notification spine** (`v2/runtime/realtime/`): ONE dispatcher deciding toast/sound/badge/
   title per event (visibility-aware — never notify the visible conversation); app-wide user
   channel listener; `notify_level` enforced client-side; `document.title` + favicon +
   `setAppBadge` rollups; sound (≤300ms, coalesced) with independent toggles.
2. **Unread model**: bold = unread, numeric = mentions only; unread divider line; mark-read
   triggers (open + focused + newest visible ≥1s / send / jump); channel → space → app rollups.
3. **Channels**: message feed on the virtualized list, optimistic send with sending/failed+retry
   states, edit/delete (long-press sheet on touch), mentions with self-mention highlight,
   `?m=` message deep-links (scroll-to + highlight), typing/presence, realtime cache writers
   (port the v1 pattern — it's the model), reconnect gap recovery.
4. **Spaces/orgs**: browse, detail, membership, invitations (all four invite surfaces),
   organization settings + CAC verification; lists + files channel tabs.
5. **Lawexa-in-channels**: summon, responding states, AI sessions/glance (port from v1 on the
   new engine).
6. **Push**: deep links land on the right message; foreground/push dedup rules per spec.

## Exit criteria

A message in an unopened channel produces the correct badge/toast/sound within a second;
mention deep-links land highlighted; muted channels stay silent except @you; testers run their
team comms in v2; `post-implementation.md` written.
