# Quiz Mode — Master Implementation Plan

> **Status:** Planning. This is the source-of-truth overview. Each phase has its own
> `plan.md` (written before building) and `post-implementation.md` (written after) under
> [`phases/`](./phases).
>
> **Audience:** Any engineer, including someone new to this codebase. Plain English first,
> details second.

---

## 1. What we are building

The backend ships a feature called **Quiz Mode**. It is really **two products behind one API**:

| Half | Plain-English description | Lives in |
|---|---|---|
| **A. Quiz Player** | A student opens an endless practice session and answers AI-generated multiple-choice questions one at a time. Answers stay hidden until they end the session and view results. | `app/(main)/quiz/...` |
| **B. Admin Console** | Staff moderate the AI-generated question bank, watch generation cost/health, and read usage analytics. | `app/(admin)/admin/quiz/...` |

**Where the questions come from:** a nightly backend job turns each user's study
conversations into questions and auto-approves them into a shared bank. **The frontend never
triggers generation** — we only read/serve from the bank and let admins moderate it.

**Backend doc (authoritative API contract):**
`Stay03/lawexa-api-v3` → `docs/api/quiz.md`. A local copy of the key facts lives in this plan
(§5–§6), but the GitHub doc wins if they ever disagree.

---

## 2. Rollout decision — LOCKED ✅

This feature is **still in development**, so it ships behind a **soft-launch gate**:

> **Only `researcher`, `admin`, and `superadmin` may see or use the Quiz Player.**
> Regular users see **no trace** of it — no nav link, and the pages redirect them away.

How that is enforced (two layers, both required):

1. **Hide the entry point.** The "Quiz" link in the main sidebar renders only for the allowed
   roles — same pattern already used to hide the lawyer-only link in
   [`components/layout/app-sidebar.tsx`](../../components/layout/app-sidebar.tsx).
2. **Guard the routes.** A new `QuizGuard` wraps the player pages and redirects anyone outside
   the allowed roles back to `/` — a near-copy of
   [`components/auth/AdminGuard.tsx`](../../components/auth/AdminGuard.tsx) (which already gates
   `admin`/`superadmin`).

**Opening it up later is a one-line change:** widen (or remove) the role check. No rewrite.

**Important caveat (not a blocker — just know it):** the backend hard-locks the **Admin
Console** to the `admin` role and returns `403` to everyone else. So during this phase:

| Role | Take quizzes (Player) | Moderate / analytics (Admin Console) |
|---|---|---|
| `superadmin` | ✅ | ✅ |
| `admin` | ✅ | ✅ |
| `researcher` | ✅ | ❌ backend returns `403` |
| everyone else | ⛔ hidden by us | ❌ |

If researchers ever need to moderate, that is a **backend** change (a frontend cannot bypass a
`403`).

---

## 3. Frontend conventions we follow (no new patterns)

This feature introduces **zero** new architectural patterns. We mirror the existing **Notes**
feature, which already exercises every layer we need (list + detail + create/edit + forms).

| Concern | What we use | Reference to copy |
|---|---|---|
| HTTP calls | Shared axios client (token + base URL already wired) | [`lib/api/client.ts`](../../lib/api/client.ts) |
| API service file | One object per feature (`quizApi`, `adminQuizApi`) | [`lib/api/notes.ts`](../../lib/api/notes.ts) |
| Data fetching | TanStack React Query + a query-key factory | [`lib/hooks/useNotes.ts`](../../lib/hooks/useNotes.ts) |
| Types | One file per feature in `types/` | [`types/note.ts`](../../types/note.ts) |
| Forms | `react-hook-form` + `zod` (`lib/validations/`) | [`components/notes/NoteForm.tsx`](../../components/notes/NoteForm.tsx) |
| UI primitives | shadcn/ui | `components/ui/*` |
| Toasts | `sonner` | `toast.success(...)` / `toast.error(...)` |
| Error normalizing | `extractApiError` | [`lib/utils/api-error.ts`](../../lib/utils/api-error.ts) |
| Routing | Next.js App Router; `(main)` = users, `(admin)` = staff | `app/(main)`, `app/(admin)` |
| Admin sidebar link | A "section" component registered in the admin sidebar | [`components/admin/admin-nav-content.tsx`](../../components/admin/admin-nav-content.tsx), [`components/admin/admin-sidebar.tsx`](../../components/admin/admin-sidebar.tsx) |

The backend **response envelope** `{ success, message, data }` and its **pagination** shape
(`current_page, per_page, total, last_page, from, to`) are **identical** to what Notes already
consumes — we reuse the existing pagination types.

---

## 4. Full file map (the whole feature, across all phases)

```
types/quiz.ts                          all TS interfaces (session, question, option, results, admin rows…)
lib/api/quiz.ts                        student endpoints  → quizApi
lib/api/admin-quiz.ts                  admin endpoints    → adminQuizApi
lib/hooks/useQuiz.ts                   student React Query hooks + key factory
lib/hooks/useAdminQuiz.ts              admin React Query hooks + key factory
lib/validations/quiz.ts                zod schema for the admin "edit question" form
lib/auth/roles.ts (or similar)         tiny role helper: canAccessQuizPlayer(role)

components/auth/QuizGuard.tsx          NEW guard: allow researcher|admin|superadmin
components/quiz/…                       player UI (QuestionCard, OptionList, ScoreBar, SessionResults, HistoryList, TopicPicker…)
components/admin/quiz/…                 admin UI (QuestionsTable, EditQuestionForm, BatchesTable, AnalyticsCards…)
components/admin/admin-nav-quiz.tsx     NEW admin sidebar section

app/(main)/quiz/layout.tsx             wraps player pages in <QuizGuard>
app/(main)/quiz/page.tsx               start / resume
app/(main)/quiz/play/page.tsx          active session (one question at a time)
app/(main)/quiz/[uuid]/results/page.tsx review screen (answers revealed)
app/(main)/quiz/history/page.tsx       past sessions

app/(admin)/admin/quiz/questions/page.tsx     moderation
app/(admin)/admin/quiz/generation/page.tsx    generation health
app/(admin)/admin/quiz/analytics/page.tsx     usage + matching-health dashboards
```

**Edits to existing files (wiring only):**
- [`components/layout/app-sidebar.tsx`](../../components/layout/app-sidebar.tsx) — add the role-gated "Quiz" link.
- [`components/admin/admin-sidebar.tsx`](../../components/admin/admin-sidebar.tsx) — register `<AdminNavQuizSection />`.
- [`app/(admin)/admin/users/[uuid]/page.tsx`](../../app/(admin)/admin/users/[uuid]/page.tsx) — add a "Quiz" tab fed by the per-user profile endpoint.

---

## 5. API surface (quick reference)

Auth: **Bearer token on every endpoint.** Student endpoints also require a **verified email**
(`403` otherwise). Admin endpoints require the **`admin` role** (`403` otherwise).

### Student — `/api/quizzes`
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/quizzes` | List my past sessions (paginated) |
| `POST` | `/api/quizzes` | **Start or resume** my session (the universal "open quiz" button). Body: optional `topic` |
| `GET` | `/api/quizzes/{uuid}` | Get current session + current question (rehydrate the play screen) |
| `POST` | `/api/quizzes/{uuid}/answers` | Submit `option_id`; returns updated score + the **next** question |
| `POST` | `/api/quizzes/{uuid}/end` | End the session, finalize score (idempotent) |
| `GET` | `/api/quizzes/{uuid}/results` | Review — correct answers + explanations (**only after the session ends**) |
| `GET` | `/api/quizzes/topics` | Recent topics for the optional picker |

### Admin — `/api/admin/quiz/*`
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/quiz/questions` | List/filter the bank (`status`, `topic_key`, `difficulty`, `source_mode`, dates, …) |
| `GET` | `/api/admin/quiz/questions/{uuid}` | Full question detail (admin sees `is_correct`) |
| `PATCH` | `/api/admin/quiz/questions/{uuid}` | Edit (requires exactly **4** options + `correct_index`) |
| `POST` | `/api/admin/quiz/questions/{uuid}/approve`·`/archive`·`/restore` | Status actions |
| `DELETE` | `/api/admin/quiz/questions/{uuid}` | Soft-delete |
| `POST` | `/api/admin/quiz/questions/bulk` | Bulk `approve`/`archive` (1–200 ids) |
| `GET` | `/api/admin/quiz/batches` · `/{uuid}` · `/summary` | Generation observability |
| `GET` | `/api/admin/quiz/analytics` | Usage dashboard (stat cards + charts + tables) |
| `GET` | `/api/admin/quiz/matching-health` | Is cross-user question matching firing? |
| `GET` | `/api/admin/users/{uuid}/quiz` | One student's quiz profile |

---

## 6. Backend gotchas — non-negotiable rules

These come straight from the API doc. Ignoring them = bugs.

1. **Answers are hidden until results.** Served options carry only `id`, `position`,
   `option_text` — never `is_correct`/`explanation`. Correctness is revealed **only** by
   `GET /results`, and only **after the session is ended**.
2. **One active session per user.** `POST /api/quizzes` resumes the open session or starts a
   new one. We do **not** track session state beyond the current `uuid`.
3. **Endless sessions.** `POST .../answers` always returns the next question; a session ends
   only when the user ends it (or it auto-expires after ~24h → `abandoned`).
4. **Cold start:** empty bank → `question` is `null`, **not** an error → show "check back soon."
5. **Size results by `answered_count`, not `served_count`** (a trailing unanswered serve is
   excluded from `/results`).
6. **Decimals are JSON strings** (`score_percentage: "33.33"`, `token_cost: "0.012345"`) →
   `parseFloat`. But analytics **aggregates** (`avg_score: 33.3`, rates) are **real numbers**.
7. **`edited_since_answered: true`** → show "This question was updated after you answered it."
   A removed source question renders `question: null` → show a "[removed question]" placeholder.
8. **Lifecycle errors:** answer after end → `409`; results before end → `409`; option not on
   the current question → `422`. Handle with toasts, never crash.
9. **Verified email required** for the player → backend `403`. Guard on `user.is_verified` and
   handle the `403` gracefully.
10. **No polling.** Everything is synchronous request/response. Only admin generation data
    reflects the nightly background job.

---

## 7. Phases

Each phase is a self-contained, reviewable unit. Build them in order; **Phase 0 is a hard
prerequisite** for everything else. The later admin phases (4, 5) and the history part of
Phase 2 are **deferrable** for the dev soft-launch — see the "Defer?" column.

| # | Folder | Goal | Defer? |
|---|---|---|---|
| 0 | [`phase-0-foundation`](./phases/phase-0-foundation) | Types, API services, hooks, `QuizGuard`, role helper. No UI. The plumbing everything else stands on. | No |
| 1 | [`phase-1-player-core`](./phases/phase-1-player-core) | The demo-able core: start/resume → play (answer loop, live score, end) → results. | No |
| 2 | [`phase-2-player-polish`](./phases/phase-2-player-polish) | History page, optional topic picker, edge cases (cold start, 409/422, verify-email), nav-link wiring. | History: optional |
| 3 | [`phase-3-admin-moderation`](./phases/phase-3-admin-moderation) | Question bank: list/filter/show/edit/approve/archive/delete/restore/bulk + admin nav section. | No (if admins moderate) |
| 4 | [`phase-4-admin-generation`](./phases/phase-4-admin-generation) | Generation observability: batches list/detail/summary. | Yes |
| 5 | [`phase-5-admin-analytics`](./phases/phase-5-admin-analytics) | Usage analytics, matching-health, per-user quiz tab. | Yes |

**Recommended path to a usable dev release:** Phase 0 → 1 → 2 (skip history if you like) → 3.
Phases 4–5 are dashboards that can follow once the core is in daily use.

---

## 8. How these docs work

For each phase, in its folder:

- **`plan.md`** — written *before* coding. The detailed, junior-friendly build steps for that
  phase: exact files, function signatures, component breakdown, states (loading/empty/error),
  and acceptance criteria.
- **`post-implementation.md`** — written *after* coding. What actually shipped, any deviations
  from the plan and why, follow-ups/tech-debt, and how it was verified.

This master plan stays the high-level map; phase docs hold the depth.

---

## 9. Quality bar — no compromises

Every phase must meet these before it is considered done:

- **Clean code:** no `any`, no `@ts-ignore`, no `TODO`/commented-out cruft, no quick hacks.
  Strong types end-to-end (the API responses are fully typed in `types/quiz.ts`).
- **Professional UI/UX:** proper shadcn/ui primitives used correctly; deliberate
  loading / empty / error / cold-start states (not just "it works"); responsive; accessible
  (labels, focus, keyboard).
- **Follows React Compiler lint (enforced as errors):** no `setState`-in-effect, no `Date.now()`
  in render; use `useSyncExternalStore` for mounted/client values and lazy `useState` where
  appropriate.
- **Respects the backend gotchas in §6** — especially never leaking answers before results.
- **Reuses existing components/patterns** rather than reinventing them.

---

## 10. Open questions (decide per-phase, not blocking)

1. **History page** — include in Phase 2 or defer? (Captured as optional within Phase 2.)
2. **Admin dashboards (Phases 4 & 5)** — build now or after the player is in daily use?
   (Captured as deferrable phases.)

Both are scoped so deferring them changes nothing structural — they are additive.
