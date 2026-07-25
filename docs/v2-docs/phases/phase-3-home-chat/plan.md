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
- **W4 — cache integration** — **SHIPPED (`d8bb01d`).** The chat↔sidebar staleness bug class is
  structurally closed: `v2/features/conversations/cache.ts` is the ONE shape-aware writer
  (remove / touch / patch / upsert) over both cached list shapes (flat peek + infinite pages),
  no-op reference-stable (precise invariant documented — recents consumers must never read
  `dataUpdatedAt`); create upserts an optimistic row (guarded OFF for confidential/redacted —
  privacy first), send + complete `touch`-bump the row, title arrival `patch`es in place (a late
  title must not reorder), `deleteConfidential` reuses the module. RSC hydration:
  `v2/features/conversations/server.ts` (server-only) prefetches page 1 of the EXACT
  `infiniteRecents()` key over the DAL `apiFetch` (query string DERIVED from the shared params —
  no drift), awaited in `app/v2/layout.tsx` behind a 3s timeout + `HydrationBoundary`, so a
  signed-in hard load paints real sidebar rows at first paint; guests and API failures fall back
  to today's client fetch. Adversarial review: **SHIP AS-IS** (first W4-class verdict; 4 LOW
  findings, 3 applied). Known bound (review F4, documented in code): a send on a conversation
  not present in any loaded recents page can't bump it — heals on the next natural refetch.
- **W5 — conversations list page + manifest** — **SHIPPED (`03a9b44`).** `/conversations` claimed
  (exact manifest entry; v1 fallthrough intact); server shell + noindex metadata; the §E
  keep/drop study (in `v1-keep-drop-and-redesign.md`) drove scope. URL-synced 300ms search
  rebuilt lint-clean (guarded render-phase external-adopt — v1's props→state effect defect NOT
  copied); `conversationsQueries.infiniteList({search})` keys under `lists()` so every W4 cache
  write propagates (archived rows inline — this page is their only home); module-language rows
  with the confidential emerald identity (v1 hid it), archived badge, anchored relative time;
  distinct skeleton/empty(search-aware)/error/guest states. COLD adversarial review (the
  implementer process died pre-report; reviewer derived intent from code): SHIP AFTER FIXES,
  all applied — the search-hook desync reachable via bare `/conversations` nav links, the
  sentinel re-rooted on the shell's real scroll container via the new
  `v2/shell/shell-content.ts` id seam + `use-shell-scroll-root.ts` (a viewport root silently
  loses `rootMargin` inside the nested overflow region — reusable lesson for every full-page
  infinite list), the errored-search-under-kept-data silent failure (inline retry banner; dim
  gated on `isFetching` so a settled error can't strand the list), 44px clear target,
  confidential announced in the row's accessible name, placeholder-page fetch race masked.
- **FIX ROUND 2 (owner device + live review, July 19-20) — SHIPPED** (hotfixes `f699ec1` +
  `7c77287`, then the four-wave round `24ab675`). Owner items: (1) keyboard half-covering the
  Chat-tab composer on a Galaxy A21 — root cause was BOTH a wrong capability guard in
  `use-keyboard-inset.ts` (`'virtualKeyboard' in navigator` bailed on overlay browsers that
  ignore `interactive-widget`; replaced with the self-calibrating occlusion measurement) AND
  ChatHome's non-sticky `mt-auto` composer (now the same sticky bottom dock as Work/Study);
  (2) composer → compact floating pill (`max-w-xl`, staging + jurisdiction chip float ABOVE,
  transparent dock row, skeleton lockstep 122px byte-exact, staging stack symmetric both
  directions + 40vh tray cap; HOME width deliberately unchanged — owner to confirm if it
  should narrow too); (3+7) every tool/sub-agent rendering rebuilt on the new v2 presentation
  layer (`tools/tool-content.ts` classifier + `BoundedScroll` — the raw-dump class is dead,
  no redundant chips/counts, elevated result rows, notes render as note cards never raw HTML;
  unknown tools keep their params); (4) `stream-smoother.ts` — presentation-only steady-release
  with proportional catch-up (bounded ~350ms lag), grapheme-safe, terminal snaps, replay lumps
  never typewriter, resilience surface verified byte-identical, `smoothing` config kill-switch
  (constants τ=350ms/120cps/30fps await a live feel pass); (5) route loading boundaries are
  skeletons (the phase-1 "Loading…" text violated skeleton-first); (6) /conversations search
  rebuilt RACE-FREE after the review-fix regression — commits via native
  `replaceState(null,…)` (the `history.state` arg tripped Next's internal-call `__NA` guard
  and silently disabled filtering — caught by the re-review against the installed router
  source), draft + consumed self-write queue + idle orphan prune. Loop: 4 parallel Opus
  implementers → 3 Opus adversarial reviews (D REWORKED then re-verified; E/F/G SHIP AS-IS)
  → coordinator fixes. Accepted-with-record: Chat-tab mobile DOM-vs-visual order divergence
  (inherent, desktop kept matched); compact sub-44px disclosure toggles in the tool trace
  (deliberate density; primary links are 44px).
- **FIX ROUND 3 (owner live-test follow-ups, July 20) — SHIPPED (`82c2c7d`).** Owner items:
  (1) "textarea still not floating" → the composer LEFT the dock grid-row (the dock and
  transcript are stacked rows — nothing can scroll behind a dock composer, ever) for an
  `absolute bottom-0` overlay inside the conversation screen: transcript scrolls behind AND
  below the pill, keyboard safety inherited from the shrinking content region, dock
  reservation retired (mechanism kept dormant), clearance measured live into
  `--v2-conv-dock-h`; (2) jurisdiction popup halved on mobile (`max-h-32 sm:max-h-64`);
  (3) zero-result honesty — `detectEmptyResult` claims zero ONLY on an affirmative empty
  payload ("No cases matched" per variant + a quiet "· no matches" on search step lines;
  unreadable shapes fall to the honest generic view); (4) "butter" — the new-line jump was
  the transcript's one-frame `scrollTop` snap per line wrap (exposed by the smoother), now an
  eased rAF bottom-follower, and the smoother's velocity is low-pass filtered at 60fps so
  bursts ramp instead of dumping clause-sized chunks (steady-state lag unchanged). Combined
  adversarial review: SHIP AFTER FIXES — the HIGH catch: the eased follower stranded the view
  on any >threshold height jump (EVERY history load; end-of-stream snap) with a spurious
  pill; big jumps now snap, only sub-line growth glides. Watch items for device testing:
  60fps last-block markdown re-parse on low-end devices (`publishIntervalMs` is the lever);
  the full-width pointer band flanking the pill on ≥576px (optional polish, recorded);
  feel-tuning knobs `velocitySmoothingMs`/`catchUpTauMs`/ease `0.25`. OPEN OWNER DECISION:
  narrow the HOME composer to match the conversation pill?
- **PERF + STREAMING ROUND (owner's nine steps, July 20) — SHIPPED (`e7e1c31`).** Loop: 4 parallel
  Opus implementers → 3 per-workstream adversarial reviews → rework → 2 sequential implementers →
  ONE whole-body review of the seams. Every verdict was SHIP AFTER FIXES; all findings closed.
  **Speed:** pages stopped awaiting `verifySession()` (identity now published once from the layout,
  which does not re-render on soft nav); the layout's two server calls run concurrently; the
  conversation transcript became `conversationsQueries.detail` seeded into the engine, so a revisit
  paints transcript AND composer in the first frame; lists retain 30 min. **Privacy:** the whole-body
  review found two HIGH issues the per-item reviews could not see — the v2 QueryClient is a module
  singleton that v1's sign-out does not clear, and v1 login/logout are soft navs, so the next user
  on a shared device saw the previous user's lists/bookmarks/spaces/radars/quiz scores; and a
  transient `/auth/me` failure could cache a private transcript under a `viewerId: null` partition.
  Both closed by `v2/runtime/cache-identity-guard.tsx`. **Streaming:** rate + cadence bugs fixed,
  word release with a compositor fade (smoother and ~60% cheaper), a bounded end-of-answer drain,
  and a second `line` style with a stand-in bar — switchable from Settings → Developer, reachable
  from a new role-gated v2 header item. **Loading:** the home fallback reads the active tab and
  shares one geometry module with the real surfaces; static chrome reserves a still shape and only
  data pulses; skeletons stop pulsing under reduced motion (v2-scoped). Plus the reusable
  "N new conversations" pill for phase 4. **NEW STANDING RULE:** never render a skeleton over
  content already in cache (standards §8 + corollary). **RECORDED FOR THEIR OWN WAVES:** shared-device
  confidential ownership (`useConversationController` grants ownership from a device-local IDB
  transcript), and unpartitioned conversation LIST cache keys.
- **NAVIGATION + TRANSCRIPT ROUND (owner's four items, July 25) — SHIPPED.** Built and reviewed by
  the coordinator directly (the owner asked for no subagents this round). **(1)** The `line` stream
  style's stand-in bar is gone — the style is now a release rhythm and nothing else, so
  `useStreamStyle` no longer reaches the renderer at all (`StreamingLineSkeleton.tsx` deleted, plus
  its prop on `MarkdownText`/`ChatContent` and the `.v2-stream-line` rule). **(2+3) THE ROOT CAUSE
  BEHIND BOTH:** every v2 route is dynamic (the layout reads cookies) and Next's default
  `staleTimes.dynamic` is `0`, so EVERY navigation re-fetched the segment and `loading.tsx` covered
  the wait — which is why none of the wave-4/5 cache work was ever visible. Fixed with the PER-PAGE
  `export const unstable_dynamicStaleTime = 300` on the three v2 pages, deliberately NOT
  `experimental.staleTimes` in `next.config.ts` (that would re-time every v1 route too; Next forbids
  the export in layouts, which is the same boundary from the other side). Identity stays exact:
  `SessionSync` → `router.refresh()` → `invalidateBfCache()` version-bumps every cached segment, and
  `V2CacheIdentityGuard` clears the query cache on the same edge. VERIFIED: `V2_ENABLED=true next
  build` classifies all three as ƒ, and `next start` emits `"d":300` in the RSC body of `/`,
  `/conversations` and `/c/{id}` (Next 16.2.10 `segment-cache/bfcache.js` reads that into `staleAt`).
  NOTE: a build with `V2_ENABLED` unset prerenders the v2 routes as STATIC 404s — the kill switch
  fires before `cookies()` — so only a `V2_ENABLED=true` build is representative. **(3)** The route
  boundary and the screen's own resolving state drew DIFFERENT silhouettes (transcript-only vs.
  transcript + composer), so the text-box skeleton appeared on a cold open and vanished on a warm
  one; both now render the one definition in `v2/features/conversations/conversation/skeletons.tsx`
  (server-safe, so the route boundary ships no client JS for it). **(4)** The transcript painted at
  `scrollTop 0` and only jumped to the bottom after the ResizeObserver + rAF — one guaranteed frame
  of the wrong end of the conversation, then a full-height jump. A LAYOUT effect now lands the first
  paint at the bottom before the browser draws; the last four groups are exempt from
  `content-visibility` so the arrival screenful is measured rather than estimated
  (`UNVIRTUALIZED_TAIL`); and the transcript fades in instead of cutting in.
  tsc 0 / eslint 0 / `V2_ENABLED=true next build` clean.
  NOT VERIFIED IN A BROWSER — the mechanism is confirmed end to end at the server boundary, but the
  absence of the skeleton on a return trip is for the owner's live test.
- **W6 — on-device mobile verification + metadata** — **PENDING.** iOS Safari + Android Chrome
  (keyboard, safe-area, long-press action sheet, 44px targets); conversation `generateMetadata`/OG
  kept and moved into the v2 convention.

## Manifest additions

At HEAD `v2/routes.manifest.ts` migrates `/`, `/c/*` (W3), and `/conversations` (W5).

## Exit criteria

Testers default to v2 for chat; chat↔sidebar staleness bug class gone; on-device keyboard
correctness confirmed; `post-implementation.md` written.
