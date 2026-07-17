# Lawexa Frontend — Architecture & Design Audit (July 2026)

Purpose: a shared map of the current app so we can plan the overhaul at a high level while keeping
the deep system detail written down. Produced from a full-codebase analysis (8 parallel deep scans:
routing/navigation, data & caching, state/auth, loading/perf/UI, feature inventory, visual design
system incl. typography & motion, mobile/responsive, notifications UX, optimistic-update patterns).

Part 1 = system architecture. Part 2 = design & experience (visual language, typography, motion,
mobile, notifications, interaction feedback).

Scale snapshot: ~170 pages, ~811 `.tsx` files (~81% `"use client"`), 54 API modules, 74 hooks,
50 type files, 15 Zustand stores, 316 admin component files.

---

## 1. The mental model — two axes

The app is best understood as **vertical product slices** sitting on **horizontal platform layers**.
The slices are mostly healthy; almost every systemic problem lives in the horizontal layers.

### Vertical slices (the product domains)

Every domain follows the same consistent pattern (this consistency is the codebase's biggest asset):

```
app/<route>/page.tsx  →  lib/hooks/use<Domain>.ts  →  lib/api/<domain>.ts  →  types/<domain>.ts
                          (TanStack Query)             (axios)
components/<domain>/   (feature components, usually with index.ts barrel)
```

### Horizontal layers (the platform)

| Layer | What it is | Health |
|---|---|---|
| **Shell & navigation** | `(main)`/`(admin)` layouts, sidebars, breadcrumbs, guards | 🔴 Most fragmented layer |
| **Identity & lifecycle** | authStore, guest auth (fingerprint), onboarding, plan/limits | 🟡 Works, duplicated state |
| **Data & caching** | axios client + React Query, per-domain hooks | 🟡 Solid pattern, half-tuned config |
| **Realtime** | SSE chat stream, Laravel Echo (collab), FCM push, polling (notifications) | 🟡 Three separate systems |
| **Client state** | 15 Zustand stores + ~10 ad-hoc storage keys + 1 IndexedDB store | 🟡 Sprawl, some dead |
| **Design system** | shadcn/Radix primitives + oklch tokens in globals.css | 🟡 Good base, real drift |
| **Rendering strategy** | Client-only SPA inside Next.js; zero SSR data, zero route boundaries | 🔴 Root cause of "feels slow" |

---

## 2. Product map (what exists, in plain language)

| # | Domain | What it does | Where | Maturity |
|---|---|---|---|---|
| 1 | **AI Chat** — the core product | Home composer → `/c/[id]` streaming conversation. Lite/Expert agents, tool calls, file upload, jurisdiction, confidential & redacted modes, study mode | `components/chat` (28), `useChatStream` (1,725 lines), `conversation-client.tsx` (1,470 lines), `types/chat.ts` | Polished (most engineered) |
| 2 | **Cases** | Searchable case-law DB, detail + full report, reader mode, view limits, principles, related cases | `components/cases` (26), `useCases` | Polished |
| 3 | **Statutes** | Legislation DB with country tabs; **mid-migration**: v1 list components + v2 AKN document renderer + dead `statutes-old` route | `components/statutes` + `statutes-v2` | Functional, mid-migration |
| 4 | **Notes** | TipTap editor, case @-mentions, publish + pricing; **marketplace half-built** (purchases = "Coming Soon", no purchase API) | `components/notes` (25) | Editor polished, market half-done |
| 5 | **Quiz** | Player, history, stats, results; embedded in chat; admin generation pipeline | `components/quiz` (26) | Polished/functional |
| 6 | **Radars** | Scheduled AI watch agents over entities (cases/statutes/courts/judges); scan reports + triage; debits messages | `components/radar` (23) | Functional, new |
| 7 | **Collab (Spaces/Channels/Orgs)** | Slack-like: orgs → spaces → channels → realtime messages, task lists, file library, in-channel Lawexa AI | `components/collab` (42), `lib/api/collab.ts` (772 lines) | Functional, actively built |
| 8 | **Files & Folders** | Personal storage; folders aggregate cases/notes/files cross-domain | `components/files`, `components/folders` | Functional |
| 9 | **Content requests** | Users request missing content; admin fulfils | `components/content-requests` | Functional |
| 10 | **Lawyer verification + connect** | Credential verification flow; connect requests surfaced inside chat | `components/verification`, chat lawyer-card | Functional |
| 11 | **Monetization** | Subscriptions, trials, PAYG message packs, multi-currency (geo), Paystack (+Flutterwave); `IBlockedReason`/`IUserLimits` threaded through chat/radar/collab | `subscriptions`, `payg`, `message-packs` | Polished, revenue-critical |
| 12 | **Notifications** | In-app center + FCM push (closed app) + Echo realtime (open app) + 60s polling for badge | `components/notifications` | Functional |
| 13 | **Onboarding** | 8-step resumable wizard (+6b branch), per-step server save | `app/(onboarding)` | Functional |
| 14 | **Community/Trending/Activity** | Shared conversations feed, trending cases/notes, own message history | `components/trending`, `/shared` | Functional |
| 15 | **Ambassador** | Static HTML landing (488KB `ambassador.html`) + in-app popup; admin review | `components/ambassador` | Half-built (user side) |
| 16 | **Admin panel** | ~27 sections; effectively a **second app** with its own 316 components, own sidebar, own types layer (`types/admin*.ts`, incl. a 1,455-line god-file) | `app/(admin)`, `components/admin` | Extensive |
| 17 | **Stubs** | Settings Account/Privacy/API tabs ("Coming Soon"), Courses (admin-only) | — | Half-done |

### How domains connect

- **Chat is the hub.** It renders cases, statutes, notes, radars; embeds quizzes; surfaces lawyer
  connect; imports folder buttons; consumes monetization limits; and even imports the **admin** AI
  workflow API for its agent selector (a user→admin coupling).
- **Monetization threads everywhere**: `types/message-pack.ts` owns `IBlockedReason`/`IUserLimits`,
  imported by chat, radar, collab.
- **Accidental shared primitives**: `types/case.ts` is the canonical home of
  `PaginationMeta`/`PaginationLinks`, imported app-wide — pagination lives in the "case" domain by
  historical accident.
- **Realtime is split three ways**: SSE (chat), Echo/Reverb (collab only), FCM push + 60s polling
  (notifications). Only collab writes realtime events into the React Query cache.

---

## 3. The systemic problems (ranked by user-perceived impact)

### P1 — The app is a client-only SPA wearing Next.js clothes → "feels slow"

- **146/170 pages are `"use client"` directly, and ~162/170 are effectively client-rendered**
  (verified — only ~8 pages are genuinely server-only: legal pages, 2 coming-soon stubs, 4 redirect
  stubs); **nothing** is server-rendered with data. Server work is limited to SEO metadata for 2
  routes + OG images.
- **Zero `loading.tsx`, `error.tsx`, `not-found.tsx`, and no `middleware.ts` in the entire app.**
  No route-level streaming, no custom 404/500, no server-side auth.
- Every cold load: blank → hydrate → read localStorage token → axios call → render. First paint is
  always a skeleton; hard reloads are always fully cold (React Query cache is never persisted).
- `app/(main)/layout.tsx` is itself a client component gated behind a `mounted` flag that renders a
  generic `LayoutSkeleton` on every first paint (workaround for Radix ID hydration mismatch).

### P2 — Skeleton stacking (the "double skeletons") + 5 loading vocabularies

The stacking mechanism, confirmed on `/cases`, `/notifications`, `/folders`, `/quiz/play`:

1. Layout `mounted`-gate skeleton (`LayoutSkeleton`), then
2. per-page `<Suspense>` fallback skeleton (wrappers exist only to satisfy `useSearchParams`), then
3. the **same** skeleton again from the hook's `isLoading`, then content.

Gated routes add a 4th layer (guard skeletons in `AdminGuard`/`QuizGuard`/`SpacesGuard`).
Verified extreme: `/quiz/play` stacks **three** (page Suspense fallback + no-session guard +
`QuizPlayer`'s own `isLoading` skeleton).

- **~30+ skeleton implementations**: 17 dedicated `*Skeleton*` files + ~14 inline `animate-pulse`
  variants (166 uses across 31 files). No shared shape contract.
- ~5 distinct loading patterns (matched skeleton / generic bars / opacity-pulse / spinner /
  skeleton→spinner two-phase). Chat shows 3 sequential spinners, no skeleton.
- Inconsistent gates: folders uses `isFetching` (flashes skeleton on every background refetch);
  others use `isLoading`; statute detail visibly layout-shifts (skeleton → header → spinner → body).

### P3 — Navigation is 4 systems + 1 dead one, no single source of truth

- **Live**: `AppSidebar` (hardcoded `navMain` + separate `GUEST_RESTRICTED_URLS` set),
  `AdminSidebar` (9 separately hardcoded section files), `SettingsSidebarNav` (own list),
  `NotesNavTabs`. **Dead**: entire `components/layout/Sidebar/` + `MobileNav` + `Header` (points to
  a `/dashboard` route that doesn't exist).
- **Three different active-state rules**: main sidebar uses exact `pathname === url` (so
  `/cases/[slug]` never highlights "Cases"), admin/settings use `startsWith`, each with different
  highlight styles. `nav-main.tsx:54` computes a `startsWith` `isActive` and then ignores it.
- **Breadcrumbs**: auto-derived from URL segments + a Zustand override store — but only admin pages
  set overrides. The highest-traffic pages (cases/notes/statutes detail) show raw slugs
  ("Donoghue-v-stevenson-1932").
- **Full page reloads on internal routes**: `content-requests/[uuid]` empty-state, onboarding
  completion (3 sites: `(onboarding)/layout.tsx`, `useOnboarding.ts:95,106`,
  `useOnboardingStepSave.ts:18`), admin sponsor→campaign link, and the axios 401 handler
  (`window.location.href`).
- Route protection is 100% client-side `useEffect` redirects — content can flash before bounce, and
  unauth users land inconsistently (content pages allow guests; admin/quiz/spaces bounce to `/`,
  never `/login`).

### P4 — Caching is half-tuned; chat lives outside the cache entirely

- Global React Query config is 3 lines: `staleTime: 60s, retry: 1`. `refetchOnWindowFocus` left ON
  everywhere → tab-refocus refetch storms. `gcTime` default 5 min → back-navigation after >5 min
  loses infinite-scroll data + scroll position. No cache persistence across reloads.
- **Chat state is manual `useState` + `EventSource`** — completely outside React Query. Finishing
  or renaming a chat never invalidates the conversations list; the sidebar goes stale until its own
  2-minute staleness.
- Two shadow caches bypass RQ: `useCaseMentionTooltips` (module-level Map, 5-min TTL) and
  `useGuestAuth` (module promise).
- No central query-key factory: ~20 per-file `xxxKeys` objects; bookmark toggle hand-patches **five**
  cache families; some keys built by hand instead of via their own factory; duplicate hook name
  `useCases` exported from two files.
- Two pagination paradigms (infinite scroll for content, URL-page for notifications/admin) with
  different back-nav behavior. Notifications badge is 60s polling, not realtime.
- axios has **no timeout** and no 5xx retry; logout `queryClient.clear()` guarantees a cold next
  session.

### P5 — Identity state is duplicated and hydration-fragile

- The user exists in **two sources of truth**: persisted `authStore` (localStorage, incl. raw
  bearer token — JS-readable, not httpOnly) AND React Query `['auth','me']`; `useAuth` returns
  `currentUser || user`. Derived flags (`isGuest`, `onboardingComplete`) can drift from the server.
- Onboarding progress also has two sources (persisted store + server), merged in the layout.
- **Three different "wait for hydration" implementations** across guards; `OnboardingGuard` doesn't
  wait at all (decides on pre-hydration state); `AdminGuard` has **no hydration wait either** and
  can bounce a real admin on a cold refresh (its gate query is disabled until the store rehydrates,
  so `isLoading` is false while `user` is still empty).
- Onboarding completion deliberately uses `window.location.href='/'` (hard reload) to beat its own
  step-guard race — a documented workaround.
- ~10 ad-hoc localStorage/sessionStorage keys outside the store layer (drafts, jurisdiction,
  attribution, device id, payg reference…), no registry, inconsistent local vs session choices.
- Debug noise ships to prod: `console.log`/`console.trace` in `authStore` and `OnboardingGuard`.

### P6 — Render performance details

- **Chat, the core surface, is the jankiest**: `conversation-client.tsx` (1,470 lines) re-renders
  the entire non-virtualized message list on every streamed token AND every second (an `elapsed`
  interval), and provides an unmemoized context value (`{sendMessage, isStreaming}` recreated each
  render) to all message cards.
- **No list virtualization anywhere** (chat, channels, all data lists).
- **Exactly one dynamic import in the app** (`LawexaGlancePanel`). TipTap (10 pkgs), recharts,
  dnd-kit, embla, react-markdown/remark/tippy are all statically imported into their routes.
- `ReactQueryDevtools` is statically imported and rendered in the production `QueryProvider`.
- `next/image` used in 2 files; raw `<img>` (no dimensions → CLS) in 12, including avatars/cards.

### P7 — Design-system drift and dead code

- Good base: 35 shadcn primitives + a full oklch token system (gold `--primary`, sidebar, charts,
  radius scale) in `globals.css`.
- Drift: **151 hardcoded `amber-*`/hex uses across 70 files** instead of tokens; hand-rolled
  `<button>`s in chat actions; `hsl(var(--popover))` applied to oklch-defined variables in
  tippy/case-preview CSS (invalid color); document CSS hardcodes radii.
- Dead: `styles/colors.ts` (orphaned second palette), `themeStore` (persisted but never read;
  next-themes is the real source), legacy nav trio, `example.tsx` + `component-example.tsx`,
  `statutes-old/[slug]` (live but unlinked), no-op `notes/layout.tsx`, unused `AdminNavMain`,
  `settings/general` orphan redirect, root-level debris (`conv.json`, `res*.txt`,
  `bash.exe.stackdump`, 488KB `ambassador.html`).

---

## 4. What this means for the overhaul

**Keep (high reuse value):**
- The vertical-slice contract layer: `lib/api/*` (54 modules), `types/*`, and most React Query
  hooks encode the entire backend contract and hard-won domain logic. This is the asset.
- `useChatStream`'s SSE resilience logic (watchdog, reconnect, polling fallback, event taxonomy) —
  the *engine* is good even if the *rendering* around it must change.
- The oklch token system + shadcn primitive set as the design-system base.
- Realtime cache-writer pattern in collab (Echo events writing into RQ cache via shared helpers) —
  the best-integrated realtime code in the app; a model for the rest.

**Rebuild (the experience layer — where all 7 problem clusters live):**
1. **Rendering strategy**: server-render shells + route-level `loading.tsx`/`error.tsx`; decide
   auth-at-the-edge (middleware/cookies) so pages stop booting blind.
2. **One navigation system**: single nav config (items, roles, guest rules, active-state rule)
   consumed by every sidebar/tab/breadcrumb; title resolution for detail breadcrumbs.
3. **One loading vocabulary**: per-domain skeleton derived from one shape contract, exactly one
   skeleton layer per navigation, standard gates (`isPending` for first load, quiet background
   refetch).
4. **Tuned, unified data layer**: central query-key factory, deliberate staleTime/gcTime tiers,
   focus-refetch policy, chat integrated with the conversation cache, realtime writers everywhere.
5. **Single identity source**: server-verified session, one user object, one hydration gate.
6. **Perf hygiene**: virtualized long lists, memoized chat rows, dynamic imports for heavy libs,
   devtools out of prod.
7. **Token enforcement + dead-code purge.**

**Sequencing reality check:** because the domain layer is cleanly separated from the experience
layer, an overhaul can be a *new shell around existing organs* — rebuilt app chrome, routing,
loading, and caching policy, while `lib/api` + `types` + most hooks port over nearly unchanged.
That is much cheaper than a rewrite and directly targets everything that feels broken.

---
---

# PART 2 — Design & Experience Audit

## 5. The current design language (and what to keep)

**In one paragraph:** a neutral-gray canvas with a single gold accent. The entire palette is
achromatic oklch except gold at hue 82 (`--primary`, `--ring`, `--accent`, the chart ramp, text
selection) and red for destructive. Shape leans soft/pill: shadcn primitives are `rounded-4xl`
(near-pill), cards are `rounded-2xl` with a hairline ring and **no shadow** (flat, ring-based
elevation). Body text is the **OS system font** — the brand fonts barely render anywhere. Motion is
entrance-fade heavy with no timing discipline. The signature element is the **liquid-gold animated
border** on the prompt composer.

### Preserve-exactly list (the brand DNA to carry into the redesign)

- **The gold token**: `--primary: oklch(0.58 0.14 82)` light / `oklch(0.70 0.14 82)` dark.
- **The brand hex** `#C9A227` (PWA theme-color in `app/layout.tsx:51`, `app/manifest.ts:23`, OG route).
- **The liquid-gold shimmer** — `app/globals.css` lines 296–358: an oversized linear gradient
  (`background-size: 800% 800%`) whose `background-position` wanders via `@keyframes gradient-rotate`,
  applied as a 1px padding frame around the composer (`gold-shimmer p-[1px]` wrapping a
  `bg-background` inner card) in `components/ui/prompt-input.tsx:106` (+ the floating composer).
  Variants: `.gold-shimmer` 25s, `:focus-within` 45s (whiter stops), `-bg` 20s fill, `-text` 8s
  text-clip. Gold textarea text via `text-primary`. Note for the rebuild: it animates
  `background-position` (paint-layer, not compositor) and the four variants have four unrelated durations.

## 6. Design-system problems (ranked)

### D1 — Typography is unanchored ("the font is very inconsistent")

- `--font-sans` maps to the **system font stack** — Comfortaa and Fraunces are loaded as CSS
  variables but have **zero utility-class usages**. Comfortaa reaches the screen via one inline
  style on the home wrapper (`app/(main)/page.tsx:509`); Fraunces only inside the `.note-*`
  editorial CSS. Case/statute documents hardcode a fourth stack (Georgia).
- **Four disjoint type worlds** (system-sans UI / Comfortaa home / Fraunces notes / Georgia
  documents) plus **effectively six prose/document typography systems** (hand-rolled `.prose` in
  globals.css, the `@tailwindcss/typography` plugin — both live and both applying to different
  surfaces — plus `.note-prose`/`.note-editorial-*`, `.case-document`, `.statute-document`).
- **≥8 different size×weight×family formulas for "a title"** (home `text-[26px]/[36px] font-medium`,
  CardTitle `text-base font-medium`, EmptyState `text-lg font-semibold`, list cards `text-[20px]`,
  NotificationItem `text-sm font-semibold`, note title `clamp()` Fraunces…).
- **~174 arbitrary `text-[Npx]`** (103× `text-[10px]`, 34× `text-[11px]`); three emphasis weights
  in rotation; tracking/leading ad-hoc per author.

### D2 — Radius sprawl (the rounded-corner complaint)

~1,364 radius utilities across **9+ distinct radii** (plus directional variants). Token scale
exists (`--radius: 0.45rem` + derived) but: bare `rounded` (164×) resolves to Tailwind's inlined
default 4px — **verified off the token scale** (no `--radius-DEFAULT` is defined in `@theme`, and
there is no tailwind.config to remap it; the `:root --radius` is never read by the bare utility);
`Input` is `rounded-4xl` while `Textarea` is `rounded-xl`; the composer is a third value
(`rounded-3xl`); "a card" ships in four verified treatments — shadcn Card + PlanCard `2xl`,
SpaceCard/List/Radar/File cards `xl`, Case/Note/Conversation/Statute rows no radius at all (with
bare `rounded` on their inner badges), collab MessageRow bare `rounded`/`rounded-md`.

### D3 — Four parallel golds (verified counts)

The same accent exists as (1) the oklch `--primary` token, (2) **263 hardcoded `amber-*` uses in
59 files** (banners, badges, plan sections — most pair `dark:` variants so they don't break, but
they drift from the token), (3) the raw hex `#C9A227` in **6 files** (layout, manifest.ts,
site.webmanifest, OG route, seo.ts, dead colors.ts), and (4) the `--chart-1..5` ramp — five
hand-picked oklch golds unrelated to `--primary`. Reader mode re-declares the entire token set a
**third time** (`[data-reader-mode="true"]`, globals.css 481–500) — another drift surface.
Light/dark drift proper is small but concentrated: 9× `text-white`, 8× `bg-black`, ~18 `neutral-*`
in 11 files with no `dark:` pairing; `--primary-foreground` and `--destructive` also use different
hues between light and dark modes.

### D4 — Motion has no system ("animation is a mess")

- No animation library; tw-animate-css + 5 custom keyframes + Tailwind built-ins + Radix
  data-state animations, each surface picking its own timing: hover `duration-200`, entrances
  `duration-300`, dialogs `duration-100`, shimmer 8/20/25/45s. No shared duration/easing token.
- **Same interaction, different motion**: collab `MessageRow` animates in and spaces/channels get a
  300ms `RouteTransition` fade — every other list and route in the app snaps. `AnimatedTabs`
  coexists with plain tabs.
- **Dead motion (verified)**: 4 files reference `animate-collapse-up/down` with **no matching
  keyframes** — tw-animate-css ships `collapsible-up/down` (different name), so these classes emit
  nothing and the collapses snap (chat quiz-card, tool-step-item, conversation-client, admin).
- `floating-prompt-input.tsx:743` animates `left` (layout property — jank); reduced-motion is
  guarded only in a few CSS blocks + quiz components.
- Elevation is undefined per surface: cards are flat+ring, shadowed, or border-only by domain
  (~61 shadow uses, 8 different values).

### D5 — Component-level drift

- The "list card/row" concept has **five different treatments** (padding, radius, border, type
  scale) across Case/Note/Conversation rows, NotificationItem, collab MessageRow, Space/List/
  Radar/File cards, and shadcn Card.
- Icon sizing written three ways (`size-*` ~215×, `h-4` alone 1,028×, button auto-sizing).
- A shared `EmptyState` exists (63 uses across 44 files) and is better adopted than first thought —
  the conversation and note empty states wrap it; only chat's `confidential-empty-state` hand-rolls
  its own.
- Suggested-prompt chips use different radius+padding per breakpoint (`rounded-2xl` mobile,
  `rounded-full` desktop).

## 7. Mobile / responsive ("mess on mobile, especially top navigation")

Ranked by what a phone user feels:

1. **The keyboard covers the chat input.** Conversation composer is `fixed bottom-4`
   (`conversation-client.tsx:1278`) and the channel composer `absolute bottom-0`
   (`ChannelConversation.tsx:545`), with `100vh`-based heights and no `dvh`/`visualViewport`
   handling — the OS keyboard overlays the input while typing.
2. **Zero safe-area/notch handling** despite being an installable PWA: no `viewport-fit=cover`, no
   `env(safe-area-inset-*)` anywhere; bottom elements sit over the iOS home indicator.
3. **Hover-only actions are unreachable on touch**: assistant message actions (copy/thumbs,
   `conversation-client.tsx:1028`) and collab edit/delete (`MessageRow.tsx:153`) are
   `group-hover`-gated with no tap fallback (verified: zero touch/long-press/context-menu handlers
   in the codebase). Worse: the chat copy/thumbs-up/down buttons have **no `onClick` at all** —
   they are non-functional placeholders.
4. **Composers capped at 320px** (`max-w-xs sm:max-w-md`) — artificially narrow on modern phones.
   A third composer (`floating-prompt-input.tsx:740`, `fixed bottom-4`) shares the keyboard problem.
5. **24 of 32 form dialogs have no max-height/scroll** (corrected count — the base `DialogContent`
   is centered with no `overflow-y-auto`; 8 consumers add their own); form dialogs clip when the
   keyboard opens. No drawer/bottom-sheet primitive exists (Sheet `side="bottom"` used in 3 places).
6. **Top nav**: `UpgradePill` is *absolutely centered over* the header flex row and can collide
   with both clusters; mobile breadcrumbs hide everything after the first segment, so the current
   page is never shown; up to 3 icon controls + hamburger compete in 64px.
7. **Single-hamburger navigation** — no bottom tab bar; all primary nav is behind one top-left button.
8. **`100vh` not `dvh`** on chat surfaces and all auth/onboarding pages (browser-chrome shift);
   tables scroll or squeeze rather than reflow (Activity table `table-fixed` crushes its message
   column; the AKN statute table has no scroll wrapper).
9. **Touch targets 28–32px** (below ~44px guideline) across header icons, message actions, TipTap
   toolbar; TipTap link insertion uses `window.prompt`.
10. Two manifests declared (`metadata.manifest` → `/site.webmanifest` vs generated
    `/manifest.webmanifest`).

## 8. Notifications ("notifications suck, especially spaces/channels")

Five mechanisms that barely talk to each other: REST center + 60s polling, Echo realtime, FCM push,
browser Notification API, and a sound util. The disconnects:

1. **Messages outside the open channel are invisible.** The realtime socket
   (`useChannelRealtime`) runs only for the channel being viewed; the app-wide listener
   (`RealtimeNotifications.tsx`) reacts only to backend notification events and does exactly one
   thing — invalidate the notification queries. No toast, no sound, no badge bump anywhere.
2. **Unread badges exist but aren't live.** `ChannelRow` renders `unread_count`, but nothing pushes
   it — it refreshes only when the channel list refetches. No space-level rollup, no sidebar
   indicator, no title-bar/favicon badge.
3. **Push is fully built client-side** (registration, service worker, deep-link handling all
   verified functional). Whether the backend actually sends event pushes is **unverifiable from
   frontend code** — `docs/backend-push-notifications.md` says the send side is broken, but that
   doc must be re-confirmed with the backend team, not trusted.
4. **Sound & browser notifications never fire for collab** — `browserNotify()` is called only from
   the AI chat client (2 call sites). The Settings sound toggle has zero effect on channels.
5. **`notify_level` (all/mentions_only/muted) is inert client-side** — saved and displayed, never
   read to gate any behavior (verified: zero reads outside the settings select and cache write).
6. **Message deep-links are dead**: no collab component reads any message-anchor search param
   (the `?m={messageUuid}` format itself is backend-defined and unverifiable from frontend code) —
   a mention notification lands at the newest message, no scroll-to/highlight. Mentions of *you*
   aren't styled differently from any other mention.
   Precision (verified): channel **mentions** DO create notification records the bell renders and
   counts — it's regular non-mention messages that never surface anywhere.
7. Missing vs a Slack-like baseline: unread divider line, jump-pill with count, mention counters,
   read receipts, notification grouping, foreground toast. (Typing indicators exist; opening a
   channel does mark it read — though with no focus guard.)

## 9. Interaction feedback — optimistic updates are uneven by domain

Of ~51 user-facing mutations: **12 optimistic+rollback** (bookmarks, collab messages/lists/files,
radar triage), **12 pessimistic-patch** (no refetch lag — quiz answer, note save/publish, radar
create/edit, profile), **~20 pessimistic-invalidate** (click → wait → refetch → update: folders,
notifications, conversation sharing, note create/delete, members, subscriptions, content requests),
**2 local-state-only** (chat send — never updates the conversations list), **3 nothing** (feedback
submit, onboarding step save, message-pack init).

Worst felt offenders:

- **Notification mark-as-read**: no optimistic update, no pending state, no error toast — the
  single most dead-feeling click in the app.
- **Add-to-folder / create folder**: nothing visible until the refetch lands; failures invisible.
- **Optimistic-with-silent-rollback at the hook layer** (collab edit/delete, list checks/reorders,
  triage): the hooks roll back with no toast. Verified correction: collab **edit/delete failures DO
  toast** — at the `ChannelConversation.tsx:384,394` call site — so the user-facing gap is limited
  to surfaces whose call sites forget the toast (list ops, triage); the *pattern* risk stands
  because error surfacing depends on every call site remembering.
- **Chat send vs sidebar**: the chat body updates instantly but never invalidates
  `conversationKeys`, so the conversation list shows stale titles/order for up to 2 minutes.
- **Adjacent inconsistency**: bookmark toggle is instant; the share toggle right next to it lags
  through a full refetch. Error surfacing is split between hook-level toasts (files, profile),
  call-site toasts (bookmarks, notes, quiz), and nothing (feedback, onboarding saves).

## 10. Part 2 implications for the overhaul

Adding to §4's rebuild list, the design layer needs its own foundations:

1. **A real type system**: pick the brand fonts' actual roles (display vs body vs document), map
   them into `--font-sans`/`--font-serif` properly, define one title/label/body scale, and collapse
   the two prose systems into one.
2. **A shape+elevation contract**: one radius per component class (control / card / sheet / row) on
   the token scale; one elevation rule (ring vs shadow); kill bare `rounded`.
3. **One gold**: derive everything (including current `amber-*` use cases: warning banners, plan
   accents) from the `--primary` ramp; keep the shimmer as the signature, rebuilt on
   transform/opacity where possible with a shared duration token and reduced-motion guard.
4. **A motion system**: 2–3 duration tokens + 1–2 easings, route-level transition everywhere or
   nowhere, entrance motion consistent across list types, fix or remove the dead collapse animations.
5. **Mobile-first shell**: `dvh` + safe-area + `visualViewport`-aware composer, a drawer/bottom-sheet
   primitive replacing centered dialogs on mobile, tap-revealed message actions, ≥44px targets,
   and a deliberate mobile nav (bottom bar or equivalent) instead of hamburger-only.
6. **A notification spine for collab**: subscribe app-wide (not per-open-channel), drive live
   unread/mention badges from socket events, honor `notify_level` client-side, wire sound/toast
   through one dispatcher, implement `?m=` deep-links + unread divider + self-mention highlight,
   and unblock the backend push sender.
7. **A mutation-feedback policy**: every mutation is either optimistic+rollback (toggles, sends,
   checks) or pessimistic-patch with pending state (creates, payments); rollbacks always toast;
   no invalidate-only mutations on interactive surfaces.

---
---

# PART 3 — Adversarial Verification & Social Link Previews

All Part 1/2 claims were re-verified by independent agents against **code only** (docs/*.md
explicitly banned as evidence; every number recounted). Outcome: **the audit substantially holds**
— the corrections below have been folded into Parts 1–2 above.

## 11. Verification outcome — corrections applied

| Original claim | Verdict | Correction |
|---|---|---|
| 96/170 pages `'use client'` | **CORRECTED** | 146/170 direct; ~162/170 effectively client. Audit *understated* the problem. |
| ~73 of 80 dialogs unscrollable | **CORRECTED** | 24 of 32 real `DialogContent` consumers (the 80 lumped in AlertDialog). Point stands. |
| Collab edit/delete = silent rollback | **CORRECTED** | Hooks are silent, but `ChannelConversation` toasts failures. Pattern risk stands; that surface is covered. |
| ~300 amber uses in 55 files | **CORRECTED** | 263 uses in 59 files; hex `#C9A227` in 6 files (not 3); + a 4th gold (chart ramp) and a 3rd token copy (reader mode). |
| SpaceCard/PlanCard `rounded-lg`; StatuteCard bare `rounded` | **CORRECTED** | SpaceCard is `xl`; PlanCard renders shadcn Card (`2xl`); StatuteCard is a no-radius row. Card zoo = 4 treatments, not 5. |
| 3 bespoke empty states bypass EmptyState | **CORRECTED** | Only 1 bypasses (chat confidential); the other 2 wrap the shared component. 63 uses/44 files. |
| Bell never reflects channel messages | **CORRECTED** | Channel *mentions* are notification records the bell counts; only non-mention messages are invisible. |
| Backend push sender broken | **RECLASSIFIED** | Unverifiable from frontend code (source was a repo doc). Client push stack verified complete. Confirm with backend. |
| Notification action_urls carry `?m=` | **RECLASSIFIED** | Backend-defined, unverifiable from frontend. What IS verified: no collab code reads any message anchor. |
| Everything else (≈60 claims): loading/error/middleware zeros, skeleton stacking, nav fragmentation, guard hydration, caching config, chat-outside-RQ, dead code, fonts, radii math (bare `rounded`=4px confirmed against Tailwind internals), dead collapse keyframes, shimmer implementation, mobile keyboard/safe-area/touch, notify_level inert, mutation classification | **CONFIRMED** | — |

**New facts found during verification:**
- Chat's copy/thumbs-up/down message buttons have **no `onClick`** — non-functional placeholders
  (`conversation-client.tsx:1030-1038`), on top of being hover-only.
- `AdminGuard` performs **no hydration wait at all** (independent cold-refresh bounce vector).
- `/quiz/play` stacks **three** skeleton layers.
- Two more hard-reload internal navs (`useOnboarding.ts:95,106`, `useOnboardingStepSave.ts:18`).
- Breadcrumb `setOverride` is inconsistent **within admin too** (cases/statutes/plans/sponsors
  detail pages don't set it).
- `authStore.setAuth` also `console.log`s user data (not just `clearAuth`).
- Extra ad-hoc storage keys: `conv_init_*`, `lawexa_user_workflow`, `home_input_pasted`.
- The chat `pb-28` bottom padding is a constant, so a grown composer (attachments) still occludes
  the last messages; admin quiz tables DO hide columns responsively (tables aren't universally
  unadapted).
- No `tailwind.config.*` exists — the design system is entirely CSS-first in globals.css `@theme`,
  which is why bare `rounded` can't be remapped without adding `--radius-DEFAULT`.

## 12. Social link previews — why every page pastes differently

**Only 5 files in the entire app emit metadata; only one route type has a preview image.**
Root cause table (verified from code):

| Route | Title | Description | Image |
|---|---|---|---|
| `/c/[id]` (public conversation) | `Lawexa - {title}` (server-fetched) | real | **Yes — dynamic OG** (`/api/og/c/{id}`) |
| `/c/[id]` (private/404) | generic default | generic | none |
| `/radars/{r}/scans/{s}` (public) | `Lawexa - {scan title}` | first ~160 chars of report | **none** — declares `summary_large_image` with no image |
| `/terms`, `/privacy` | bare page title (no site suffix — `title.template` is `"%s"`) | real | none |
| **`/cases/[slug]`, `/notes/[slug]`, `/statutes/[slug]`** | **generic default** | **generic default** | **none** |
| Everything else (lists, quiz, channels, pricing, shared, settings…) | generic default | generic default | none |
| `/ambassadors` (static HTML outside Next) | hand-written | hand-written | its own og-image.png |

Findings, ranked:

1. **The most-shared content (cases/notes/statutes) previews as an identical generic card** because
   those detail pages are flat `'use client'` files — client modules **cannot** export
   `generateMetadata`, and no server wrapper exists to attach it to. (`/c/[id]` gets rich previews
   precisely because it kept a server `page.tsx` shell delegating to a client child.)
2. **No fallback OG image exists anywhere** — root `openGraph` has no `images`, root `twitter`
   declares `summary_large_image` with none, and no `opengraph-image.*` convention file exists.
3. **Only one OG image route exists** (`app/api/og/c/[conversationId]/route.tsx`).
4. **Reliability trap**: the metadata fetchers' API base falls back to `http://localhost:8000`
   (`lib/constants/seo.ts:16-18`) — a missing `NEXT_PUBLIC_API_URL` in the server runtime silently
   collapses even the working previews to the generic no-image card (intermittent behavior).
5. **No robots.ts/robots.txt, no sitemap, no JSON-LD** anywhere; client-rendered bodies mean a
   no-JS scraper sees only the inherited `<head>` plus a skeleton body.
6. Cosmetic: `title.template = "%s"` means child titles render with no "| Lawexa" branding,
   another per-page inconsistency in pasted links.

**Overhaul implication (adds to §4/§10):** every public content route needs a server metadata
shell (server `page.tsx` + `generateMetadata` + client child — the `/c/` pattern), a default
brand OG image at the root, per-domain OG image routes for cases/notes/statutes, robots + sitemap,
and canonical URLs — this falls out naturally of the P1 rendering-strategy rebuild.
