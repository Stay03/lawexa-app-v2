# Phase 2 — Post-Implementation

**Status:** ✅ Code complete · build-verified · ⏳ live click-through pending · **Date:** 2026-06-28

What shipped for the History screen + timing enrichment, how it differed from
[`plan.md`](./plan.md), and how it was verified.

---

## 1. What shipped

**New (5):**
| File | Summary |
|---|---|
| `app/(main)/quiz/history/page.tsx` | `/quiz/history` route → `<QuizHistory/>` |
| `components/quiz/QuizHistory.tsx` | Infinite-scroll list + loading/empty/error states |
| `components/quiz/QuizHistoryItem.tsx` | One session row (status, score, counts, date + duration); links to resume/review |
| `components/quiz/QuizSessionStatusBadge.tsx` | In progress / Completed / Abandoned pill |
| `components/quiz/QuizHistorySkeleton.tsx` | Loading placeholder |

**Edited (5):**
| File | Change |
|---|---|
| `lib/utils/quiz-format.ts` | + `formatDurationMs`, `sessionDurationMs`, `sessionStatusMeta` |
| `components/quiz/QuizResultItemCard.tsx` | Per-question time chip (⏱ from `time_spent_ms`) |
| `components/quiz/QuizResultsSummary.tsx` | "Took Ym · ~Xs/question" line; "Done" → "View history" |
| `components/quiz/QuizResults.tsx` | Computes avg answer time, passes to summary |
| `components/quiz/QuizStart.tsx` | "View past sessions →" link when the user has history |

Plus the master/phase docs updated.

## 2. Key implementation decisions

1. **Infinite scroll mirrors the notes list** — `useInfiniteQuizSessions` (Phase 0)
   + `useIntersectionObserver` sentinel + an effect that calls `fetchNextPage`. The
   effect calls a function (not setState), so it's React-Compiler clean.
2. **exhaustive-deps fixed properly, not suppressed.** The lint wanted the whole
   `query` object; instead we destructure `{ hasNextPage, isFetchingNextPage,
   fetchNextPage }` and depend on those — clean and stable, no `eslint-disable`.
3. **All timing is client-derived** from data we already fetch: per-question
   `time_spent_ms`, avg = `sum(time_spent_ms)/answered`, session duration =
   `completed_at − started_at`. No new API calls.
4. **Row destination by status:** `active` → `/quiz/play?s=` (resume), finished →
   `/quiz/{uuid}/results` (review).

## 3. Deviations from the plan

| Planned | Shipped | Why |
|---|---|---|
| Results CTAs: "Practice again" + "Done" | "Practice again" + **"View history"** | History is the more useful second action; home is one tap away via the sidebar. |

No other deviations.

## 4. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint` (all Phase 2 files) | **clean** — the one exhaustive-deps warning was fixed, not disabled |
| `npm run build` (`next build`) | **exit 0**, 104/104 pages prerendered, incl. `/quiz/history` (○ Static) |
| `any` / `@ts-ignore` / `TODO` scan | none |

### Still to do (runtime — needs live data)
- [ ] Click-through: play a session → end → results (see time chips + avg) → "View
      history" → resume an in-progress one.
- [ ] Confirm the `POST /end` envelope (carried over from Phase 0).

## 5. Follow-ups

- **Student stats / reports** depend on a backend addition — request tracked in
  memory (`project_student_quiz_stats_request`). Not buildable from the current
  student API.
- Admin console (`/admin/quiz/*`) → Phases 3–5.

## 6. Definition of Done status

All static-quality DoD items met (designed states, responsive, a11y, clean typed
code, tsc + eslint + `next build` all green). The two runtime items in §4 remain,
pending a live session.
