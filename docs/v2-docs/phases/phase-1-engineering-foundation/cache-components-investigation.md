# WP4 — `cacheComponents: true` feasibility investigation

**Question:** Can we enable `cacheComponents: true` in `next.config.ts` (Next 16.2.10) TODAY
without breaking the live v1 app — and if not, what exactly is the prerequisite list?

**Verdict: DEFER.** Enabling the flag today breaks the v1 production build on **53 routes**,
and the dominant failure class (51 dynamic `[param]` routes) **cannot be fixed by any local,
per-page edit** — it requires rearchitecting the two shared v1 layouts (`app/(main)/layout.tsx`
and `app/(admin)/layout.tsx`) from `'use client'` into server components. That is a large,
high-risk change to the live v1 app for **zero v1 user benefit** (v1 is being retired). The flag
is global with **no per-route opt-out** (route-segment config escapes are themselves rejected —
proven below), so it is all-or-nothing across the whole app.

The v2 tree is already born compatible (see "What passed"), so v2's Suspense-or-cache discipline
(standards §1.5) can be enforced by **convention + review now**, and the global flag flipped at the
**phase-7 cutover** when v1 is removed.

Everything below is empirical: reproduced against the real codebase with `next build` (Next 16.2.10,
Turbopack) at commit on `main`, `V2_ENABLED=true`, real `NEXT_PUBLIC_*` URLs.

---

## 1. Method / builds run

| # | Config | Result |
|---|---|---|
| Baseline | flag OFF | **green** — 126 static (`○`) + 55 dynamic (`ƒ`) routes |
| B1 | flag ON | **compile error** — `runtime` route config incompatible |
| B2 | flag ON, `runtime` removed | **prerender errors** — dynamic `[param]` pages "uncached data outside `<Suspense>`" |
| B3 | + 3 route-group `loading.tsx` | boundary **ineffective** — same errors persist |
| B4 | + in-page `<Suspense>` on one page | **ineffective** — same error on that page |
| B5 | + switch `use(params)`→`useParams()` on one page, fix legal `new Date()` | legal routes fixed; param page **still errors** (53→51) |
| B6 | + `export const dynamic='force-dynamic'` on a server page | **compile error** — `dynamic` route config also incompatible |

`--debug-prerender` was used from B4 on; it disables Turbopack's fail-fast early-exit, so the build
collects and reports **all** prerender errors in one pass (the plain build aborts after the first
few). That is how the full 53-path catalog below was captured.

---

## 2. Full error catalog (grouped)

### Group A — Compile-time: route-segment config is incompatible (hard build failure)

cacheComponents rejects the legacy route-segment config exports outright, at **compile** (before any
prerender). Two confirmed, and they are representative of the whole class
(`runtime`, `dynamic`, `revalidate`, `fetchCache`, `dynamicParams`):

```
./app/api/og/c/[conversationId]/route.tsx:5
Route segment config "runtime" is not compatible with `nextConfig.cacheComponents`. Please remove it.
   > 5 | export const runtime = 'nodejs';

./app/(main)/c/[conversationId]/page.tsx:6
Route segment config "dynamic" is not compatible with `nextConfig.cacheComponents`. Please remove it.
   > 6 | export const dynamic = 'force-dynamic';
```

**Consequence that matters most:** `export const dynamic = 'force-dynamic'` — the obvious "just make
this route dynamic and skip prerendering" escape hatch — **is itself a compile error**. There is **no
cheap per-route opt-out** from the Suspense-or-cache discipline. Every route must comply.
(And client pages — `'use client'` — can't export route config at all, so even if it were allowed it
wouldn't reach the 49 client `[param]` pages.)

Current live offenders in the tree: exactly one — `export const runtime = 'nodejs'` in
`app/api/og/c/[conversationId]/route.tsx`. Fix = delete the line (Node is the default runtime). Trivial.

### Group B — Prerender: dynamic `[param]` pages, "uncached data outside `<Suspense>`" (51 routes)

Error shape (per route), pointing at the `blocking-route` doc:

```
Error: Route "/channels/[channelId]": Uncached data was accessed outside of <Suspense>. This
delays the entire page from rendering, resulting in a slow user experience.
  → https://nextjs.org/docs/messages/blocking-route
    at app\(main)\layout.tsx:97:3   (the {children} slot of MainLayout)
```

Every dynamic route segment (`[id]`/`[slug]`/`[uuid]`/…) with **no `generateStaticParams`**, rendered
under the `(main)` or `(admin)` layout, fails. That is all 51 of them:

**Admin (32):** `/admin/ai/agents/[id]`, `/admin/ai/agents/[id]/edit`, `/admin/ai/models/[id]`,
`/admin/ai/providers/[id]`, `/admin/ai/tools/[id]`, `/admin/ai/workflows/[id]`,
`/admin/ai/workflows/[id]/edit`, `/admin/campaigns/[id]`, `/admin/campaigns/[id]/grant`,
`/admin/campaigns/[id]/usage`, `/admin/cases/[id]`, `/admin/cases/[id]/edit`,
`/admin/conversations/[id]`, `/admin/courses/[slug]`, `/admin/lawyer-connect/[id]`,
`/admin/lawyer-connect/lawyer/[uuid]`, `/admin/lawyer-verifications/[id]`,
`/admin/message-packs/[id]`, `/admin/notifications/[uuid]`, `/admin/plans/[id]`,
`/admin/quiz/generation/[uuid]`, `/admin/quiz/questions/[uuid]`, `/admin/quiz/questions/[uuid]/edit`,
`/admin/quiz/sessions/[uuid]`, `/admin/sponsors/[id]`, `/admin/sponsors/[id]/campaigns/new`,
`/admin/sponsors/[id]/usage`, `/admin/statutes/[slug]`, `/admin/subscriptions/[id]`,
`/admin/users/[uuid]`, `/admin/users/[uuid]/conversations`, `/admin/users/[uuid]/plan-periods`.

**Main (19):** `/c/[conversationId]`, `/cases/[slug]`, `/cases/[slug]/report`, `/channels/[channelId]`,
`/content-requests/[uuid]`, `/folders/[uuid]`, `/notes/[slug]`, `/notes/[slug]/edit`,
`/notes/[slug]/export-docx`, `/notes/[slug]/publish`, `/notifications/[id]`, `/quiz/[uuid]/results`,
`/radars/[radarUuid]`, `/radars/[radarUuid]/scan-log`, `/radars/[radarUuid]/scans/[scanUuid]`,
`/radars/[radarUuid]/settings`, `/spaces/[spaceId]`, `/statutes-old/[slug]`, `/statutes/[slug]`.

Of these, 49 are `'use client'` pages reading the server params promise via `use(params)`; 2 are
server pages that `await params` inside `generateMetadata` (`/c/[conversationId]` and
`/radars/[radarUuid]/scans/[scanUuid]`).

### Group C — Prerender: `new Date()` in a Server Component (2 routes)

```
Error: Route "/privacy" used `new Date()` before accessing either uncached data ... or Request data.
Accessing the current time in a Server Component requires reading one of these data sources first.
Alternatively, consider moving this expression into a Client Component or Cache Component.
  → https://nextjs.org/docs/messages/next-prerender-current-time
    at LegalLayout (app\(legal)\layout.tsx:46:21)
   > 46 | &copy; {new Date().getFullYear()} Law Guide Technology Limited.
```

Affects `/privacy` and `/terms` — both were **static** in the baseline; the shared **server**
`(legal)/layout.tsx` copyright-year `new Date()` breaks them. This is the only place cacheComponents
turns a previously-static route red. **Trivially fixable** (client `<CopyrightYear/>`, a `'use cache'`
helper, or a build-time constant) — confirmed: neutralizing it dropped both routes from the error set
(53 → 51).

---

## 3. What PASSED under the flag (important — bounds the blast radius)

Nothing below errored, even with the flag on:

- **The entire v2 tree** — `/v2` uses `cookies()` + `verifySession()` in the page and **passed**,
  because `app/v2/` has a **server-component** layout plus `app/v2/loading.tsx`. This is the proof
  that greenfield v2 is already born cacheComponents-compatible.
- **Route handlers** — `/api/session`, `/api/og/c/[conversationId]` (they don't prerender; the only
  issue was the `runtime` export, Group A).
- **All metadata routes** — `/sitemap.xml` (despite its own `new Date()` — sitemap generation is not
  subject to the current-time rule), `/robots.txt`, `/manifest.webmanifest`, `/opengraph-image`,
  `/icon.png`, `/apple-icon.png`.
- **`/verify-email/[id]/[hash]`** — a dynamic `[param]` route that **passed**. It reads params via the
  **client `useParams()`** hook AND sits under the **server** root layout (the `(auth)` group has no
  `layout.tsx`), with an effective `(auth)/loading.tsx`. This is the control case that isolates the
  root cause (below).
- **All ~126 baseline-static routes** (home, lists, settings, onboarding, auth forms, admin index
  pages, etc.) — no static→dynamic regressions observed apart from `/privacy` + `/terms`.

---

## 4. Root cause — why the 51 param routes can't be fixed locally

The failing routes share one thing the passing ones don't: a **dynamic segment with no
`generateStaticParams`, rendered under a `'use client'` shared layout**. The fix is NOT about how
params are read. Proven by elimination on `/channels/[channelId]`:

| Attempted fix | Result |
|---|---|
| Route-group `app/(main)/loading.tsx` (Suspense boundary) | **no effect** — identical error |
| In-page `<Suspense>` wrapping the `use(params)` consumer | **no effect** — identical error |
| Switch `use(params)` → client `useParams()` hook | **no effect** — identical error |
| Neutralize the `(legal)` `new Date()` | **fixed** those 2 routes (control) |
| `(auth)/loading.tsx` on a route under the server root layout | **fixed** `/verify-email` (control) |

The contrast between `/channels/[channelId]` (fails) and `/verify-email/[id]/[hash]` (passes) —
both dynamic, both `useParams()` — isolates the variable to the **layout**: `(main)`/`(admin)` are
`'use client'` (the `mounted`-gated skeleton pattern); `(auth)`/`v2` render under a **server** layout.

**Mechanism:** PPR needs a Suspense boundary in the **server-rendered** part of the tree to split a
route into "static shell + streamed dynamic hole." Because `(main)/layout.tsx` and
`(admin)/layout.tsx` are client components, everything they render — including any `loading.tsx`
boundary and the page — is inside the client boundary, so there is **no server-side postpone point**.
A dynamic route (whose params are unknowable at build) therefore has no static shell to emit and
reports "uncached data accessed outside `<Suspense>`." Static routes under the same client layout are
fine because they never access request-time data. (Note: the "at layout.tsx:97 `{children}`" stack
frame is the same in every variant, and `--debug-prerender` ignore-lists the deeper frames — the
suspend originates in the framework's params handling, not app code, which is why no app-level edit
below the layout clears it.)

---

## 5. Runtime impact IF the build were forced green

- The ~126 baseline-static routes stay prerendered (`○`). Client pages with no request-time access
  remain static shells.
- The dynamic `[param]` routes are `ƒ` (server-rendered on demand) today. Done *correctly* (server
  layouts + proper boundaries) they would become `◐` Partial Prerender — a static shell that streams
  the dynamic part — which is a **UX improvement** (faster shell). That is the actual prize of
  cacheComponents. But reaching `◐` requires the layout rearchitecture; you cannot get there by
  forcing the build green.
- The only previously-static routes cacheComponents would break are `/privacy` + `/terms`
  (the legal-layout `new Date()`), and that is trivially fixed.
- Net: **no data-page behavior regression** is intrinsic to the flag; the cost is entirely in the
  build-time discipline and the layout refactor it demands.

---

## 6. Prerequisite list + effort (if the team insisted on shipping the flag pre-cutover)

1. **Remove `export const runtime = 'nodejs'`** from `app/api/og/c/[conversationId]/route.tsx`.
   — *trivial, 1 line.*
2. **Fix `(legal)/layout.tsx` `new Date()`** → client `<CopyrightYear/>` or `'use cache'` helper.
   — *trivial, 1 file.*
3. **Rearchitect `app/(main)/layout.tsx` and `app/(admin)/layout.tsx` from `'use client'` to server
   components** — extract the interactive parts (sidebar/zustand state, breadcrumb store, `mounted`
   skeleton gate, notification/push mounts) into client leaf children, and introduce a real
   **server-side Suspense/`loading.tsx`** boundary around the page slot.
   — **LARGE + HIGH RISK.** These are the two most central layouts; every one of ~146 pages renders
   under them. This is the crux and the reason to defer.
4. **Re-verify the 51 dynamic routes** once #3 lands — likely a single `(main)/loading.tsx` +
   `(admin)/loading.tsx` then suffices, but must be re-proven (the boundary only works once it is in
   the server tree). — *medium, contingent on #3.*
5. **Handle the 2 server `generateMetadata` pages** (`/c`, radar scan): their metadata `await params`
   + cached `fetch` (`revalidate: 60`) — verify metadata streams, or move the fetch under `'use
   cache'`. — *small.*
6. **Full v1 regression pass** (all groups, mobile shell, guest-auth) — *medium.*

There is **no shortcut** at step 3/4: `force-dynamic` and every other route-segment config opt-out is
a compile error (Group A), so routes cannot individually escape the discipline.

---

## 7. Recommendation / timing

- **DEFER the global `cacheComponents: true` to the phase-7 cutover**, when v1 is removed and only the
  v2 tree remains. v2 is already clean under the flag (proven by `/v2`), so the cutover flip should be
  a no-op for v2 and the ~53 v1 breakages simply cease to exist.
- **Do NOT** flip it in phase 3. The only way to make v1 build under it is the `(main)`/`(admin)`
  layout rearchitecture (#3) — days of careful work + a full regression pass on a codebase being
  retired, for zero v1 user benefit.
- **Meet standards §1.5 by convention now, not by the global flag.** v2 code is *born compatible*
  regardless: keep server-component layouts in `app/v2/*`, ship `loading.tsx` + `error.tsx` per route
  (already the v2 convention), keep dynamic access in the DAL under React `cache()` / `'use cache'`,
  and wrap request-time reads in Suspense. Enforce via review + the existing v2 import-boundary lint.
  Optionally add a CI check that greps the v2 tree for the banned route-segment config exports and for
  `'use client'` on `app/v2/**/layout.tsx`.
- **When the cutover build is prepared**, the day-one checklist is short: delete the one `runtime`
  export (or by then it's gone with v1), confirm no `new Date()` in surviving server layouts, and
  flip the flag. The v2 tree needs nothing.

---

### Appendix — reproduction

```
# from the app root, with the flag added as a top-level key in next.config.ts
V2_ENABLED=true NEXT_PUBLIC_APP_URL=https://lawexa.com NEXT_PUBLIC_API_URL=https://api.lawexa.com \
  npx next build --debug-prerender
```

`next.config.ts` change under test:

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,   // <-- the flag; Next prints "- Cache Components enabled"
  generateBuildId: () => buildId,
  ...
};
```

Baseline route table (flag off): 126 `○` static + 55 `ƒ` dynamic. The 55 dynamic = 52 `[param]` page
routes (no `generateStaticParams`) + 2 route handlers + `/v2`. With the flag on, the 51 `[param]`
routes under `(main)`/`(admin)` + `/privacy` + `/terms` error; `/verify-email/[id]/[hash]` and `/v2`
do not.
