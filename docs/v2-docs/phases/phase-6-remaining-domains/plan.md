# Phase 6 — Remaining Domains: plan

**Objective:** everything else reaches v2 so cutover parity is possible.

> Expand to task level at kickoff; sequence within the phase is flexible — order below is a
> sensible default (user-visible impact first).

## Scope

1. **Notifications center** (list/detail on the spine from phase 5; mark-read finally
   optimistic; consistent internal-vs-external action_url handling).
2. **Quiz** (player, history, stats, results; guard via DAL roles).
3. **Radars** (list/create/inbox/scans/settings; async name refetch pattern kept).
4. **Settings hub** — all tabs; coming-soons KEPT per owner; Developer toggle lives on.
5. **Monetization**: pricing, subscription + upgrade + callbacks, trial, PAYG/message packs,
   currency handling. (Payment redirects are the legitimate `window.location` uses.)
6. **Onboarding** (8-step wizard; kill the hard-reload races via proper server-state flow).
7. **Community/trending/activity**, content requests, lawyer verification + connect surfaces.
8. **PWA polish**: Serwist service worker (precache + SWR images + bounded API cache + offline
   fallback + update toast), manifest consolidation (single source, `id`, screenshots,
   `launch_handler`), install flows, ambassador popup (kept — it's live).
9. Guest experience pass across all v2 routes (guest-readable content, auth prompts).

## Exit criteria

Every route in the audit's domain inventory (minus deliberate drops: statutes-old, notes
purchases) exists in v2 and is in the manifest; testers live in v2 full-time;
`post-implementation.md` written.
