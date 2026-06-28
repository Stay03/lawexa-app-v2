# Phase 5 — Admin: Analytics, Matching-Health & Per-User

> The final slice: the usage **analytics** dashboard, the **matching-health**
> monitor, and a **per-user quiz** section on the admin user page. Completes the
> quiz feature.
>
> Extends the Phase 3/4 admin-quiz data layer; reuses the Phase 4
> `AdminQuizPeriodSelect` + period types. See [`../../main-plan.md`](../../main-plan.md).

---

## 1. Goal

- **Usage analytics** — how much is Quiz Mode used, and how are students doing?
- **Matching-health** — is cross-user question matching actually firing?
- **Per-user** — one student's quiz life, on their admin profile page.

## 2. Access

Analytics pages live under `app/(admin)/admin/quiz/...` (AdminGuard). The per-user
section lives on the existing `admin/users/[uuid]` page, already admin-only.

## 3. API surface

Auth: Bearer + `role:admin`. Per the doc, usage + matching-health are the two
dashboards behind `/admin/quiz/analytics`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/quiz/analytics` | Period-aware usage dashboard (stat cards + charts + tables) |
| `GET` | `/admin/quiz/matching-health` | Period-aware serve stats + all-time bank/topic coverage |
| `GET` | `/admin/users/{user_uuid}/quiz` | One student's quiz profile (`404` if unknown) |

Both dashboards take the **shared period params** (Phase 4): `period` named ranges
(default `last_30_days`), `date`, `start_date`/`end_date`.

### Shapes (from the doc)
- **Analytics**: `period {start,end,comparison_start,comparison_end}`,
  `granularity`, `stat_cards` (each `{ value, change_percent }`, `change_percent`
  null with no baseline): `sessions_started`, `active_users`, `completed_sessions`,
  `abandoned_sessions`, `completion_rate`, `avg_score`, `avg_time_per_question_ms`;
  `charts.sessions_over_time [{date,count}]`, `charts.avg_score_over_time
  [{date,avg_score}]`; `tables.top_topics [{topic_key,topic,serves}]`,
  `tables.score_distribution [{bucket,count}]`.
- **Matching-health**: `period {start,end}`, `stat_cards { total_serves,
  tier2_cross_user_rate, recycle_rate, own_rate, bank_size, topic_coverage,
  cross_user_topics }` (rates **null** when no serves), `tier_breakdown { own,
  same_topic_other, widened_own, widened_other, recycled }`, `topic_coverage
  [{topic_key, topic, questions, contributors, cross_user}]`.
- **Per-user**: `sessions {…}`, `performance { avg_score,
  avg_time_per_question_ms, score_trend }` — note `score_trend` here is a plain
  **number[]** (not `{completed_at,score_percentage}` like the student endpoint);
  `engagement {…}`, `generation { questions, batches, completed_batches,
  failed_batches, total_cost (string), topics[] }` (admin-only cost),
  `topics_quizzed { distinct, reached_via_cross_user }`.

> ⚠️ **Chart date gotcha** (backend's heads-up): when `granularity === 'hour'`,
> the charts' `date` is an **integer hour index** (e.g. `1`), not a timestamp;
> `day` granularity uses `YYYY-MM-DD`. The page formats the x-axis off the echoed
> `granularity` (mirrors the existing admin `UserGrowthChart`).

## 4. Data layer (extends admin-quiz)

| File | Add |
|---|---|
| `types/admin-quiz.ts` | `AdminQuizStatCard {value, change_percent}`, `AdminQuizAnalytics`, `AdminQuizMatchingHealth`, `AdminUserQuizProfile` + response envelopes |
| `lib/api/admin-quiz.ts` | `getAnalytics(period)`, `getMatchingHealth(period)`, `getUserQuizProfile(userUuid)` |
| `lib/hooks/useAdminQuiz.ts` | `useAdminQuizAnalytics`, `useAdminQuizMatchingHealth`, `useAdminUserQuizProfile` |

## 5. Screens

### 5.1 Analytics — `/admin/quiz/analytics`
One page, **one period selector** at the top driving both dashboards.

```
Analytics                                   [ Last 30 days ▾ ]

── Usage ───────────────────────────────────────────────────
[ Sessions 42 ▲12% ] [ Active users 18 ▲5% ] [ Completed 30 ] [ Abandoned 6 ]
[ Completion 83% ]   [ Avg score 64% ]       [ Avg time 12s ]
┌ Sessions over time ──────┐  ┌ Avg score over time ─────┐
│   ▁▂▅▇▅▃                  │  │   ╱╲___╱                  │
└──────────────────────────┘  └───────────────────────────┘
┌ Top topics ──────────────┐  ┌ Score distribution ──────┐
│ Criminal Law      120     │  │ 0-20 ▏ 60-80 ▇ 80-100 ▅  │
└──────────────────────────┘  └───────────────────────────┘

── Matching health ─────────────────────────────────────────
[ Serves 8 ] [ Cross-user 25% ] [ Recycle 25% ] [ Own 50% ]
[ Bank 5 ]   [ Topics 2 ]       [ Cross-user topics 1 ]
Tier breakdown:  own ▇▇▇ · same-topic ▇ · widened · recycled ▇
Topic coverage table: topic | questions | contributors | cross-user ✓
```
- **Usage stat cards**: value + a **delta badge** from `change_percent`
  (↑ green / ↓ red / "—" when null) — mirrors the admin `AnalyticsStatCards`/
  `ChangePercentBadge` pattern.
- **Charts**: recharts via `ChartContainer` — `sessions_over_time` (bar/area),
  `avg_score_over_time` (line, 0–100%). X-axis formatted by `granularity`
  (hour-index vs date).
- **Tables**: top topics (topic + serves); score distribution (bucket bars).
- **Matching health**: its own stat cards (rates show "—" when null), a compact
  **tier-breakdown** bar/list, and a **topic-coverage** table (topic, questions,
  contributors, cross-user badge). `tier2_cross_user_rate` is the headline.

### 5.2 Per-user quiz — on `admin/users/[uuid]`
A new **"Quiz activity"** section/card added to the existing user detail page
(stacked-sections layout, not tabs):
- **Sessions** (total / completed / abandoned / active, last active, served/answered/correct).
- **Performance** (avg score, accuracy via correct÷answered, avg time) + a small
  **sparkline** from `score_trend` (number[], index-based x).
- **Generation** (questions, batches, completed/failed, **total cost**, topics).
- **Topics quizzed** (distinct, "reached via cross-user" badge).
- Renders an empty hint when the user has no quiz activity (sessions.total = 0).

## 6. Files

```
types/admin-quiz.ts                              EDIT  analytics + matching + per-user types
lib/api/admin-quiz.ts                            EDIT  getAnalytics/getMatchingHealth/getUserQuizProfile
lib/hooks/useAdminQuiz.ts                        EDIT  three hooks

components/admin/quiz/AdminQuizStatCard.tsx           NEW  value + change_percent delta badge
components/admin/quiz/AdminQuizSessionsChart.tsx      NEW  sessions_over_time
components/admin/quiz/AdminQuizAvgScoreChart.tsx      NEW  avg_score_over_time
components/admin/quiz/AdminQuizTopTopicsTable.tsx     NEW  top topics
components/admin/quiz/AdminQuizScoreDistribution.tsx  NEW  bucket bars
components/admin/quiz/AdminQuizUsageSection.tsx       NEW  cards + charts + tables
components/admin/quiz/AdminQuizMatchingSection.tsx    NEW  cards + tier breakdown + coverage table
components/admin/quiz/AdminUserQuizSection.tsx        NEW  per-user profile card

app/(admin)/admin/quiz/analytics/page.tsx            NEW  period selector + both sections
components/admin/admin-nav-quiz.tsx              EDIT  add "Analytics" item
app/(admin)/admin/users/[uuid]/page.tsx          EDIT  mount <AdminUserQuizSection uuid={uuid}/>
```
Reuses: `AdminQuizPeriodSelect` (P4), `ChartContainer` + recharts, `Card`, `Table`,
`Badge`, `DifficultyBadge`, `formatDurationMs` / `formatTokenCost` / `formatCount`.

## 7. Conventions & gotchas

- **`change_percent` may be null** → render "—" (no baseline), not "0%".
- **Rates may be null** (matching-health, no serves in period) → "—".
- **Chart x-axis depends on `granularity`** (hour-index vs `YYYY-MM-DD`).
- **Per-user `score_trend` is `number[]`** (different from the student stats shape).
- **Decimal strings**: per-user `generation.total_cost` → `formatTokenCost`.
- **No polling** — period-aware snapshots; a manual refetch is enough.

## 8. Build order

1. Types + api + hooks (plumbing).
2. `AdminQuizStatCard` (delta) + the two charts + the two tables.
3. `AdminQuizUsageSection` + `AdminQuizMatchingSection` + analytics page + nav item.
4. `AdminUserQuizSection` + mount on the user detail page.
5. Verify: `tsc` + `eslint` + **`next build`**.
6. `post-implementation.md`.

## 9. Definition of Done

- [ ] Analytics page: period-driven usage cards (with deltas) + 2 charts + 2 tables,
      and the matching-health section (cards + tier breakdown + coverage table).
- [ ] Charts handle both hour-index and date x-axes; nulls render as "—".
- [ ] Per-user "Quiz activity" section on the user page; empty state when no activity.
- [ ] "Analytics" appears under the admin Quiz nav.
- [ ] Loading / empty / error states; responsive; a11y.
- [ ] Clean code (no `any`/`@ts-ignore`/`TODO`); `tsc` + `eslint` + `next build` green.

## 10. Completes the feature

After Phase 5, the quiz feature is end-to-end: player (0–2b) + the full admin
console (moderation, generation, analytics, matching-health, per-user). Nothing in
the backend doc is left unconsumed.
