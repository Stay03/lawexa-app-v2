# Phase 5 — Post-Implementation

**Status:** ✅ Code complete · build-verified · ⏳ live click-through pending · **Date:** 2026-06-28

The final quiz slice — usage analytics, matching-health, and the per-user quiz
section. How it shipped vs [`plan.md`](./plan.md), and verification. Completes the
quiz feature.

---

## 1. What shipped

**Plumbing (extends the Phase 3/4 admin-quiz data layer):**
| File | Added |
|---|---|
| `types/admin-quiz.ts` | `AdminQuizGranularity`, `AdminQuizStatCardData`, chart point types, `AdminQuizAnalytics`, `AdminQuizMatchingHealth`, `AdminQuizTopicCoverageRow`, `AdminUserQuizProfile` + three response envelopes |
| `lib/api/admin-quiz.ts` | `getAnalytics`, `getMatchingHealth`, `getUserQuizProfile` |
| `lib/hooks/useAdminQuiz.ts` | `useAdminQuizAnalytics`, `useAdminQuizMatchingHealth`, `useAdminUserQuizProfile` (+ keys) |
| `lib/utils/quiz-format.ts` | `formatHourIndex` (hour-index → "1 PM" for the `hour`-granularity x-axis) |

**Components (9, `components/admin/quiz/`):** `AdminQuizStatCard`,
`AdminQuizSessionsChart`, `AdminQuizAvgScoreChart`, `AdminQuizTopTopicsTable`,
`AdminQuizScoreDistribution`, `AdminQuizUsageSection`, `AdminQuizMatchingSection`,
`AdminUserQuizSection`, `UserScoreSparkline`.

**Page (1):** `app/(admin)/admin/quiz/analytics/page.tsx`.

**Edits:**
- `components/admin/admin-nav-quiz.tsx` — adds the "Analytics" nav item (`BarChart3`).
- `app/(admin)/admin/users/[uuid]/page.tsx` — mounts `<AdminUserQuizSection uuid={uuid} />`
  after the Activity section.
- `components/admin/analytics/ChangePercentBadge.tsx` — adds an optional
  `nullLabel` prop (default `'N/A'`, non-breaking) so the quiz cards render "—".

## 2. Key decisions

1. **One period lifted to the page.** Unlike Phase 4 (each summary card owned its
   own period state), the analytics page holds a single `useState<AdminQuizPeriod>`
   and drives **both** the usage and matching sections from it — the doc wants one
   selector for both dashboards. Local state (no URL) since there's no pagination /
   deep-link to preserve.
2. **Chart x-axis is one `date` field, not two.** Unlike `UserGrowthChart` (separate
   `hour`/`date` keys), the analytics payload always names the field `date`; its
   value is an **integer hour index** for `hour` granularity, else `YYYY-MM-DD`. So
   `dataKey="date"` is fixed and the tick/tooltip formatters branch on the echoed
   `granularity` via the shared `formatHourIndex` helper. Typed `date: string | number`.
3. **Reused the shared `ChangePercentBadge`** (added a `nullLabel` prop) rather than
   inlining a third copy, and pass `nullLabel="—"` per the spec — null `change_percent`
   renders "—", `0` stays "0%", up/down stay green/red.
4. **Matching-health rates render "—" when null** (no serves in the period). The
   headline `tier2_cross_user_rate` is emphasized (ring + primary text). The
   tier-breakdown is a single segmented bar (mirrors `CoverageBar`) with a coloured
   legend; topic coverage is a responsive table with a cross-user check icon.
5. **Avg-score line** constrains `YAxis domain={[0,100]}` and gives the tooltip a
   custom `formatter` so a legitimate **0%** renders (the default tooltip suppresses
   falsy values).
6. **Per-user `score_trend` is a `number[]`** → a new compact, index-based
   `UserScoreSparkline` (the student `QuizScoreTrendChart` is date/object-based and
   couldn't be reused). Gated behind `≥ 2` points, mirroring the student stats view.
7. **Score-distribution / top-topics** use the established hand-rolled bar-list and
   shadcn `Table` patterns (no `Progress` primitive exists); buckets are colour-banded
   low→high (rose / amber / emerald).
8. **Per-user reuse**: the generic `QuizStatCard` is reused verbatim for the headline
   tiles; `formatDurationMs` / `formatTokenCost` / `scoreBandClasses` / `formatSessionDate`
   for formatting. `generation.total_cost` (the only decimal string) → `formatTokenCost`.

## 3. Deviations from the plan

| Item | Resolution |
|---|---|
| Empty state gated purely on `sessions.total === 0` | Gated on `sessions.total === 0 && generation.batches === 0`, so a user with generation activity but no sessions still shows their data instead of an empty hint. |
| Stat-card **type** named `AdminQuizStatCard` in the plan | Named the type `AdminQuizStatCardData` to avoid colliding with the `AdminQuizStatCard` **component**. |

No other deviations. Period selector ships with named ranges (custom `date`/`date_range`
deferred, as in Phase 4).

## 4. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint` (all P5 files, incl. both app pages) | **clean** (no suppressions) |
| `npm run build` | **exit 0**; `/admin/quiz/analytics` (○ Static) emitted |
| `any` / `@ts-ignore` / `eslint-disable` / `TODO` scan | none |

### Still to do (runtime — needs an admin login + real quiz data)
- [ ] Click-through: period selector updates both sections; usage cards show deltas
      (and "—" with no baseline); charts render hour-index vs date x-axes; matching
      tiers/coverage populate; open a user with quiz history and confirm the per-user
      card + sparkline + empty state.

## 5. Definition of Done status

All static-quality DoD items met: period-driven usage cards (with deltas) + 2 charts
(hour-index & date x-axes) + 2 tables; matching-health cards (null → "—"), tier-breakdown
bar, coverage table; per-user "Quiz activity" section with empty state; "Analytics" under
the admin Quiz nav; loading / empty / error states; responsive; a11y labels; clean typed
code; tsc + eslint + `next build` green. Runtime click-through in §4 remains, pending data.

## 6. Completes the feature

After Phase 5 the quiz feature is end-to-end: player (0–2b) + the full admin console
(moderation, generation, analytics, matching-health, per-user). Nothing in the backend
doc is left unconsumed.
