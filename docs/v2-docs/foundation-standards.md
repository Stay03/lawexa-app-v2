# Lawexa v2 — Foundation Standards (research-backed)

Companion to `frontend-architecture-audit.md` (what's wrong) and `frontend-v2-plan.md` (how we
build). This doc is the **standards layer**: current (mid-2026) best practices researched from
primary sources (official Next.js/TanStack/Tailwind/shadcn docs, Vercel/TkDodo/Emil Kowalski/
Rauno Freiberg, web.dev/MDN/W3C, Slack/Discord/Stream), cross-checked against our stack and plan.
Full citations live in the research transcripts; key URLs inline.

---

## 1. Corrections to the plan (research-mandated)

1. **`middleware.ts` is deprecated in Next 16 → the switch file is `proxy.ts`** (exported `proxy`
   function, Node.js runtime only — no edge constraints). Use `NextResponse.rewrite()` (it
   propagates RSC headers correctly). Cookie-keyed rewrite = Vercel's officially taught
   strangler-fig pattern. After toggling the cookie, do a full-page navigation, not a client
   transition (stale prefetched RSC payloads).
2. **The `/v2` real-prefix approach is not just preferred, it's required** — two route groups
   resolving the same URL is a hard build error.
3. **Proxy is never the security boundary** (CVE-2025-29927 hit self-hosted apps exactly like
   ours). Build a `server-only` **DAL**: `verifySession()` wrapped in React `cache()`, an
   `apiFetch()` that turns the session cookie into `Authorization: Bearer`, called in every RSC/
   Server Action/route handler. Proxy does optimistic cookie-presence checks only.
4. **Version hygiene**: upgrade 16.1 → 16.2.x now; Next.js has a monthly security release program
   and the **July 20, 2026 patch** (4 high severity) must be applied promptly.
5. **`cacheComponents: true` — DEFERRED to phase-7 cutover** (phase-1 investigation, July 17,
   2026: the flag is global; it breaks 53 v1 routes because v1's client `(main)`/`(admin)`
   layouts give PPR no server-side postpone point, and route-segment opt-outs are categorically
   rejected under the flag). The v2 tree ALREADY passes under it — so v2 upholds the discipline
   **by convention** (server layouts, per-route `loading.tsx`/`error.tsx`, DAL in `cache()`,
   Suspense around request-time reads; never a `'use client'` layout) and the flag flips nearly
   free at cutover. `"use cache"`, `cacheLife`, `cacheTag` are stable; use
   `revalidateTag(tag, profile)` two-arg form when the flag lands. Evidence:
   `phases/phase-1-engineering-foundation/cache-components-investigation.md`.
6. **Mutations split**: Server Actions for form-ish flows (cookie→bearer + revalidation +
   `useActionState` in one round trip) but **route handlers for chat send / high-frequency
   interactions** — Server Actions execute serially per client. Never fetch data through our own
   route handlers from RSCs (fetch the Laravel API directly in the DAL); never read via Server
   Actions.
7. **Self-hosting specifics (Coolify)**: `output: 'standalone'` + copy `public/` and
   `.next/static/` into standalone; `HOSTNAME=0.0.0.0`; **verify Traefik streams responses
   unbuffered** (the whole loading.tsx/PPR strategy depends on streaming); set `generateBuildId`
   from git SHA + `deploymentId` for version-skew hard reloads; single instance needs no custom
   cache handler; do not CDN-cache HTML during the cookie migration.

## 2. Data layer policy (adopt verbatim)

- **Per-feature `queries.ts`** with a hierarchical key factory whose leaves are **`queryOptions()`**
  objects (v5 idiom — one typed definition shared by `useQuery`/`useSuspenseQuery`/`prefetchQuery`/
  `getQueryData`); `mutationOptions()` likewise. No inline keys anywhere. Never share a key
  between `useQuery` and `useInfiniteQuery`.
- **RSC bridge**: server `getQueryClient = cache(() => new QueryClient())`; prefetch **without
  awaiting** + dehydrate pending queries (`shouldDehydrateQuery` includes `'pending'`) +
  `<HydrationBoundary>`; client uses `useSuspenseQuery`. Don't double-own data (RSC-render AND
  hydrate the same query). Data that's render-once and non-interactive → plain RSC, no hydration.
- **staleTime tiers** (the lever; refetch flags are not):

  | Tier | staleTime | Use |
  |---|---|---|
  | `live` | 0 | badges/presence without socket coverage |
  | `realtime` | `Infinity` | Echo-covered data — socket events are the staleness signal |
  | `standard` | 60s | default |
  | `reference` | 10min (gcTime 30min) | statutes/cases lists — also preserves back-nav scroll |
  | `static` | `'static'` | boot constants (plans, countries, flags) |

- **`refetchOnWindowFocus` stays ON** (v5 uses `visibilitychange` only). Never disabled as a
  freshness fix — fix the tier.
- **Mutations**: global `MutationCache.onError` → toast (one channel — structurally kills the
  silent-rollback bug class); global `onSuccess` → invalidation filtered by mutation `meta` tags
  (exclude `'static'`); return the invalidation promise when the UI must stay pending until
  consistent. Optimistic updates only for toggles/sends/checks: prefer `variables`/
  `useMutationState` for single-surface, full `onMutate` snapshot+rollback (with
  `await cancelQueries` and `isMutating() === 1` guard) for multi-surface. `scope: { id }` to
  serialize edits to the same entity. Use `mutate`, not `mutateAsync`.
- **Realtime**: default = **invalidate-on-event** (server pushes "what changed", client refetches
  active queries through the normal auth path). `setQueryData` from events only for
  high-frequency small deltas (visible channel's messages) via purpose-built helpers.
- **Chat streaming**: in-flight stream lives outside the cache (dedicated hook state), final
  message written/invalidated into the messages query on completion — matches Vercel AI SDK
  practice; `experimental_streamedQuery` exists but isn't needed.
- **Persistence** (if adopted): `experimental_createQueryPersister` over idb-keyval, **opt-in**
  via `meta: { persist: true }`, `buster` = release version, cleared on logout. Never persist
  auth-sensitive payloads.
- **Banned** (lint/review enforced): fetch-in-useEffect beside RQ; copying query data into
  Zustand; module-level caches; inline keys; per-callsite ad-hoc invalidation sprawl;
  hand-mutating infinite `pages`.

## 3. Design system standards

- **Primitives**: stay on **Radix** (shadcn's default switched to Base UI in July 2026; Radix
  remains fully supported — pin `-b radix` in any shadcn CLI usage). "new-york" style. Theme via
  semantic CSS-variable tokens ONLY — never edit component classNames for color/radius; use
  `data-slot` + call-site overrides for variants. Consider `shadcn/typeset` for rendered legal
  documents/markdown.
- **Token architecture** (`design/tokens.css`): raw ramps in `@theme` (generates utilities),
  mode-switching semantics in `:root`/`.dark` bridged with `@theme inline`; `@keyframes` live
  inside `@theme` next to their `--animate-*` token; reset unused namespaces
  (`--color-*: initial`) to shrink the drift surface. **Define `--radius-DEFAULT`** so bare
  `rounded` lands on our scale (fixes the audit's 164 off-scale uses by construction).
- **Anti-drift tooling**: `eslint-plugin-better-tailwindcss` (v4-aware, `no-unknown-classes`) +
  `prettier-plugin-tailwindcss`. Arbitrary values treated as failures of the token system.
- **Typography roles**: **Fraunces = display + reading serif** (page titles, case names, long-form
  judgments; `font-optical-sizing: auto`, pin `"WONK" 0`, low SOFT — editorial but serious);
  **UI sans = workhorse** for all controls/body (pick in design variations);
  **Comfortaa = brand moments only** (wordmark, never UI labels). Fixed type scale for UI
  (xs→2xl with set line-heights), `clamp()` only for display (rem+vw mix, max ≤ 2.5× min — pure-vw
  clamps fail WCAG 1.4.4), `tabular-nums` in tables, no weights below 400, no weight-shift on hover.
- **Motion tokens**: `--duration-fast: 120ms` (hover/press) / `--duration-base: 180ms`
  (popovers/tabs — ≤200ms rule) / `--duration-slow: 240ms` (dialogs/sheets) / `--duration-hero:
  400ms` (rare, emphasized). Easings: M3 standard `cubic-bezier(0.2,0,0,1)` default (ease-out for
  user-initiated), accelerate for exits, emphasized for hero only. **transform/opacity only.**
  Library: CSS-first (tw-animate-css on Radix states) + `motion` (`motion/react`) at leaf client
  components for gestures/springs/exit choreography. View Transitions API = progressive
  enhancement only (still experimental in Next). Reduced-motion via `motion-safe:` progressive
  enhancement. Never animate: high-frequency actions, table updates, anything blocking input.
- **Elevation**: semantic tokens (`--elevation-card/popover/dialog`), Geist-style 1px
  ring + layered low-opacity shadows in light; **dark mode = 1px lighter inset borders + lighter
  surfaces** (shadows barely read on dark). One rule per component tier.
- **Radius discipline**: controls `rounded-md`, cards `rounded-xl`, dialogs/sheets `rounded-2xl`,
  pills/avatars `rounded-full`; nested radii concentric (`outer = inner + padding`).
- **Gold ramp**: fixed hue 82, vary L/C. The bright brand gold (L≈0.7–0.8) **cannot pass 4.5:1 as
  text on white** — the ramp needs a text-safe dark gold (L≈0.5, verified) for links/accent text
  in light mode; bright gold is for surfaces/borders/shimmer/fills-with-dark-text. All current
  `amber-*` use cases re-derive from this ramp.
- **The shimmer, rebuilt compositor-only**: the current `background-position` animation is paint
  work every frame (always-on = battery/jank cost on mobile). Identical look via the oversized-
  rotor technique: pseudo-element (200%×200%) carrying the **static** gold gradient, animated with
  `transform: rotate()` (or `translateX()` for a linear sweep), content surface inset 1px so only
  the ring shows. Gate with `prefers-reduced-motion` (static gold border fallback — also satisfies
  WCAG 2.2.2 pause for >5s motion), pause off-screen, and **reserve it for signature surfaces**
  (composer, "Lawexa responding") — restraint keeps it premium.
  **RESOLVED (round-2 A/B, July 17, 2026): the owner chose the ORIGINAL.** The side-by-side
  parity instrument was built (`design-variations/round-2/shimmer-parity.html`), the owner
  compared them, and the original `background-position` implementation ships in v2 verbatim.
  The compositor-rebuild guidance above is retired for the shimmer specifically; the only
  permitted changes are invisible safeguards (`prefers-reduced-motion` static ring, off-screen
  `animation-play-state: paused`). The paint-per-frame cost is accepted as the price of the
  signature — it is confined to the composer surfaces.
- **Craft checklist** (Rauno's Web Interface Guidelines / Emil / Linear school — the "sleek"
  bar): visible `:focus-visible` box-shadow rings everywhere; hover states only under
  `@media (hover: hover)`; transitions on specific properties, never `all`; press scale ~0.96;
  skeletons occupy exact final geometry (no reflow); feedback near its trigger; empty states
  always prompt an action; 4px spacing rhythm; one icon set (Lucide) with `aria-label` on
  icon-only buttons; styled `::selection`; `forced-colors` outline fallbacks.
- **Accessibility bar**: WCAG 2.2 AA (the **European Accessibility Act is enforceable since June
  2025** and legal-tech will be held to it visibly). Targets ≥24px floor / 44px primary; Focus Not
  Obscured (sticky headers/toasts must not cover focus); redundant-entry + accessible-auth on
  auth flows; contrast validated with WCAG math (APCA as internal signal only).

## 4. Mobile baseline (the v2 shell contract)

- **Viewport meta**: `viewport-fit=cover` + `interactive-widget=resizes-content`; dual
  `theme-color` metas (light/dark). Safe-area padding on every top/bottom bar — **Android
  requires it now too** (Chrome 135+ edge-to-edge default), not just iOS.
- **The composer keyboard recipe** (canonical, replaces all fixed-position composers):
  non-scrolling document — **scoped, during the strangler period, to a
  lifecycle-managed class** (`html.v2-document-lock { overflow: hidden }` added/removed by a
  client effect on v2 mount/unmount; React 19 never unloads route stylesheets, so a bare
  `html, body` rule would leak into v1 after a soft navigation — wave-4b reviewer finding),
  app shell
  `height: 100dvh` grid (`header / scrollable content / composer-or-tabs` rows), messages scroll
  internally with `overscroll-behavior: contain`. Android/Firefox handled by the meta + dvh with
  zero JS. iOS Safari (still no `interactive-widget`, no VirtualKeyboard API, fresh iOS 26
  fixed-positioning bugs): one hook subscribing to `visualViewport` resize+scroll writes
  `--keyboard-inset`; shell height = `calc(100dvh - var(--keyboard-inset, 0px))`; re-pin list to
  bottom after settle. Never `100vh`, never `position: fixed` composers, never build on the
  VirtualKeyboard API.
  **Reconciliation with owner feedback**: the owner wants the composer to *look* floating (like
  v1's notes/cases pages) — that's fully compatible with this rule. Floating is a visual style
  (rounded, shadowed, inset margins, content scrolling visibly behind/underneath); the grid-row
  requirement is a positioning mechanic. Style the composer row as a floating bar; never reach
  for `position: fixed` to achieve the look.
- **Navigation**: ~~persistent bottom tab bar~~ — the research default, **rejected by the owner
  (round-1 feedback: "the bottom menu on mobile is a mess")**. The constraint that survives from
  the research is only: don't hide all primary nav behind a single hamburger (NN/g: halves
  discoverability). The mobile nav pattern is an open phase-2 design question (candidates:
  refined minimal tab bar, floating dock, gesture-forward sheet, contextual top nav) — whatever
  wins must come from the single `nav.config.ts` and meet 44–48px targets + safe-area padding.
  Hide any persistent bar inside a conversation (composer takes the bottom edge).
- **Dialogs**: **vaul** Drawer on mobile / Dialog on desktop from one wrapper; drag handle,
  max-height cap under top safe area, internal scroll, `overscroll-behavior: contain`, swipe to
  dismiss, **no `autoFocus` on iOS**.
- **Touch**: all hover-reveal styling inside `@media (hover: hover) and (pointer: fine)`;
  message actions = hover toolbar on pointer-fine + **long-press bottom sheet on touch** (the
  Slack/Discord/Element convention) with a visible overflow button at `pointer: coarse`;
  `touch-action: manipulation`; replace (don't just remove) tap highlight with `:active` states;
  inputs ≥16px font (prevents iOS zoom).
- **Chat list virtualization**: **`@tanstack/react-virtual` ≥3.16** — first-class chat support
  (`anchorTo: 'end'`, `followOnAppend: true`, prepend stability, `measureElement` dynamic heights,
  `scrollToEnd()`). Headless, fits our stack; virtua is runner-up; react-window lacks chat
  semantics.
  **CORRECTION (July 19, 2026, verified against the npm registry during chat wave 3):** the
  version and APIs named above DO NOT EXIST — react-virtual's latest is **3.14.6** (no 3.15/3.16
  ever shipped) and v3 has no `anchorTo`/`followOnAppend`. The library itself is installable;
  what's absent are the chat-specific semantics this entry promised. The shipped v2 conversation
  screen therefore virtualizes off-screen message groups with native CSS
  (`content-visibility: auto` + `contain-intrinsic-size`), which sidesteps the genuinely hard
  problem of windowing STREAMING content (measured heights change mid-stream) — see
  `v2/features/conversations/conversation/MessageList.tsx`. Revisit a JS virtualizer only if
  real transcripts outgrow the CSS approach.
- **PWA**: manifest gets explicit `id`, `screenshots` (richer install UI),
  `launch_handler: navigate-existing` (notification clicks focus the existing window — right for
  chat); **Serwist** (`@serwist/next`) service worker — precache shell, SWR for images,
  network-first bounded cache for API GETs, offline fallback route, never blind `skipWaiting()`
  (update toast → SKIP_WAITING → single reload on controllerchange); `navigator.setAppBadge(n)`
  behind feature detection for unread (works on iOS 16.4+ installed PWAs); custom install button
  from stashed `beforeinstallprompt`, iOS share-sheet instructions only under
  `@media (display-mode: browser)`. Resolve the two-manifest conflict (one source).

## 5. Chat + collab UX specs (adopt as feature requirements)

**Streaming chat rendering** (P1):
- Buffer SSE tokens in a ref; flush to state every 50–80ms wrapped in `startTransition` — never
  per token (per-token renders can stall long streams entirely).
  **CORRECTION (July 19, 2026, adversarially verified):** external-store updates are ALWAYS
  synchronous — `startTransition` cannot defer a `useSyncExternalStore` notification (React RFC
  0214; react.dev `useSyncExternalStore` docs), so the operative mechanism is NOT the
  `startTransition` wrapper but the **buffer-and-coalesce cadence itself**: deltas accumulate in
  refs and a ~50–80ms flush notifies only the affected per-message subscribers. The
  `startTransition` wrapper is retained as a forward-compatible seam but is **inert for external
  stores**. Reference implementation: `v2/runtime/chat-engine/engine.ts` (with
  `use-conversation-stream.ts`, which supplies `commit: (fn) => startTransition(fn)`) — wave-1's
  engine work verified this against the React sources.
- Streaming markdown via **Streamdown** (Vercel's react-markdown replacement that repairs
  unterminated markdown mid-stream) or a marked-lexer block pipeline with per-block `React.memo`.
- Every message row `React.memo` by id; composer isolated so keystrokes never re-render the
  transcript.
- Message = ordered parts (text/tool/reasoning): tool calls render as compact status rows in a
  collapsed Collapsible; reasoning auto-opens while streaming, auto-collapses on finish with
  "Thought for Ns" (Vercel AI Elements pattern).
- Scroll etiquette: follow only while user is at bottom (~40px threshold); any upward scroll
  disengages instantly; floating jump-to-latest pill with count of messages since detach; sending
  always scrolls into view; `stop()` keeps partial text with a "stopped" marker; errors render
  inline with Retry, user text preserved.
- Show the "responding" state within one frame of submit (perceived TTFT < 500ms).

**Unread & notification model** (P3):
- Two axes, Slack-style: **bold = unread**, **numeric badge = mentions only** (DM/@you/@channel/
  keyword). Muted channels: no bold, no rollup — but personal @you still badges.
- **Unread line** above first message newer than `last_read_at` captured at open; persists for the
  view session; land at the line when unreads exist, else bottom.
- **Mark-read triggers**: channel open AND document visible AND newest message in viewport ≥1s;
  or user sends; or clicks jump-pill. Opening unfocused does NOT mark read. Esc = mark read.
- **Rollups**: channel → space (dot for activity, summed mention count) → app
  (`document.title (n)`, favicon overlay, `setAppBadge`).
- **Delivery decision**: visible conversation → inline only, never toast/sound; mention-grade
  elsewhere → toast (click navigates) + one short sound (≤300ms, coalesced per channel per ~10s)
  + badge; plain messages → badge/bold only; document hidden + push subscribed → defer to push.
  `notify_level` enforced client-side. Independent sound/toast toggles + "pause notifications".
- **Send states**: optimistic insert → `sending` (subtle) → `sent` (nothing) → `failed` (red icon
  + Retry inline, never silently dropped). No read receipts in v2.
- Typing: throttle 1/s, expire 10s, clear on send. Presence: binary active/away + independent DND.

## 6. Reconciliation with the in-repo best-practices docs

`docs/React-Ts-Best-Practices.md` + `docs/Typescript-Best-Practices.md` (generic community
guides, pre-App-Router era):
- **Keep**: naming discipline (booleans `is/has`, UPPER_SNAKE constants), single-purpose files,
  no dumping-ground folders (`misc/`, `helpers/`), import grouping, "explicitness over
  cleverness".
- **Superseded by current practice**: the `Colors.ts` TS-token pattern (spawned the dead
  `styles/colors.ts`) — tokens live in CSS `@theme` now; the CRA `pages/`-mirroring structure —
  App Router + features/ per official docs and bulletproof-react; per-component `index.tsx`
  barrels — current guidance avoids barrels (tree-shaking, build perf, and our import-boundary
  lint works better without them); MUI-era snippets.
- The `I`-prefix interface / `T`-prefix type convention is already the codebase's style — keep for
  consistency (types/ carries it throughout).

## 7. Foundation decision log (what the research settled)

| Decision | Choice | Why |
|---|---|---|
| Switch layer | `proxy.ts` + cookie `NextResponse.rewrite` | middleware.ts deprecated; official strangler pattern |
| v2 rendering | `cacheComponents: true`, Suspense-or-cache | only PPR path; future default; build-time discipline |
| Auth enforcement | server-only DAL, proxy optimistic-only | official guidance + CVE-2025-29927 lesson |
| Query layer | queryOptions factories + tier table + global MutationCache | TkDodo/TanStack canon |
| Primitives | Radix (pin `-b radix`) | mature; Base UI switch is optional, not urgent |
| Virtualizer | ~~@tanstack/react-virtual ≥3.16~~ native `content-visibility` (July 19 correction — the named version/APIs never shipped; latest is 3.14.6) | streaming-safe, zero deps |
| Drawer | vaul | de-facto standard, Radix-based |
| Streaming markdown | Streamdown | purpose-built for token streams |
| Motion lib | tw-animate-css + `motion` at leaves | CSS-first; RSC-clean |
| Service worker | Serwist | maintained next-pwa successor |
| Tailwind lint | eslint-plugin-better-tailwindcss | v4-aware token enforcement |
| Shimmer | rotor/translate rebuild, gated + reserved | compositor-only, identical look |
| Fonts | Fraunces display+serif roles, UI sans body, Comfortaa brand-only | roles not decoration; WONK 0 for professional |
| Loading | §8 — skeletons only for data; `loading.tsx` = inert outer shape | owner: "those parts of the screen should just appear immediately" |

## 8. The loading convention (binding on every v2 page)

Written after the owner rejected the home's loading experience: *"the home skeleton is
always the same even when its landing on either of the 3 tabs and none of the design of the
tab match the skeleton… i also notice the skeleton is of the textarea and im not sure why
that should have a loading skeleton… those part of the screens should just appear
immediately."* He was right on both counts, and the two failures generalise. These four
rules and the corollary are the fix, and they apply to every screen we build from here.

**Reference implementation: `app/v2/conversations/loading.tsx`** (static reserved search
field + real list skeleton, `aria-hidden` + `inert`, one `role="status"`). The home's
equivalent — `app/v2/loading.tsx` → `v2/shell/designs/HomeFallback.tsx` — shows the same
rules applied to a surface with three different destination layouts.

### (i) Anything we already have renders immediately, and never gets a skeleton

A skeleton is a promise that data is coming. Static chrome — a textarea, a placeholder
string, a send button, fixed suggested prompts, a nav row, a search field, a section title
— has nothing coming. Skeletoning it is a lie that also delays the UI. Render it for real,
on the first frame. Polaris states the rule outright: *"Show static content that never
changes on a page and use skeleton loading for dynamic content."*

The corollary for placement: static chrome that must survive a route transition belongs in
`layout.tsx`, which `loading.tsx` explicitly does **not** wrap.

Before adding a skeleton, answer *"what request is this waiting on?"* If there isn't one,
it gets a **reserved shape** at the real geometry — quiet, still, and **never pulsing** —
or it gets rendered outright. A pulse is reserved for a real in-flight read.

**Scope limit: that rule is about static chrome, not about which boundary you are inside.**
A route-level `loading.tsx` fallback IS waiting on a request, the RSC payload, so it pulses
like anything else that is waiting. Every skeleton that represents a wait gets ONE
appearance, whichever boundary happens to draw it.

This closes a rule we shipped and have now removed. v2 carried a `still?: boolean` prop that
dropped the pulse in route fallbacks, reasoning that a fallback "waits on an RSC payload, not
a query" and therefore had no request behind it. It cited this section as its authority,
which this section never said. Two things were wrong with it. The premise was wrong, because
an RSC payload is a request. And the effect was worse than the premise: the fallback and the
live screen draw the same shape, so a reader saw that shape hold perfectly still for seconds
and then watched every bar on it start shimmering in a single frame at the hand-off.
Measured on a channel at 390px on a throttled connection: 29 visible skeletons with 0
animating while the boundary held, then 26 visible with 26 animating one frame later. The
owner read it as the page loading twice, and he was right to. The distinction was invisible
plumbing. No reader can tell "waiting for the route" from "waiting for the data", so printing
the difference on screen bought nothing and cost a seam in the middle of every load.
**Do not reintroduce a still variant for boundary skeletons.**

### (ii) `loading.tsx` holds the page's real outer SHAPE, and nothing interactive

Next compiles `loading.tsx` into the `fallback` of a `<Suspense>` around `page.tsx`
(verified in `next/dist/client/components/layout-router.js`). It takes **no props** — not
`params`, not `searchParams` (`create-component-tree.js` passes only a `key`).

- **It must draw the destination's actual frame** — same max-width, padding, anchoring,
  breakpoint `order`, and grid — or the hand-off is a layout swap, not content resolving.
  Next's own streaming guide: *"Design skeleton fallbacks that match the dimensions of the
  content they represent… use fixed or `min-height` containers so the space is reserved."*
  Share the frame with the real surface (see `v2/shell/designs/home-frame.ts`) instead of
  redrawing it; a hand-drawn fallback diverges within two design rounds.
- **It must be inert.** When content resolves, the fallback fiber is a *sibling* of the
  content fiber and is pushed to `deletions` with `ChildDeletion` — a full unmount. DOM
  nodes are removed, state is discarded, and focus drops to `<body>`. React's own caveat:
  *"React does not preserve any state for renders that got suspended before they were able
  to mount for the first time."* So a focusable control in a fallback destroys focus, caret
  and in-flight typing the moment the payload lands. On a hard load it is worse: the
  streamed HTML is swapped by an inline script that can run *before* hydration, so the
  control may never have been interactive at all. Mark the fallback `aria-hidden` **and**
  `inert`.
- **Accessibility**: decorative shapes are `aria-hidden`; exactly **one** visually-hidden
  `role="status"` node per boundary carries the announcement. Never `aria-live` per skeleton
  bar. Skeleton shapes are never keyboard-focusable (`inert` guarantees it).
- **It may be a Client Component** (`'use client'`, or a server shell rendering a client
  child — the repo convention). This is what lets a fallback read client-only state. Know
  which render you get: on a **hard load** it is part of the streamed static shell and runs
  on the **server** (`useSyncExternalStore` → `getServerSnapshot`); on a **soft navigation**
  no HTML is transferred and React renders it in the **browser** (`getSnapshot`, real
  `localStorage`). Design it to be correct under both, and say which you rely on.
- **Do not assume it paints.** Today `loading.tsx` forces deferral of everything beneath it,
  so it always shows on navigation. Under `cacheComponents` (§1.5) it becomes an ordinary
  Suspense boundary and a cached static page can go straight to content. Separately, React
  19.2 throttles reveals to ~300ms, so a boundary that resolves in 50ms may still be on
  screen for ~300ms — which is exactly why the geometry has to be right.

### (iii) Never `await` in a page body for data only part of the page needs

One `await` at the top of a `page.tsx` blocks the whole route on the slowest read, and a
high `loading.tsx` then replaces the entire screen with a full-page skeleton. Push the await
down into the child that needs it and wrap **that child** in `<Suspense>` with a fallback
sized to that region. Next: *"Prefer explicit `<Suspense>` boundaries close to the dynamic
access… now the entire page falls back to a full-page skeleton instead of streaming
granularly."* Keep LCP elements outside/above boundaries so they ship in the static shell.

Note the layout interaction: if a **layout** reads runtime data (`cookies()`, `headers()`,
an uncached fetch), `loading.js` shows no fallback for it — navigation simply blocks until
the layout finishes. Runtime reads in a layout need their own `<Suspense>`.

### (iv) Every client query region owns three explicit states

A region backed by a query renders exactly one of:

1. **Pending** — a skeleton at the region's *real* geometry, reserved at a realistic
   **median** length. Not at the row cap: a list that clamps with `.slice(0, MAX)` can
   never resolve longer than the cap, so cap-sized skeletons defend against a shift that
   cannot happen while making the one that does — collapsing onto a short or empty list —
   far worse. Reserve near the middle, absorb a small settle either way, never a large one.
   `v2/shell/designs/modules/` is the house pattern (`ModuleSkeleton` mirrors `ModuleRow`
   exactly and owns the single reservation number; no module overrides it).
2. **Error** — visually distinct from empty (never error-as-empty), naming what failed and
   offering a real in-place retry (`refetch`).
3. **Empty** — a *designed* state: quiet icon, one sentence, and an action where one exists.
   Never `return null`. A module that vanishes after occupying a skeleton yanks everything
   below it upward — the exact defect `JumpBackInModule` shipped with.

All three states **cross-fade in** (`CONTENT_FADE`), `motion-reduce`-guarded — the error and
empty states too, not just the list. A true cross-fade *across a Suspense boundary* is
impossible (fallback and content never coexist in the DOM), so animate the *content's*
entrance and let matched dimensions do the rest.

**Entrance rule — a block the fallback pre-draws gets NO entrance.** `REVEAL` is
`fill-mode-both` over a `from`-only enter keyframe, so it holds its block fully invisible
for the whole `animationDelay` before fading up. On a block a `loading.tsx` already painted
that reads as a BLANK-then-fade at the hand-off (measured at up to ~740ms on the Work tab's
old 80/160/240ms stagger). Entrances belong only on blocks the fallback does not draw —
role-gated modules, client-resolved content.

**Pulse discipline** — a skeleton must not animate under `prefers-reduced-motion`, and must
not pulse past 5s (WCAG 2.2.2 Pause, Stop, Hide); a long wait settles to a still
placeholder. **CLOSED:** `components/ui/skeleton.tsx` now carries the guard itself, as
`animate-pulse motion-reduce:animate-none`, so every caller of the primitive is covered in
v1 and v2 alike and needs no local guard.

This used to be delegated to `v2/shell/shell.css`, which still carries
`@media (prefers-reduced-motion: reduce) { html.v2-document-lock .animate-pulse { animation: none } }`
as belt and braces for hand-rolled bars that never call the primitive. That rule ALONE is not
enough, and the reason is worth keeping. It keys off a class `DocumentLock` adds inside an
effect, so it cannot apply until hydration, and on a hard navigation a route fallback is on
screen for the whole time before hydration. While fallbacks were held still, that gap was
invisible. Now that they pulse, it would shimmer at a reduced-motion reader for the entire
initial load, so the guard has to be plain CSS sitting on the primitive.

Use `motion-reduce:animate-none`, never `motion-safe:animate-pulse`. `cn` runs tailwind-merge,
which drops an earlier `animate-pulse` when a caller passes its own `animate-*` class. A
`motion-safe:`-prefixed pulse sits in a DIFFERENT merge group, so it would survive a caller's
override and leave raw stylesheet order to pick the winner, silently. The chosen form is also
purely additive for v1: it changes the emitted class string but cannot alter v1's rendering
for any reader who has not asked for reduced motion.

### Corollary: never render a skeleton over content already in cache

If the data is in the query cache, render it. A skeleton that replaces content the user
just saw is a regression, not a loading state — it is the "flash of skeleton" that makes an
app feel slower than it is. Use `keepPreviousData` for filter/search transitions (dim the
existing list, keep it), gate the skeleton on `isPending` (never on `isFetching`), and let
background refetches be invisible.
