# Phase 4 — Post-Implementation

**Status:** ✅ Code complete · build-verified · ⏳ live click-through pending · **Date:** 2026-06-28

Generation-observability dashboard. How it shipped vs [`plan.md`](./plan.md), and verification.

---

## 1. What shipped

**Plumbing (extends Phase 3's admin-quiz files):**
| File | Added |
|---|---|
| `types/admin-quiz.ts` | `QuizBatchStatus`, `AdminQuizPeriod`/`AdminQuizPeriodParams`, batch list/detail/summary types + envelopes |
| `lib/api/admin-quiz.ts` | `listBatches`, `getBatch`, `getBatchSummary` |
| `lib/hooks/useAdminQuiz.ts` | `useAdminQuizBatches`, `useAdminQuizBatch`, `useAdminQuizBatchSummary` (+ keys) |
| `lib/utils/quiz-format.ts` | `formatTokenCost`, `difficultyLabel` |

**Components (6, `components/admin/quiz/`):** `AdminQuizPeriodSelect`,
`AdminQuizBatchStatusBadge`, `AdminQuizGenerationSummary`, `AdminQuizBatchesFilters`,
`AdminQuizBatchesTable`, `AdminQuizBatchDetail`.

**Pages (2):** `app/(admin)/admin/quiz/generation/{page, [uuid]/page}.tsx`.

**Edit:** `components/admin/admin-nav-quiz.tsx` (adds the "Generation" item).

## 2. Key decisions

1. **Two independent date controls** (the doc's warning): the summary owns its own
   `period` state (named-range `AdminQuizPeriodSelect`); the batches table uses
   URL-driven `date_from`/`date_to`. They never share state.
2. **String decimals parsed** — `token_cost` / `total_cost` go through
   `formatTokenCost` (→ `$0.0123` / `$1.48`); plain-number stats shown directly.
3. **`stuck_now` / `failed` highlighted amber** when non-zero — visible but not alarming.
4. **Coverage** as a slim two-segment bar (content vs transcript) + counts.
5. **`difficultyLabel` helper** — the batch's question refs omit `difficulty_label`,
   so we derive "Very Easy…Very Hard" from the level. Reusable.
6. **Batch questions link into Phase-3 detail** (`/admin/quiz/questions/{uuid}`), and
   the source conversation links into the existing admin conversation page.
7. **No polling / no selection** — read-only snapshot of a nightly job.

## 3. Deviations from the plan

None. Period selector ships with named ranges (custom `date`/`date_range` deferred,
as planned).

## 4. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint` (all P4 files) | **clean** |
| `npm run build` | **exit 0**, 107/107 pages; `/admin/quiz/generation` (○) + `[uuid]` (ƒ) |
| `any` / `@ts-ignore` / `TODO` scan | none |

### Still to do (runtime — needs an admin login + real batches)
- [ ] Click-through: period summary updates, batch filters + pagination, open a
      batch, follow a produced question into its moderation page.

## 5. Out of scope → Phase 5

Usage analytics, matching-health, and the per-user quiz tab (the remaining
period-aware dashboards). The shared `AdminQuizPeriodSelect` / period types are
ready for them.

## 7. Follow-up fix (2026-06-28)

Live `/admin/quiz/generation` crashed (`Cannot read properties of null (reading
'toLocaleString')`) — a queued/running/failed batch returns `null` for
`total_tokens` / `questions_generated` / `token_cost`, but the type marked them
non-null. Fixed: those fields (+ detail's `prompt_tokens`/`completion_tokens`) are
now `| null`, rendered through a new `formatCount` helper (null → "—").

## 6. Definition of Done status

All static-quality DoD items met (period-aware summary + coverage; filterable,
paginated batches; batch detail with tokens/cost/error/provenance + produced
questions; new gated nav item; loading/empty/error states; string-decimals parsed;
clean typed code; tsc + eslint + `next build` green). Runtime click-through in §4
remains, pending data.
