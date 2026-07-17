# Phase 7 — Cutover: plan ⛳ OWNER GATES

**Objective:** v2 becomes the app; v1 is deleted.

## Steps

1. **Parity checklist**: walk the audit's domain inventory (architecture-audit §2) route by
   route; each is either in the v2 manifest or a recorded deliberate drop. Fix gaps.
2. **Widen access** ⛳: open the toggle beyond researcher/admin/superadmin (all roles opt-in)
   for a soak period. Watch error rates/feedback.
3. **Flip the default** ⛳: invert the mechanism — everyone gets v2; the cookie becomes a
   temporary v1 opt-out for a grace window. Announce in-app.
4. **Soak + fix**: hold until error/feedback levels are boring.
5. **Delete v1**: remove `app/(main)`/`(auth)`/`(onboarding)`/(legal) v1 trees, v1
   `components/*`, v1 `lib/hooks` leftovers, v1 stores that died (theme/breadcrumb/etc.), dead
   deps; promote `app/v2/*` → `app/*`; remove `proxy.ts` rewrite logic + manifest + kill switch;
   `v2/` code graduates (drop the prefix or keep as `src/`).
6. **Post-delete audit**: bundle diff, route-by-route smoke, Lighthouse/INP checks, sitemap and
   OG spot-checks, storage-key cleanup (old zustand keys migrated/removed).

## Exit criteria

v1 code no longer exists in the repo; single app tree; `post-implementation.md` records the
final state + metrics deltas (perf, bundle, error rates).
