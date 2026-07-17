# Phase 1 — Engineering Foundation: plan

**Objective:** every design-independent standard from `foundation-standards.md` becomes real,
working infrastructure, so phase-3+ features inherit correctness instead of re-earning it.
Runs on existing v1 tokens; zero design decisions.

> Expand each work-package to task level at phase kickoff.

## Work packages (in order)

1. **Version hygiene** (its own careful, build-verified commit — touches live v1):
   Next 16.1 → 16.2.x; apply the July 20, 2026 security patch; `generateBuildId` from git SHA +
   `deploymentId` (version-skew hard reloads); verify Traefik/Coolify streams responses
   unbuffered (loading.tsx/PPR strategy depends on it); confirm standalone output copies
   (`public/`, `.next/static/`) and `HOSTNAME=0.0.0.0` in the Dockerfile/build pack.
2. **Session + DAL** (standards §1.3, §1.6):
   `/api/session` route handler mirrors the login token into an httpOnly cookie (open-redirect
   guard); `v2/runtime/session.ts` + `api-server.ts`: `server-only` `verifySession()` in React
   `cache()` and `apiFetch()` building `Authorization: Bearer` from the cookie; proxy upgraded to
   optimistic session-presence checks for v2 routes; v2 route protection = server redirects.
   Guest-auth flow adapted (fingerprint + refresh path still works).
3. **Data-layer runtime** (standards §2): `v2/runtime/query.ts` — QueryClient factory
   (server `cache()` per request, client singleton), staleTime tier constants, dehydrate-pending
   config; global `MutationCache` onError toast + meta-tagged invalidation; `mutations.ts`
   helpers (`optimistic()`, `patching()`); first per-feature `queries.ts` exemplar with
   hierarchical `queryOptions()` factory; import-boundary ESLint rules (v2 may import `lib/api`,
   `types`, pure utils — never v1 components/hooks/stores).
4. **`cacheComponents: true`** enabled and verified against the v2 stub (Suspense-or-cache
   discipline; `"use cache"`/`cacheLife`/`cacheTag` conventions documented in-code).
5. **Metadata plumbing** (standards §1 correction 6 + audit Part 3 §12): v2 `metadataBase` +
   `title.template = '%s | Lawexa'`; `app/robots.ts` + `app/sitemap.ts` (site-wide, benefits v1
   immediately); default brand OG image; `generateMetadata` convention module. Verify
   `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_APP_URL` are set in the prod build env (kills the
   localhost-fallback preview bug).
6. **Mobile shell mechanics** (standards §4, mechanics only): v2 viewport export
   (`viewportFit: 'cover'`, `interactiveWidget: 'resizes-content'`, dual themeColor); the
   `100dvh` grid shell; `--keyboard-inset` visualViewport hook; safe-area utilities; hover-guard
   CSS convention; `overscroll-behavior` defaults. Visual skin comes in phase 2.
7. **Backend asks — drafted and sent** (contract style per team convention: what we consume,
   not how to build): per-channel `unread_count`/`mention_count` in list payloads; realtime
   events carrying count deltas; confirmation/fix status of the push send side. Owner reviews
   the draft before it goes out.

## Verification

Each package lands as its own dark commit (v1 pixel-identical, `next build` green). Package 1
additionally gets a prod smoke test after deploy.

## Exit criteria

All seven packages merged and verified; backend asks acknowledged by the backend team;
phase-2 design work can start with zero engineering blockers.
