# phase-0-walking-skeleton — post-implementation

Closed: July 17, 2026. Workflow: Opus implementer agent → independent Opus reviewer agent →
coordinator fixes → runtime verification matrix → build → ship.

## What was built

- `v2/routes.manifest.ts` — migrated-route manifest (`['/']`); exact-match semantics with
  `'/prefix/*'` wildcard support; `'/'` can never prefix-match.
- `v2/cookie.ts` — single source of truth for the opt-in cookie (name/value/set/clear strings +
  `hasV2Cookie()` exact-entry parser). Added post-review to kill literal duplication.
- `proxy.ts` — Next 16 proxy: `V2_ENABLED` kill switch short-circuit; `/v2*` no-cookie redirect
  (prefix strip, query preserved); cookie+manifest → `NextResponse.rewrite` to `/v2*`; static
  matcher excluding api/_next/favicon/dotted paths.
- `app/v2/` — `layout.tsx` (server; **404s the whole tree unless `V2_ENABLED==='true'`** — added
  post-review so the kill switch hides pages, not just rewrites), `page.tsx` (server, awaits
  `cookies()`, `V2-WALKING-SKELETON` marker), `loading.tsx`, `error.tsx`, `switch-back-button.tsx`.
- `lib/utils/v2-access.ts` — `canAccessV2Preview()` (researcher/admin/superadmin), mirrors
  spaces-access.
- `components/settings/DeveloperSettings.tsx` + `app/(main)/settings/developer/page.tsx` +
  nav item in `settings-sidebar-nav.tsx` (role-filtered like Organization) — the toggle; sets
  cookie then hard-navigates.
- `.env.example` — added post-review; documents `V2_ENABLED` + the NEXT_PUBLIC_* build-time vars.

## Deviations from plan

- **Additions beyond plan scope (all reviewer-driven):** the `app/v2/layout.tsx` 404 guard
  (plan's kill switch only covered the proxy), `v2/cookie.ts` centralization, `.env.example`.
- Manifest uses `as const` tuple rather than `readonly string[]` (type-narrow future entries).

## Verification results

- Implementer: tsc clean, eslint clean (11 files), full `next build` green.
- Reviewer (adversarial, code-level): verdict SHIP, zero blockers; confirmed against Next 16.1.1
  internals that root `proxy.ts` is loaded; all attack surfaces passed (no rewrite/redirect
  loops, query preservation, exact cookie parsing, matcher inclusions/exclusions, purely
  additive sidebar diff).
- Coordinator runtime matrix (dev server):
  - Kill switch ON: 8/8 — no-cookie `/`→v1; cookie `/`→v2 marker; cookie `/cases`→v1
    fallthrough; `/v2` no-cookie→307 `/`; `/v2` cookie→200 no loop; `/?q=1` rewrite w/ query
    (`x-middleware-rewrite: /v2?q=1`); garbage cookie inert; `/login` fallthrough.
  - Kill switch OFF: cookie fully inert; `/v2` → **404** (guard); v1 200.
- Final `next build`: green (126 pages; `ƒ /v2`, `○ /settings/developer`, `ƒ Proxy`).
- After-fix lint/tsc: clean.

## Known gaps / follow-ups

1. **Matcher dot-exclusion** (`.*\\..*`) will skip the proxy for future migrated slugs containing
   periods (real case citations do). MUST be revisited before content routes enter the manifest
   → carried to **phase-4 pre-task** (also noted by reviewer).
2. `/settings/developer` SSR renders the "not available" fallback until the auth store hydrates
   client-side — consistent with the settings area's existing pattern; superseded when phase-1's
   session/DAL makes role available server-side.
3. `V2_ENABLED=true` not yet set on Coolify — prod exit test pending (owner action).

## Notes for the next phase

- Phase 1 should convert the proxy's optimistic checks to also require the session cookie once
  `/api/session` exists, and revisit the layout 404 guard under `cacheComponents: true`
  (env read must stay request-time).
- The `@/v2/*` import path works via the existing `@/*`→root tsconfig alias; no dedicated alias
  needed yet.
