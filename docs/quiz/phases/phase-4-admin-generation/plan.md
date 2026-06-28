# Phase 4 — Admin: Generation Observability

> A staff dashboard for the nightly question-generation job: **is it healthy,
> what's it costing, and how well is it covering content vs transcript?** Plus a
> per-batch drill-down.
>
> Extends the Phase 3 admin-quiz data layer. See [`../../main-plan.md`](../../main-plan.md).

---

## 1. Goal

Answer three questions at a glance, for a chosen time window:
- **Health** — how many batches ran, how many completed / failed / are stuck.
- **Cost** — tokens + dollar cost, average duration.
- **Coverage** — content-grounded vs transcript-fallback ratio.

…then let an admin drill into any batch to see its tokens, error, source
conversation, and the questions it produced.

## 2. Access

Lives under `app/(admin)/admin/quiz/...` → already gated to **admin/superadmin**
by the `(admin)` layout's `AdminGuard`. No extra guard.

## 3. API surface

Auth: Bearer + `role:admin`. Decimal fields (`token_cost`, `total_cost`) are
**JSON strings** → `parseFloat`. Plain numbers elsewhere.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/quiz/batches` | List batches (paginated). Filters: `user_id`, `status`, `source_mode`, `date_from`, `date_to`, `per_page` |
| `GET` | `/admin/quiz/batches/{uuid}` | One batch + token breakdown + its questions |
| `GET` | `/admin/quiz/batches/summary` | Period-aware totals + coverage |

**`status`** ∈ `queued | running | completed | failed | skipped`.
**`source_mode`** ∈ `content | transcript`.

**Summary is period-aware** (the contract backend documented):
`period` ∈ `today, last_24_hours, date, this_week, last_7_days, this_month,
last_30_days (default), date_range`; `date` for `period=date`;
`start_date`+`end_date` for `period=date_range` (≤366 days). Granularity is
server-derived; summary doesn't echo it.

> ⚠️ **`date_from` / `date_to` are for the batch *list* only** — **not** the
> summary. The summary uses the `period` params above. Two different controls.

## 4. Data layer (extends Phase 3's admin-quiz files)

| File | Add |
|---|---|
| `types/admin-quiz.ts` | `QuizBatchStatus`, `AdminQuizBatchListItem`, `AdminQuizBatchDetail`, `AdminQuizBatchSummary`, `AdminQuizBatchListParams`, `AdminQuizPeriodParams` (shared, reused in Phase 5), + response envelopes |
| `lib/api/admin-quiz.ts` | `listBatches`, `getBatch`, `getBatchSummary` |
| `lib/hooks/useAdminQuiz.ts` | `useAdminQuizBatches`, `useAdminQuizBatch`, `useAdminQuizBatchSummary` (+ keys) |
| `lib/utils/quiz-format.ts` | `formatTokenCost` (parse string → e.g. `$0.0123`) helper |

### Shapes (from the doc)
- **Batch row:** `uuid`, `user {id,name}`, `source_mode`, `status`,
  `questions_generated`, `total_tokens`, `token_cost` (string), `duration_ms`,
  `started_at`, `completed_at`, `created_at`, `error`.
- **Batch detail:** the row + `source_conversation {id,uuid}`, `prompt_tokens`,
  `completion_tokens`, `classifier_request_id`, and `questions[]`
  (`uuid`, truncated `question_text`, `difficulty`, `topic`, `status`).
- **Summary:** `period {start,end}`, `totals { batches, completed, failed,
  running, skipped, stuck_now, success_rate, questions_generated, total_tokens,
  total_cost (string), avg_duration_ms }`, `coverage { content, transcript,
  content_ratio }`.

## 5. Screens

### 5.1 Overview — `/admin/quiz/generation`
Two stacked sections in a `Card` layout:

```
┌ Generation ─────────────────────  [ Last 30 days ▾ ] ┐   ← period selector (summary only)
│  [ Batches 12 ] [ Success 92% ] [ Questions 120 ]     │   ← summary stat cards
│  [ Tokens 240k ] [ Cost $1.48 ] [ Avg 58s ] [ Stuck 0 ]│
│  Coverage: ▓▓▓▓▓▓░░░░  60% content · 40% transcript     │   ← coverage bar
└────────────────────────────────────────────────────────┘

┌ Batches ───────────────────────────────────────────────┐
│ [ status ▾ ] [ source ▾ ] [ from ] [ to ]      [Clear]  │   ← batch-list filters (date_from/to)
│ User        Source   Status    Q's  Tokens  Cost   When ⋯│
│ Jane Doe    content  completed  10   2,000  $0.01  2h ›   │
│ …                                                         │
│ Showing 1–15 of 42        ‹ Page 1 of 3 ›                │
└──────────────────────────────────────────────────────────┘
```
- **Summary cards** follow the admin analytics card style; `stuck_now > 0` is
  highlighted (amber) since a reconciler should clear them. `success_rate` and
  `content_ratio` are plain-number %s.
- **Coverage** as a slim two-segment bar (content vs transcript) + labels.
- **Batches table**: status badge (queued/running/completed/failed/skipped),
  source badge, `questions_generated`, `total_tokens`, `formatTokenCost`,
  duration, relative date; an `error` row gets a subtle warning marker. Row → batch
  detail.
- States: loading skeletons (cards + table), empty ("no batches in range"), error.

### 5.2 Batch detail — `/admin/quiz/generation/[uuid]`
- **Header**: status badge + source badge + created/started/completed.
- **Stats**: total / prompt / completion tokens, cost, duration, questions_generated.
- **Provenance**: `source_conversation` link, `classifier_request_id`.
- **Error** (if any): a destructive-styled panel with the message.
- **Questions produced**: a compact list (text + difficulty + topic + status),
  each linking to `/admin/quiz/questions/{uuid}` (reuses Phase 3 detail).

## 6. Files

```
types/admin-quiz.ts                              EDIT  batch + period types
lib/api/admin-quiz.ts                            EDIT  listBatches/getBatch/getBatchSummary
lib/hooks/useAdminQuiz.ts                        EDIT  batch hooks
lib/utils/quiz-format.ts                         EDIT  formatTokenCost

components/admin/quiz/AdminQuizPeriodSelect.tsx       NEW  named-range period dropdown (reused in P5)
components/admin/quiz/AdminQuizBatchStatusBadge.tsx   NEW  queued/running/completed/failed/skipped
components/admin/quiz/AdminQuizGenerationSummary.tsx  NEW  period selector + cards + coverage
components/admin/quiz/AdminQuizBatchesTable.tsx       NEW  filterable batches table
components/admin/quiz/AdminQuizBatchesFilters.tsx     NEW  status/source/date filters
components/admin/quiz/AdminQuizBatchDetail.tsx        NEW  batch drill-down

app/(admin)/admin/quiz/generation/page.tsx           NEW  overview (Suspense + URL filters)
app/(admin)/admin/quiz/generation/[uuid]/page.tsx    NEW  batch detail

components/admin/admin-nav-quiz.tsx              EDIT  add "Generation" nav item
```
Reuses: `AdminPagination`, `Card`, `Table`, `Select`, `useDebounce`,
`DifficultyBadge`, the Phase-3 `AdminQuizStatusBadge` (for question rows), sonner +
`extractApiError`.

## 7. Conventions & gotchas

- **Decimals are strings** (`token_cost`, `total_cost`) → `parseFloat` / `formatTokenCost`.
- **`stuck_now`** = batches stuck `running` past the stale threshold *right now*; a
  reconciler clears them — surface it but don't alarm (amber, not red).
- **Two date controls, don't mix them**: summary = `period` params; batch list =
  `date_from`/`date_to`. The page keeps them independent (period in summary state,
  date range in the table's URL filters).
- **No polling** — generation runs nightly; this is a read-only snapshot. (A manual
  refetch button is enough if we want freshness.)
- **Period selector v1** offers the named ranges (default `last_30_days`); custom
  `date` / `date_range` pickers can be a later add — flagged, not built.

## 8. Build order

1. Types + api + hooks + `formatTokenCost` (plumbing).
2. `AdminQuizPeriodSelect` + `AdminQuizBatchStatusBadge` + `AdminQuizGenerationSummary`.
3. `AdminQuizBatchesFilters` + `AdminQuizBatchesTable` + the overview page.
4. `AdminQuizBatchDetail` + the detail page.
5. "Generation" nav item.
6. Verify: `tsc` + `eslint` + **`next build`** (mandatory before push).
7. `post-implementation.md`.

## 9. Definition of Done

- [ ] Overview: period-aware summary cards + coverage, and a filterable, paginated
      batches table; the two date controls are independent.
- [ ] Batch detail: tokens/cost/duration, provenance, error, and its questions
      (linking to Phase-3 question detail).
- [ ] "Generation" appears under the admin Quiz nav section.
- [ ] Loading / empty / error states; responsive; a11y; string-decimals parsed.
- [ ] Clean code (no `any`/`@ts-ignore`/`TODO`); `tsc` + `eslint` + `next build` green.

## 10. Out of scope → Phase 5

Usage analytics, matching-health, and the per-user quiz tab (the remaining
period-aware dashboards) are Phase 5.
