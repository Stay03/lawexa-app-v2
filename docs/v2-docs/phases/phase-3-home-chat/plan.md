# Phase 3 — Home + Chat: plan

**Objective:** the core product surface rebuilt on the approved design language. Exit = testers
do their daily research in v2.

> Expand to task level at kickoff. Key specs: `foundation-standards.md` §5 (streaming chat
> rendering spec) and §2 (chat streaming vs cache).

> **START HERE (July 18, 2026): `v1-keep-drop-and-redesign.md`** in this folder is the authoritative
> prep — the first-hand keep/drop study of v1's home/sidebar/header/conversation and the owner's
> design decisions. Sub-phase 3.0 (below) — the shell + home redesign — is now CLOSED
> (owner-accepted, `post-implementation-3.0.md`); the chat waves now underway use that doc's §C
> conversation catalog as their scope.

## Sub-phase 3.0 — Shell + home redesign ("go bold", 2 designs, owner picks 1) — CLOSED

> **CLOSED July 18, 2026 (owner-accepted) — full commit trail in `post-implementation-3.0.md`.**
> The "two designs, owner picks one" endgame described below was SUPERSEDED mid-round: the A/B dev
> switcher graduated into real **Chat | Work | Study** product tabs
> (`v1-keep-drop-and-redesign.md` §A5 item 34). Design A became the Chat tab; Design B was deleted
> with its launchpad DNA absorbed into Work/Study. The historical plan is kept below for the record.

Owner reviewed the live shell (e53e2a0) and wants it visibly better than v1, not a reskin. Full
brief + decisions + build plan in `v1-keep-drop-and-redesign.md` §A/§B/§D. In short:
- Wave 1: shared chrome — real logo, v2-native notification bell (in header, reuse
  `lib/api/notifications`), theme toggle, real user footer, Comfortaa home font, off-canvas
  sidebar kept, + a dev design-switcher (A|B) with stub designs.
- Wave 2: two bold responsive home designs (A "Warm Spotlight", B "Research Launchpad").
- Wave 3: review, ship, owner approves one live at /v2. Winner stays; then the chat waves below.

## Chat waves (build order + status)

The §C conversation catalog in `v1-keep-drop-and-redesign.md` is the scope authority. Six waves,
each its own implement → adversarial-review → verify → ship loop:

- **W1 — streaming-engine port** → `v2/runtime/chat-engine/` — **SHIPPED (`8864ac1`).** v1's
  `useChatStream` SSE core lifted into a framework-light state machine (no React imports) + a thin
  React adapter, parity-audited line-by-line against v1 (all 20 cataloged resilience behaviors
  confirmed): 60s watchdog, heartbeat stale-detection, 3× reconnect → 5s polling, seq dedup,
  `accumulated_text` replay, recovery, graceful cancel, confidential IndexedDB (byte-identical
  schema — v1 and v2 share the physical DB). NEW beyond v1: the streaming-render policy — deltas
  buffer in refs and flush on a ~60ms cadence into per-message `useSyncExternalStore` stores, so
  only the affected row re-renders on token arrival (v1's biggest chat perf defect, structurally
  fixed); thinking tokens captured per-message, UI gated on real backend payloads for W3.
- **W2 — composer wiring** → `v2/features/conversations/start-conversation.ts` + wired
  `HomeComposer` — **SHIPPED (`b16739a`).** The strangler seam: v2 creates the conversation, writes
  v1's exact byte-compatible `conv_init_{id}` sessionStorage handoff, and navigates to `/c/{id}` —
  where v1's conversation page picks it up and streams (the first real v2 send runs on v1's screen
  until W3 claims the route). Privacy bridge: confidential/redacted sends write v1's persisted
  mode-store marks (`confidentialIds`/`redactedIds`) + hard-navigate so v1 hydrates them, no
  global-toggle leak. Real uploads (v1 validation), drafts, guest round-trip, recents-cache
  invalidation.
- **W3 — conversation screen** (`/c/[conversationId]`) — **SHIPPED `f66bb7f`** (44 files).
  `/c/*` claimed in `routes.manifest.ts` (v1 fallback intact; shared conversations render with
  the view-only pill); engine mounted with the confidential/redacted resolvers wired over
  `mode-marks.ts` — the privacy acceptance criterion PASSED its adversarial trace end-to-end;
  per-row token repaint + native `content-visibility` virtualization (the standards' named
  react-virtual ≥3.16 never shipped — dated correction in foundation-standards.md §5); all 15
  §C cards ported; ONE activity region; scroll etiquette; dock composer (SSR reservation kills
  the CLS); working copy + **"Ask again"** (honest re-send — a true in-place regenerate awaits a
  backend endpoint, logged as a future ask).
- **FIX ROUND (owner live review of W3, July 19; decisions in §A7 of
  `v1-keep-drop-and-redesign.md`) — SHIPPED (`9c905af`).** Three parallel Opus implementers +
  one adversarial reviewer (verdict SHIP AFTER FIXES; all 7 findings applied). What landed:
  honest confidential copy at ALL FOUR sites (the reviewer caught a fourth — HomeComposer's
  `+`-menu item — the round's own briefs had missed) + `ConfidentialBanner` with a
  destructive-confirm delete (disconnect → IDB wipe → both persisted marks cleared → optimistic
  recents-cache removal → home) + attachment-level `expires_at` stamped from the 24h policy and
  prune-filtered on open (transcript text has NO TTL — the binding copy governs);
  `appendAssistantTurn` no longer create-if-absent (kills the delete-mid-stream resurrection
  vector); dock composer rebuilt to the channels single-row anatomy with all staging inside the
  card + `ComposerSkeleton` matched; tool chain redesigned on the module language — the v1
  `animate-collapse-up/down` classes were proven DEAD (no keyframes exist anywhere; audit Part 2
  was right) and the working replacement is the v2-named `.v2-collapse` utility in `shell.css`
  (both directions, motion-reduce, `defaultOpen` first-paint caveat documented) with the
  show-all/collapse now a mounted `0fr↔1fr` grid transition (+`inert` on the collapsed steps);
  Library collapsible animated in the sidebar AND built-from-scratch in the drawer (its Library
  was static; the top row deliberately became a toggle, `/cases` reachable via the child row);
  tabs scoped to home with the centre slot showing route context via the new
  `v2/shell/header-context.ts` store (controller publishes title+confidential incl. a
  title-arrival fetch; header cross-fades tabs↔context with `inert`, skeleton-first title);
  case-mention previews ported v2-natively (module-stable markdown `a` override, TanStack
  cache, hover-card desktop / tap-preview popover on touch, origin-gated path-anchored slug
  detection; new `components/ui/hover-card.tsx` primitive — v1 untouched).
  **LOGGED BACKEND ASK:** confidential conversations may appear as contentless stubs in the
  conversations list; v2 now deletes the device-owned content but no user-facing conversation
  delete endpoint exists — we want a deleted confidential conversation to stop appearing in
  the list. **Known cosmetic follow-ups (pre-existing, out of scope):** the drawer's Search
  button has no handler; `use-conversation-stream`/`JurisdictionField`/`StudyHome` import
  `lib/stores/authStore` (boundary quirk to revisit).
- **W4 — cache integration** — **PENDING.** send/create/complete updates the conversations list
  cache (`queryOptions` factory for conversations; RSC prefetch + hydration for the sidebar/list
  recents on the same query source).
- **W5 — conversations list page + manifest** — **PENDING.** The `/conversations` page, added to
  `routes.manifest.ts`, on the same query source as the sidebar recents.
- **W6 — on-device mobile verification + metadata** — **PENDING.** iOS Safari + Android Chrome
  (keyboard, safe-area, long-press action sheet, 44px targets); conversation `generateMetadata`/OG
  kept and moved into the v2 convention.

## Manifest additions

At HEAD `v2/routes.manifest.ts` migrates `/` and `/c/*` (W3). `/conversations` joins when
**W5** lands.

## Exit criteria

Testers default to v2 for chat; chat↔sidebar staleness bug class gone; on-device keyboard
correctness confirmed; `post-implementation.md` written.
