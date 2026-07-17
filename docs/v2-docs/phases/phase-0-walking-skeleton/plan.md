# Phase 0 — Walking Skeleton: plan

**Objective:** prove the entire v1/v2 switch mechanism end-to-end in production while being
completely invisible to normal users. No design ambition — the v2 stub runs on existing v1
tokens.

## Scope

1. **`v2/routes.manifest.ts`** — the list of URL patterns migrated to v2. Starts with `/` only.
2. **`proxy.ts`** (repo root — Next 16's middleware successor, Node runtime):
   - No-op unless `V2_ENABLED=true` (env kill switch; instant rollback without a revert).
   - Cookie `lawexa-ui=v2` present AND pathname in manifest → `NextResponse.rewrite('/v2' + path)`
     (URL bar unchanged).
   - Direct `/v2/*` hit without the cookie → redirect to the bare path (no URL leaks).
   - Matcher: exclude `_next`, `api`, files with extensions, metadata routes. Everything else
     untouched → v1 falls through automatically.
3. **`app/v2/` stub**: `layout.tsx` (server component; inherits root providers), `page.tsx`
   (server component; clearly marked "v2 preview — walking skeleton"; shows toggle state + a
   "back to v1" control), `loading.tsx`, `error.tsx` — establishing the every-route-has-boundaries
   convention from file one.
4. **Settings → Developer** (the one v1 touch):
   - `app/(main)/settings/developer/page.tsx` + `components/settings/DeveloperSettings.tsx`.
   - Nav item appended to `components/settings/settings-sidebar-nav.tsx`, role-filtered like
     Organization (visible to researcher/admin/superadmin only — same pattern as
     `canAccessSpaces`; add `lib/utils/v2-access.ts` with `canAccessV2Preview()`).
   - Toggle sets/clears the cookie (plain, 1-year, path=/) then **hard-navigates** to `/`
     (full page load — avoids stale prefetched RSC payloads).
5. **Env**: `V2_ENABLED` documented; set to `true` on Coolify only when ready to test.

## Out of scope

Session cookie/DAL (phase 1), any real v2 screens (phase 3+), design tokens (phase 2),
Next 16.2 upgrade (phase 1), `@v2/*` tsconfig alias (added when `v2/` grows real code).

## Verification checklist (all must pass before push)

- [ ] `npx tsc --noEmit` clean; `npx eslint` clean.
- [ ] Dev server with `V2_ENABLED=true`: `curl /` without cookie → v1 home; with
      `Cookie: lawexa-ui=v2` → v2 stub markup; `curl /cases` with cookie → v1 (fallthrough);
      `curl /v2` without cookie → redirect to `/`.
- [ ] Dev server without `V2_ENABLED`: cookie has no effect anywhere.
- [ ] Toggle hidden for non-privileged roles; visible for researcher/admin/superadmin.
- [ ] Full `next build` green.
- [ ] After deploy with `V2_ENABLED` unset: prod behavior byte-identical (spot-check).
- [ ] After setting `V2_ENABLED=true` on Coolify: owner flips the toggle in prod, sees the stub
      at `/`, falls through to v1 everywhere else, and can flip back.

## Exit criteria

Owner + at least one other tester have toggled v2 on and off in production; v1 confirmed
untouched for everyone else; kill switch tested (unset env → rewrites stop).
