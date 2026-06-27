# Phase 0 — Foundation

> The plumbing every other phase stands on. **No UI, no pages, no routes.** When
> this phase is done, building the player (Phase 1) is just wiring screens to
> ready-made, fully-typed hooks behind a ready-made access gate.

See the big picture in [`../../main-plan.md`](../../main-plan.md).

---

## 1. Goal

Create the **data layer for the Quiz player** plus the **access gate** that keeps
the in-development feature hidden from regular users:

- Typed API calls for all 7 student endpoints.
- React Query hooks (reads + writes) with sensible caching.
- A reusable role check + a route guard so only `researcher` / `admin` /
  `superadmin` can reach the player.

## 2. Scope

**In scope (this phase):**

| Area | Why it's foundation |
|---|---|
| Student types | Every player screen imports these. |
| Student API service | One typed function per endpoint. |
| Student React Query hooks | Screens never call axios directly. |
| Role helper + `QuizGuard` | The soft-launch gate, reused by the guard now and the nav link in Phase 2. |

**Out of scope (deliberately deferred — not built here):**

- **Admin-console plumbing** (moderation / generation / analytics types, API,
  hooks) ships with its own phase (3–5). Reasons: it isn't needed until then, and
  the period-aware analytics request params aren't fully pinned down in our copy
  of the backend doc — we won't write speculative shapes.
- **Any UI** — no components, pages, routes, or sidebar edits. Those start in
  Phase 1 (player) and Phase 2 (nav wiring).

## 3. Deliverables

All paths are relative to the repo root.

| File | Purpose | Key exports |
|---|---|---|
| [`types/quiz.ts`](../../../../types/quiz.ts) | Student + shared types, straight from the API doc. | `QuizSession`, `QuizQuestion`, `QuizOption`, `QuizServedQuestion`, `QuizSessionData`, `QuizResultItem`, `QuizResultsData`, `QuizTopic`, request params + the 5 response envelopes, and the enums `QuizSessionStatus` / `QuizSourceTier` / `QuizDifficulty`. |
| [`lib/api/quiz.ts`](../../../../lib/api/quiz.ts) | Thin typed wrappers over the shared `apiClient`. | `quizApi.{ listSessions, startSession, getSession, submitAnswer, endSession, getResults, getTopics }` |
| [`lib/hooks/useQuiz.ts`](../../../../lib/hooks/useQuiz.ts) | React Query hooks + a `quizKeys` factory. | `useQuizSessions`, `useInfiniteQuizSessions`, `useQuizSession`, `useQuizResults`, `useQuizTopics`, `useStartQuizSession`, `useSubmitQuizAnswer`, `useEndQuizSession` |
| [`lib/utils/quiz-access.ts`](../../../../lib/utils/quiz-access.ts) | The single source of truth for "who may use the player." | `QUIZ_PLAYER_ROLES`, `canAccessQuizPlayer(role)` |
| [`components/auth/QuizGuard.tsx`](../../../../components/auth/QuizGuard.tsx) | Route guard; redirects non-allowed users home. Mirrors `AdminGuard`. | `QuizGuard` |

### Hook → endpoint map

| Hook | Calls | Notes |
|---|---|---|
| `useQuizSessions(params)` | `GET /quizzes` | Paginated history. |
| `useInfiniteQuizSessions(params)` | `GET /quizzes` | Infinite-scroll variant for the history screen. |
| `useQuizSession(uuid)` | `GET /quizzes/{uuid}` | Rehydrates the play screen; `staleTime: 0`. |
| `useQuizResults(uuid)` | `GET /quizzes/{uuid}/results` | Frozen data → 5-min stale. |
| `useQuizTopics()` | `GET /quizzes/topics` | For the optional picker. |
| `useStartQuizSession()` | `POST /quizzes` | Seeds session cache, refreshes history. |
| `useSubmitQuizAnswer(uuid)` | `POST /quizzes/{uuid}/answers` | Renders from the response; no per-answer refetch. |
| `useEndQuizSession(uuid)` | `POST /quizzes/{uuid}/end` | Invalidates history + session + results. |

## 4. Key decisions & rationale

1. **Mirror the Notes feature exactly.** Same API-service shape, same query-key
   factory, same hook patterns. Zero new conventions to learn or review.
2. **Reuse shared pagination types.** `PaginationMeta` / `PaginationLinks` come
   from [`types/case.ts`](../../../../types/case.ts) — the quiz `pagination`
   block is identical, so we don't redefine it.
3. **Role helper lives in `lib/utils/`, not a new `lib/auth/`.** The codebase
   keeps cross-cutting helpers in `lib/utils/` (e.g. `api-error.ts`,
   `device-id.ts`); we follow that rather than introduce a one-file folder.
4. **`QuizGuard` gates on role only.** Verified-email is a backend requirement
   (`403`) that the player screens will surface as a friendly "verify your email"
   notice — bouncing an allowed-role user off the route would be worse UX.
5. **No per-answer cache invalidation.** The answer response already contains the
   next question and the live score, so the play screen renders straight from it.
   We only keep the session-detail cache in sync for reload safety.
6. **One documented assumption:** the doc describes `POST /end` as returning "the
   final session object" but doesn't show the envelope. We type it as
   `{ data: { session } }` (consistent with every other session response) and
   flag it to verify in Phase 1 — a one-line fix if it differs.

## 5. Definition of Done

- [x] All five files created and fully typed — **no `any`, no `@ts-ignore`, no
      `TODO`s**.
- [x] `npx tsc --noEmit` passes project-wide (0 errors).
- [x] `npx eslint` passes on all new files (incl. React Compiler rules).
- [x] Types map 1:1 to the backend doc; decimal fields typed as `string`.
- [x] `QuizGuard` mirrors `AdminGuard` (loading skeleton + redirect home).
- [x] No UI, routes, or edits to existing files (foundation only).

## 6. How to verify

```bash
npx tsc --noEmit          # expect: 0 errors
npx eslint types/quiz.ts lib/utils/quiz-access.ts lib/api/quiz.ts \
  lib/hooks/useQuiz.ts components/auth/QuizGuard.tsx   # expect: clean
```

There is nothing to click yet — correctness here is "it compiles, it's typed
right, and the gate logic is correct." Runtime behaviour gets exercised in
Phase 1 when real screens call these hooks.

## 7. What Phase 1 consumes from this

The player screens will:

- Wrap `app/(main)/quiz/*` in `<QuizGuard>`.
- Call `useStartQuizSession()` on the start/resume screen.
- Drive the play loop with `useSubmitQuizAnswer()` + `useEndQuizSession()`.
- Render review with `useQuizResults()`.

No Phase-1 screen should ever import `apiClient` or define quiz types inline —
everything it needs is exported here.
