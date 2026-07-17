# phase-1-engineering-foundation — post-implementation

Code complete: July 17, 2026 (waves 1–4). Phase closes fully when the two pending items at the
bottom clear. Workflow per wave: Opus implementer → independent Opus reviewer → coordinator
fixes → verification → commit.

## What was built

- **Wave 1 (`e3e9e90`)** — Version hygiene: Next 16.1.1 → 16.2.10 exact-pinned; `deploymentId`/
  `generateBuildId` from the commit SHA. Metadata plumbing: `robots.ts`, `sitemap.ts`, site-wide
  default OG image (`app/opengraph-image.tsx`, twitter fallback verified), `%s | Lawexa` title
  template with `/c/` + radar-scan de-double-branded, single-manifest resolution. Backend-asks
  draft (`docs/v2-docs/backend-asks.md`).
- **Wave 2 (`e1d2166`)** — Session + DAL: `/api/session` httpOnly token mirror (origin-guarded
  both verbs, forwarded-host aware, body-capped), `v2/runtime/{session,session-token,api-server}`
  (`server-only`, `verifySession()` in React `cache()`, minimal DTOs), `SessionSync` with
  serialized token-keyed re-mirroring (reviewer HIGH finding fixed: guest→login token swap now
  re-mirrors; stale-cookie cross-user face closed).
- **Wave 3 (`eb49024`)** — Data runtime: staleTime tiers, isomorphic `makeQueryClient` with
  injected error handler (sonner isolated behind the client provider — reviewer finding),
  meta-tagged global invalidation, `optimisticMutation`/`patchingMutation` (scoped
  `isMutating({mutationKey})` guard — reviewer finding), `casesQueries` exemplar,
  probe-verified import-boundary ESLint zones (both directions; realtime/firebase blocked).
- **Wave 4 (`60059a5`)** — Mobile shell mechanics: `v2/shell/` (100dvh grid shell, keyboard-inset
  hook, safe-area utilities, dock slot for the future floating composer, document lock **scoped
  to a lifecycle-managed class** — reviewer BLOCKER: React 19 never unloads route stylesheets,
  a bare `html,body` rule would have left v1 unscrollable after soft-nav out of v2); v2 viewport
  export (cover + interactive-widget + dual theme-color, leak-free). cacheComponents
  investigation: **DEFER to phase-7** (53 v1 routes break via client layouts; no opt-out; v2
  tree already compatible) — see `cache-components-investigation.md`.

## Deviations from plan

- `cacheComponents: true` NOT enabled (plan assumed it; investigation proved it impossible
  pre-cutover). v2 upholds the discipline by convention; plan/standards amended.
- `server-only` package added (was missing); `getSessionToken` moved to its own module to kill
  an import cycle.
- Proxy session-gating deliberately deferred to phase 3 (chicken-and-egg with SessionSync).
- Coolify ENOSPC incident mid-phase: wave-3 deploy failed on host disk exhaustion → ops runbook
  written (`ops-coolify-disk-cleanup.md`); wave-4 push held until the server is cleaned.

## Verification results

Every wave: tsc + eslint clean, full `next build` green (129→130 pages), independent adversarial
review (wave 2 security-focused; every gating finding fixed and re-verified live — session
route matrix 204/403/413, boundary probes both directions, viewport head curls v2-vs-v1,
baseline-vs-change cold builds for wave 4).

## Known gaps / follow-ups

1. **PENDING: July 20, 2026 Next.js security patch** — apply to 16.2.x when released (its own
   verified commit).
2. **PENDING: wave-3/4 deploy** — blocked on owner clearing the Coolify host disk (runbook) then
   Redeploy; commits `eb49024` + `60059a5` are ready.
3. Backend asks await owner review, then backend team delivery (blocks phase 5's realtime
   badges; graceful degradation documented in the asks doc).
4. `deploymentId` runtime divergence possible on Nixpacks (env absent at runtime) — bounded
   impact; optionally set `NEXT_DEPLOYMENT_ID` in Coolify runtime env (wave-1 reviewer note).
5. Proxy matcher dot-exclusion → phase-4 pre-task (from phase 0).
6. `output: 'standalone'` + Dockerfile decision parked for the owner (no Dockerfile exists;
   Nixpacks in use).

## Notes for the next phase (phase-2-design-language ⛳)

- The engineering foundation is DONE — phase 2 has zero engineering blockers.
- Phase-2 inputs: `design-variations/round-1-feedback.md` (binding), standards §3, and the shell
  contract in `v2/shell/AppShell.tsx` (dock = floating composer home; mobile nav pattern open).
- Phase-3 builders inherit: DAL (`verifySession`/`apiFetch`), query policy + exemplar factory,
  mutation helpers, the shell mechanics, and the metadata conventions — all documented in-code.
