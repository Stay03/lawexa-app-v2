# Phase 2 — Player Polish

> Finish the player experience: a **History** screen for past sessions, wired into
> the existing flow. Most of what the master plan filed under Phase 2 already
> shipped during the Phase 1 fixes (see §1), so this phase is small and focused.
>
> Builds on the Phase 0 data layer (`useInfiniteQuizSessions` already exists). See
> [`../../main-plan.md`](../../main-plan.md).

---

## 1. Already shipped (don't rebuild)

These Phase 2 items landed while fixing Phase 1, so they're **done**:

| Item | Where | Commit |
|---|---|---|
| Role-gated **sidebar "Quiz" link** | [`components/layout/app-sidebar.tsx`](../../../../components/layout/app-sidebar.tsx) | `c98d371` |
| **Topic picker** (chips on Start) | [`components/quiz/QuizTopicChips.tsx`](../../../../components/quiz/QuizTopicChips.tsx) | Phase 1 |
| **Edge cases** (cold-start, 409, 422, ended) | `QuizPlayer` | Phase 1 |
| **Verify-email** handling (+ OAuth fix) | `QuizStart` | Phase 1, `5432c33` |
| **Breadcrumb** relabel on results | results page | Phase 1 |

The topic picker is already sufficient for the soft launch — **no "richer picker"
work** unless we later want filtering/search. Not in this phase.

## 2. Remaining scope (this phase)

**The History screen + wiring it in, plus surfacing the timing data we already
fetch.**

- A `/quiz/history` screen listing past sessions (newest first, infinite scroll).
- Entry points to reach it (from Start and Results).
- The small shared bits it needs (a session-status badge + format helpers).
- **Timing enrichment (LOCKED in):** the results payload carries `time_spent_ms`
  per answered question, which we currently type but never show. Surface it:
  - a per-question **time chip** in `QuizResultItemCard`,
  - an "avg ~Xs/question · took Ym" line in `QuizResultsSummary` (avg from
    `sum(time_spent_ms)/answered`; duration from `started_at → completed_at`),
  - session **duration** on each `QuizHistoryItem` row.
  All client-derived from data we already have — no new API calls.

## 3. Screen — History (`/quiz/history`)

Uses `useInfiniteQuizSessions()` (Phase 0) + `useIntersectionObserver` (the same
infinite-scroll pattern as the notes/cases lists). Guarded automatically by the
`(main)/quiz` layout's `QuizGuard`.

```
┌──────────────────────────────────────────────┐
│  Quiz history                   [ ▷ Practice ]│  ← title + Start CTA
│  Your past practice sessions                   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 〔In progress〕   6 answered        →  │   │  ← active → Resume (/quiz/play?s=)
│  │ Started 26 Jun                         │   │
│  ├──────────────────────────────────────┤   │
│  │ 〔Completed〕  33%   2 / 6 correct  →  │   │  ← → results
│  │ 26 Jun                                 │   │
│  ├──────────────────────────────────────┤   │
│  │ 〔Abandoned〕  50%   3 / 6 correct  →  │   │  ← → results
│  │ 25 Jun                                 │   │
│  └──────────────────────────────────────┘   │
│              ⟳ (loads more on scroll)         │
└──────────────────────────────────────────────┘
```

**Each row** (`QuizHistoryItem`):
- A **status badge**: `In progress` (active, primary/amber), `Completed`
  (emerald/secondary), `Abandoned` (muted).
- **Score** for sessions with answers — `formatScorePercent`, band-coloured; plus
  `correct / answered`. Sessions with no answers show "—".
- **Date** — `completed_at` if present, else `started_at` (`formatSessionDate`).
- The whole row is a **`Link`**:
  - `active` → `/quiz/play?s={uuid}` (resume), trailing label "Resume".
  - `completed` / `abandoned` → `/quiz/{uuid}/results`.

**States:**
| State | Treatment |
|---|---|
| Loading | `QuizHistorySkeleton` (≈5 row skeletons) |
| Empty (no sessions) | `QuizMessage`: "No sessions yet — start practising" + Start CTA |
| Loading more | small centered spinner at the sentinel (existing pattern) |
| End of list | nothing (sentinel stops fetching when `!hasNextPage`) |
| Error | `QuizMessage` + Retry |

## 4. Wiring (entry points)

- **Start screen** ([`QuizStart`](../../../../components/quiz/QuizStart.tsx)): add a
  subtle "View past sessions →" text link, shown only when the user has ≥1 session
  (we already fetch the newest via `useQuizSessions({ per_page: 1 })`).
- **Results screen** ([`QuizResultsSummary`](../../../../components/quiz/QuizResultsSummary.tsx)):
  add a "View history" action alongside "Practice again" so review → history flows.
- **Breadcrumb**: `/quiz/history` auto-renders as "Quiz / History" — no override
  needed.
- **Sidebar**: keep the single "Quiz" link → `/quiz`; history stays an in-app
  destination (no new sidebar entry for the soft launch).

## 5. Files

```
app/(main)/quiz/history/page.tsx          NEW  renders <QuizHistory/> (client)
components/quiz/QuizHistory.tsx            NEW  orchestrator: infinite list + states
components/quiz/QuizHistoryItem.tsx        NEW  one session row (Link, with duration)
components/quiz/QuizSessionStatusBadge.tsx NEW  status pill
components/quiz/QuizHistorySkeleton.tsx    NEW  loading skeleton

components/quiz/QuizStart.tsx              EDIT add "View past sessions" link
components/quiz/QuizResultsSummary.tsx     EDIT add duration + avg-time line, "View history"
components/quiz/QuizResultItemCard.tsx     EDIT add per-question time chip
components/quiz/QuizResults.tsx            EDIT compute avg time, pass to summary
lib/utils/quiz-format.ts                   EDIT status meta + formatDurationMs + sessionDurationMs
```

All data via Phase 0 hooks — no component touches `apiClient` or redefines a type.

## 6. Accessibility

- Rows are real `Link`s (keyboard focusable, focus-visible rings).
- Status is conveyed by **text label** (not colour alone); the badge colour is
  decorative.
- The infinite-scroll sentinel is `aria-hidden`; a polite "loading more" is fine to
  omit (visual spinner suffices), matching the existing lists.

## 7. Build order

1. `lib/utils/quiz-format.ts` status helper + `QuizSessionStatusBadge`.
2. `QuizHistoryItem` (presentational, eyeball-able).
3. `QuizHistory` (infinite scroll + states) + `QuizHistorySkeleton` + the page.
4. Wire entry points (Start, Results).
5. Verify: responsive + a11y sweep, `tsc --noEmit`, `eslint`, **and a full
   `next build`** (mandatory before pushing — Phase 1 taught us tsc/eslint don't
   catch prerender errors).
6. Write `post-implementation.md`.

## 8. Definition of Done

- [ ] `/quiz/history` lists sessions, infinite-scrolls, links each to the right
      destination (results vs resume).
- [ ] Loading / empty / error / loading-more states all designed.
- [ ] Entry points from Start and Results work; breadcrumb reads "Quiz / History".
- [ ] Responsive (mobile rows stack cleanly); a11y (links, focus, colour-independent).
- [ ] Clean code: no `any` / `@ts-ignore` / `TODO`; all data via Phase 0 hooks.
- [ ] `tsc --noEmit` 0 errors · `eslint` clean · **`next build` exits 0** before push.

## 9. Out of scope / deferred

- Richer topic picker (search/filter), session deletion, per-topic stats → not now.
- Admin console (`/admin/quiz/*`) → Phases 3–5.
- Independent of this phase: still need to **confirm the `POST /end` response
  envelope** against the live API (the Phase 0 assumption) during a click-through.
