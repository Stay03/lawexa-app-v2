# Lawexa v2 — Implementation Plan

Companion to `architecture-audit.md` (the verified audit — what's wrong) and
`foundation-standards.md` (research-backed standards — the how, with sources).
This doc says how we rebuild — cleanly, no compromises — while v1 keeps running.
Per-phase execution detail lives in `phases/phase-N-*/plan.md`; each phase closes with its
`post-implementation.md`.

> Research corrections applied (July 2026): the switch file is **`proxy.ts`** (middleware.ts is
> deprecated in Next 16; proxy runs on Node runtime); auth enforcement lives in a server-only
> **DAL**, not the proxy; v2 runs with **`cacheComponents: true`**; upgrade to Next 16.2.x and
> apply the July 20, 2026 security patch. Details in the standards doc §1.

## 0. Locked decisions

| Decision | Choice |
|---|---|
| Coexistence | Same repo. v2 lives in a hidden `app/v2/` tree; middleware rewrites normal URLs to it when the toggle cookie is set. v1 untouched. |
| Access | v2 visible only to `researcher` / `admin` / `superadmin` (~10 testers). Dev-tools toggle in Settings of **both** modes. |
| Backend | Supportive; asks are drafted as consumable contracts (notification spine). Session cookie handled on our side — no backend change required. |
| Build order | Walking skeleton → engineering foundation → **design language (gate)** → **Home + Chat** → content library → collab → rest → cutover → admin v2. See `phases/`. |
| Design | Keep the gold (`--primary` oklch hue 82, `#C9A227`) + the liquid-gold shimmer. **Design phase deferred by owner (July 17, 2026)** — engineering first. Round-1 variations built and rejected as-is; binding feedback in `design-variations/round-1-feedback.md`: no bottom tab bar on mobile, conversation composer floats like current notes/cases pages, shimmer must match the current one exactly (C — Chambers Slate was closest). Design phase (phase-2) is a hard gate before Home + Chat. |
| Curation | Drop `statutes-old` (live statutes renderer only). Drop notes Purchases. **Keep** the coming-soon settings tabs. **Keep** the ambassador popup (it's live in v1). |
| Deploy | Coolify, `main` → prod autodeploy. Therefore: dark-launch discipline (see §6). |

## 1. Folder structure

```
app/
  v2/                          ← ROUTE FILES ONLY (thin), mirrors v1 URLs 1:1
    layout.tsx                 ← server shell: providers, nav chrome, loading/error conventions
    page.tsx                   ← home
    c/[conversationId]/        ← server page (generateMetadata) + client view
    cases/[slug]/ …            ← same pattern per migrated route
  api/session/route.ts         ← sets/clears the httpOnly auth cookie (token mirror,
                                 with open-redirect guard per the official BFF guide)
proxy.ts                       ← NEW (repo has none): the v1/v2 switch, see §2
                                 (Next 16 renamed middleware.ts → proxy.ts; Node runtime)

v2/                            ← ALL non-route v2 code, aliased @v2/* in tsconfig
  design/
    tokens.css                 ← the ONE token sheet: type scale, radius classes, motion
                                 durations/easings, elevation rule, single gold ramp
                                 (amber use-cases re-derived from it), light/dark parity
    primitives/                ← Button, Card, Dialog, Drawer(bottom-sheet), Input, Tabs…
                                 built on shadcn/Radix, consuming tokens only
    motion.ts                  ← exported duration/easing constants + reduced-motion helpers
  shell/
    nav.config.ts              ← THE single source of truth: items, icons, roles, guest rules,
                                 active-match rule; consumed by every nav surface + breadcrumbs
    AppShell.tsx, Header.tsx, Sidebar.tsx, MobileNav.tsx, Breadcrumbs.tsx
                                 (mobile nav pattern is an open design-phase question —
                                 bottom tab bar was rejected by the owner)
  runtime/
    query.ts                   ← QueryClient policy: staleTime tiers, focus-refetch policy,
                                 persistence; central query-key factory (keys.ts)
    mutations.ts               ← the mutation-feedback policy as helpers:
                                 `optimistic()` (rollback+toast built in) / `patching()`
    session.ts                 ← server-side cookie read → Authorization header
    api-server.ts              ← server fetch wrapper for RSC prefetch (wraps lib/api URLs)
    realtime/                  ← the notification spine: ONE dispatcher (toast/sound/badge/
                                 title), app-wide user-channel listener, notify_level honored
    chat-engine/               ← useChatStream's SSE core (watchdog/reconnect/poll fallback)
                                 lifted and integrated with the query cache
  features/
    home/  chat/  cases/  statutes/  notes/  collab/  quiz/  radars/
    notifications/  settings/  billing/ …
    <domain>/{components,hooks,server}   ← hooks are thin: lib/api fns + central keys + policy
  routes.manifest.ts           ← list of migrated URL patterns; imported by middleware
```

**Import boundary rules (enforced via eslint `no-restricted-imports`):**
- `v2/**` MAY import: `lib/api/*`, `types/*`, pure `lib/utils/*`.
- `v2/**` MUST NOT import: `components/**` (v1 UI), `lib/hooks/**` (v1 policy), `lib/stores/**`
  except a temporary read-only bridge to `authStore` until the session cookie owns identity.
- v1 code never imports `v2/**` (except the two toggle touchpoints in §2).
- v1 hooks are **ported** (copy + adapt to central keys/policy), never imported — their logic is
  good, their embedded cache policy is not.

When v1 is deleted at cutover, `app/v2/*` graduates to `app/*`, `v2/*` to `src/*` (or stays),
and the middleware rewrite is removed. Nothing else changes — that's the point of the mirror-URLs
rule.

## 2. The switch

- **Cookie**: `lawexa-ui=v2` (plain cookie, 1-year, path=/). Not a secret — data authorization
  stays with the backend; worst case a curious user sees beta UI with their own data.
- **proxy.ts** (Next 16's middleware successor; Node runtime, `NextResponse.rewrite` propagates
  RSC headers correctly — this cookie-keyed rewrite is Vercel's documented strangler-fig pattern):
  1. `V2_ENABLED` env kill switch — if unset/false, proxy is a no-op (instant prod rollback
     without a revert).
  2. If cookie present AND path matches `routes.manifest.ts` → rewrite `/x` → `/v2/x`
     (URL bar stays `/x`).
  3. If path starts with `/v2` directly and no cookie → redirect to the bare path (no URL leaks).
  4. Everything else → untouched v1. **Unmigrated routes fall through automatically**, so testers
     live in a mixed app that grows page by page.
  5. Matcher excludes metadata files (sitemap/robots/OG) but must NOT exclude paths hosting
     Server Functions (excluded paths silently skip their auth-relevant proxy run).
- **Toggle UI**: Settings → Developer section (new), visible only when `user.role` is
  researcher/admin/superadmin (same check style as `canAccessSpaces`). Present in both v1 and v2
  settings so you can always flip back. Sets/clears the cookie + **hard-navigates** (full page
  load, not a client transition — avoids stale prefetched RSC payloads from the other variant).
- Gating is intentionally soft at the proxy layer on day 1 (role isn't readable server-side
  until the session cookie ships in F4); after F4 the proxy can also require the session. The
  proxy is never the security boundary — enforcement lives in the DAL (F4) and the backend.

## 3. Foundation phase — built BEFORE any feature ("no compromises" means here)

> Sequencing update (July 17, 2026): the design phase is deferred — F1 and the visual half of F2
> now live in **phase-2-design-language** (a hard gate before Home + Chat). F3–F6 plus version
> hygiene are engineering-only and proceed immediately as **phase-1-engineering-foundation**,
> running on existing v1 tokens in the interim.

- **F1 Design system** *(→ phase-2)*: iterate from round-1 feedback (no bottom tabs; floating
  composer; exact shimmer; Chambers Slate closest) until the owner approves → encode as
  `design/tokens.css` + primitives. One type scale, one radius per component class, one elevation
  rule, tokenized motion (2–3 durations, 1–2 easings, `prefers-reduced-motion` everywhere), one
  gold ramp (amber banner/warning cases re-derived), shimmer validated side-by-side against the
  current `globals.css` implementation.
- **F2 Shell**: mechanics now (*phase-1*): server-rendered layout, `nav.config.ts`,
  `loading.tsx`/`error.tsx`/`not-found.tsx` required per route, breadcrumb title resolution.
  Visuals later (*phase-2*): desktop sidebar chrome, the mobile nav pattern (**bottom tab bar
  rejected by owner — open design question**), header design, route transition policy.
- **F3 Data policy**: central key factory; staleTime tiers (static reference / content / live);
  `refetchOnWindowFocus` decided deliberately per tier; cache persistence for content lists;
  mutation-feedback helpers so optimistic+rollback+toast is the *easy path*; RSC prefetch +
  `HydrationBoundary` pattern so first paint has data.
- **F4 Session + DAL**: `/api/session` route mirrors the login token into an httpOnly cookie
  (backend unchanged). A `server-only` **data access layer** — `verifySession()` in React
  `cache()` + `apiFetch()` that builds `Authorization: Bearer` from the cookie — is the security
  boundary, called in every RSC/Server Action/route handler. Proxy does optimistic cookie checks
  only (CVE-2025-29927 lesson: middleware/proxy alone must never protect routes). v2 route
  protection = server redirects from the DAL; client guards die.
- **F5 Metadata**: per-route `generateMetadata` convention (server page + client view — the `/c/`
  pattern everywhere), default brand OG image, `robots.ts` + `sitemap.ts`, `title.template`
  with proper branding. Domain OG images ship with their content phase.
- **F6 Mobile baseline**: `dvh` + `env(safe-area-inset-*)` + `viewport-fit=cover` in the v2 shell,
  visualViewport-aware composer positioning, Drawer primitive for mobile dialogs, ≥44px touch
  targets, tap-revealed (not hover-only) actions.

## 4. Phase sequence (canonical numbering = `phases/` folders)

- **Phase 0 — Walking skeleton** (`phase-0-walking-skeleton`): `proxy.ts` + toggle + manifest +
  minimal v2 stub on existing tokens, serving `/` only. Testers flip the toggle in prod; all
  other routes fall through to v1. Proves the entire mechanism before real feature work.
- **Phase 1 — Engineering foundation** (`phase-1-engineering-foundation`): F3–F6 + F2 mechanics
  + version hygiene (Next 16.2.x, July 20 patch) + backend asks drafted and sent. No design
  decisions required.
- **Phase 2 — Design language** (`phase-2-design-language`) ⛳ **hard gate**: iterate from
  round-1 feedback until owner approval → `design/tokens.css` + primitives + shell chrome.
- **Phase 3 — Home + Chat** (`phase-3-home-chat`): new composer (exact shimmer), conversation
  view rebuilt — virtualized message list, memoized rows, stable context, chat-engine port (SSE
  resilience preserved), chat ↔ conversations-list cache integration, working message actions
  (currently dead buttons in v1), mobile keyboard correctness, floating composer per owner
  feedback. Conversation metadata/OG kept.
- **Phase 4 — Content library** (`phase-4-content-library`): cases, statutes (v2 AKN renderer
  only), notes (editor, no purchases), folders/files, bookmarks. Server-rendered lists/details +
  full metadata/OG images per domain — social previews get fixed here.
- **Phase 5 — Collab + notification spine** (`phase-5-collab-notifications`): channels/spaces on
  the new realtime dispatcher — live unread/mention badges, unread divider, self-mention
  highlight, message deep-links, notify_level honored, sound/toast policy. Requires the backend
  asks sent in phase 1.
- **Phase 6 — Remaining domains** (`phase-6-remaining-domains`): quiz, radars, notifications
  center, settings (keep coming-soons), pricing/billing/PAYG, onboarding, invitations,
  trending/community, lawyer verification, PWA polish.
- **Phase 7 — Cutover** (`phase-7-cutover`): parity checklist against the audit's domain
  inventory → widen access → default everyone to v2 → delete v1 trees → promote `app/v2` →
  remove proxy.
- **Phase 8 — Admin v2** (`phase-8-admin`): admin shell + the ~27 sections on v2 primitives.

Each phase: `plan.md` before starting, `post-implementation.md` at close; ends with `next build`
green, v1 behavior verified untouched, tester feedback round.

## 5. What we deliberately keep from v1 (ported, not rewritten)

`lib/api/*` and `types/*` wholesale; the SSE engine inside `useChatStream`; the collab realtime
cache-writer pattern (it becomes the model for the spine); the confidential IndexedDB transcript
store; the oklch token base + shimmer; guest-auth flow (fingerprint + refresh) adapted to the
session cookie.

## 6. Working agreement for `main` → prod autodeploy

1. Every commit keeps v1 pixel-identical with the cookie unset — v2 code is inert by construction
   (separate tree + manifest + env kill switch).
2. `next build` locally before every push (prerender failures don't show in tsc/eslint).
3. Proxy changes are the one shared surface — smallest possible diffs, kill switch tested.
4. Recommended when convenient: enable Coolify preview deployments (or a `staging` branch app) —
   nice-to-have, not required by this plan.
5. Version hygiene: move 16.1 → 16.2.x and apply Next.js monthly security patches promptly
   (first scheduled one: July 20, 2026). Set `generateBuildId` (git SHA) + `deploymentId` for
   version-skew hard reloads; verify Traefik streams responses unbuffered (the loading.tsx/PPR
   shell strategy depends on streaming).

## 7. Design variations — round 1 outcome (July 17, 2026)

Three mockups were built (`design-variations/`): A Counsel Gold, B Law Report, C Chambers Slate —
same two screens, same copy, light/dark, desktop+mobile. **Owner rejected all three as-is**;
binding feedback recorded in `design-variations/round-1-feedback.md` (no mobile bottom tab bar;
floating conversation composer like current notes/cases pages; shimmer must match the current
implementation exactly; C closest overall). Round 2 happens in phase-2-design-language, before
any real screen is built.
