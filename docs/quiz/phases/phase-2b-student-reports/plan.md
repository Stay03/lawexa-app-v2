# Phase 2b — Student Reports ("My stats")

> A player-facing progress view, enabled by the new backend endpoint
> `GET /api/quizzes/stats` (shipped 2026-06-28). This is the "reports for students"
> we asked backend for. Player-side; **clean, intuitive, sleek** is the bar.
>
> Slots in after Phase 2 (player). See [`../../main-plan.md`](../../main-plan.md).

---

## 1. Goal

A single, polished `/quiz/stats` screen showing the student their own progress:
headline numbers, a score-trend chart, and lifetime totals. No new player concepts
— just surface what `/quizzes/stats` returns, beautifully.

## 2. Access

Lives under `app/(main)/quiz/...`, so the `QuizGuard` already gates it to the
soft-launch roles (researcher / admin / superadmin) — same as the rest of the player.
Verified-email required by the backend (same `403` rule); handled like other player calls.

## 3. Data (`GET /api/quizzes/stats`)

`data.sessions` (total/active/completed/abandoned, last_active_at, served/answered/
correct), `data.performance` (avg_score, accuracy, avg_time_per_question_ms,
score_trend = last 10 ended sessions `{completed_at, score_percentage}`),
`data.engagement` (completed, auto_abandoned, completion_rate).

**Gotcha:** these aggregates are **plain numbers** (not the string-decimal
convention), and any of `avg_score` / `accuracy` / `completion_rate` /
`avg_time_per_question_ms` may be `null`, and `score_trend` may be `[]`, before
there's data.

## 4. Plumbing

| File | Change |
|---|---|
| `types/quiz.ts` | + stats types (`QuizStatsData`, `QuizStatsResponse`, `QuizScoreTrendPoint`, …) |
| `lib/api/quiz.ts` | + `quizApi.getStats()` → `GET /quizzes/stats` |
| `lib/hooks/useQuiz.ts` | + `quizKeys.stats()` + `useQuizStats()` (staleTime 60s) |

## 5. Screen — `/quiz/stats`

```
Your progress
Practice stats across all your sessions.

┌ Avg score ┐ ┌ Accuracy ┐ ┌ Completion ┐ ┌ Avg time ┐   ← 4 stat cards (responsive grid)
│   67%     │ │   67%    │ │    67%      │ │   12s    │
└───────────┘ └──────────┘ └─────────────┘ └──────────┘

┌ Score over time ───────────────────────────────────────┐
│   ╱╲      ╱                                              │  ← recharts Area (last 10), gradient fill
│  ╱  ╲╱╲╱                                                 │
└──────────────────────────────────────────────────────────┘

┌ Sessions ───────────────┐  ┌ Questions answered ─────────┐
│ 5 total                 │  │ 18 / 20 answered            │
│ 3 done · 1 abandoned ·  │  │ 12 correct                  │
│ 1 in progress           │  │ last active 2d ago          │
└─────────────────────────┘  └─────────────────────────────┘
```

- **Stat cards** (`QuizStatCard`): label + big tabular number; avg-score & accuracy
  tinted by score band (reuse `scoreBandClasses`); avg time via `formatDurationMs`;
  `null` → "—".
- **Score-trend chart** (`QuizScoreTrendChart`): recharts `AreaChart` via the shadcn
  `ChartContainer`, `var(--chart-1)` + gradient fill, Y fixed `0–100%`, X = dates,
  tooltip shows "Md, Yyyy · 75%". Mirrors the existing admin "over time" charts.
- **Breakdown cards**: session lifecycle counts + lifetime served/answered/correct.
- **States**: loading skeleton; **empty** (no sessions / empty trend) → friendly
  "No stats yet — finish a quiz to see your progress" + Start CTA; error + retry.
- **Entrances**: subtle `animate-in fade-in`, staggered cards, `motion-reduce` safe.

## 6. Wiring (entry points)

- **Start** (`QuizStart`): add a "Your stats" link (when the user has history).
- **History** (`QuizHistory`): add a "Stats" link in the header next to "Practice".
- Breadcrumb auto-reads "Quiz / Stats".

## 7. Files

```
types/quiz.ts                          EDIT  stats types
lib/api/quiz.ts                        EDIT  getStats
lib/hooks/useQuiz.ts                   EDIT  stats key + useQuizStats
components/quiz/QuizStats.tsx          NEW   orchestrator + states
components/quiz/QuizStatCard.tsx       NEW   stat card
components/quiz/QuizScoreTrendChart.tsx NEW  recharts area chart
app/(main)/quiz/stats/page.tsx         NEW   route
components/quiz/QuizStart.tsx          EDIT  "Your stats" link
components/quiz/QuizHistory.tsx        EDIT  "Stats" header link
```

## 8. Definition of Done

- [ ] `/quiz/stats` renders cards + trend chart + breakdown from real data.
- [ ] Designed loading / empty / error states; nulls render as "—" not "NaN%".
- [ ] Responsive (cards reflow; chart fills width); a11y; `motion-reduce` safe.
- [ ] Entry points from Start + History; breadcrumb "Quiz / Stats".
- [ ] Clean code (no `any`/`@ts-ignore`/`TODO`); `tsc` + `eslint` + `next build` green.
