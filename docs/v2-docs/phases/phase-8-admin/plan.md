# Phase 8 — Admin v2: plan

**Objective:** the back-office (~27 sections, 316 components in v1) rebuilt on v2 primitives
and the same foundation. User-facing app shipped first by owner decision; v1 admin keeps
working until this phase completes (it survives phase-7 deletion scoped to user-facing trees —
adjust phase-7 scope accordingly if this phase hasn't started by then).

> Expand to task level at kickoff. Reuse: v2 primitives/tokens, DAL role checks
> (admin/superadmin server-side), data policy, observability component patterns.

## Scope (by sidebar group, one group per slice)

1. Admin shell: sidebar from `nav.config` (admin section), header, breadcrumbs with title
   resolution (fixing the v1 inconsistency), role gating via DAL (no client-guard bounce bug).
2. Conversations group (+ analytics).
3. Users group (users, analytics, activity feed, device intelligence, lawyer verifications,
   plan periods).
4. Content group (cases + enrichment + principles, courses, statutes + imports, content
   requests, ambassadors, broadcasts, views, lawyer connect).
5. Quiz group (questions, generation, sessions, analytics).
6. Files group (+ extractions).
7. Billing group (plans, subscriptions, message packs, sponsors, campaigns, messages, paystack
   webhooks, settings).
8. AI ops console (providers, models, agents, tools, workflows).
9. Operations group (overview, ingestions, extractions, radar scans, statute imports,
   scheduled tasks — superadmin-only respected).
10. Delete v1 admin trees + types/admin god-file split into per-domain files as sections
    migrate.

## Exit criteria

All sections migrated; v1 admin deleted; `types/admin.ts` (1,455-line god-file) dissolved;
`post-implementation.md` written. The overhaul is complete.
