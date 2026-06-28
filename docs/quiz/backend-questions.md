# Quiz API — questions for backend

We're building the Quiz Mode frontend against `docs/api/quiz.md` (current `main`).
The player is done; we're starting the admin console. A few clarifications so we
consume the API correctly. For each, either option works on our side — we just need
to know which to build against.

> **✅ Resolved — backend replied 2026-06-28** and updated `docs/api/quiz.md` (pull
> `main` for the canonical contract). Answers, folded in:
> 1. **Bulk** → `/bulk` now accepts `uuid`s in `ids` (1–200; approve/archive only;
>    `422` on a numeric/unknown id).
> 2. **End shape** → confirmed `data.session` (no `question` key).
> 3. **Analytics period** → shared contract: `period` ∈ {today, last_24_hours, date,
>    this_week, last_7_days, this_month, last_30_days (default), date_range};
>    `date` for `period=date`; `start_date`+`end_date` for `date_range` (≤366d).
>    Granularity is server-derived (hour for today/last_24_hours/date, else day);
>    only `/analytics` echoes it. `date_from`/`date_to` are only for the batch
>    **list** endpoint.
> 4. **Student stats** → shipped: `GET /api/quizzes/stats` (verified-email;
>    plain-number aggregates; `score_trend` = last 10 ended sessions).

---

## 1. Bulk moderation — which identifier? (blocking the bulk action)

`POST /api/admin/quiz/questions/bulk` takes numeric `ids` (e.g. `[4, 5, 6]`). But
`GET /api/admin/quiz/questions` rows and `GET /api/admin/quiz/questions/{uuid}`
expose **only `uuid`** — and the Conventions section says questions are addressed by
`uuid`. So we currently have no numeric question id to put in the bulk call.

**Question:** Should `/bulk` accept `uuid`s, or will the list/detail rows start
including a numeric `id`? (Single approve/archive/delete/restore are `uuid`-based and
fine — this only affects bulk.)

## 2. End-session response shape (quick confirmation)

`POST /api/quizzes/{uuid}/end` is documented as "returns the final session object
(no question)", but the envelope isn't shown. We've assumed it matches the other
session responses:

```json
{ "success": true, "message": "...", "data": { "session": { /* … */ } } }
```

**Question:** Is that right, or is the session returned directly as `data` (i.e.
`data: { uuid, status, … }` with no `session` wrapper)?

## 3. Analytics period parameters (for the admin dashboards)

The batch-summary, analytics, and matching-health sections say *"Period-aware (see
Analytics period params)"*, but that section isn't in the doc. The responses show
`period` / `granularity`, but not how the client **requests** a window.

**Question:** What query params do `GET /api/admin/quiz/batches/summary`,
`/api/admin/quiz/analytics`, and `/api/admin/quiz/matching-health` accept to set the
window and granularity? Specifically:
- a named range (e.g. `period=30d`) or explicit `date_from` / `date_to`?
- the valid `granularity` values, and the default window when none is given.

## 4. Student-facing stats (feature request, not a blocker)

The player consumes every student endpoint, but a student currently can't see their
own progress — the only quiz stats live in the **admin** per-user endpoint
(`GET /api/admin/users/{uuid}/quiz`), which is admin-only.

**What we'd like to consume** (shape and route entirely your call): an endpoint
returning the **authenticated student's own** quiz stats — e.g. average score, score
trend over time, session counts (total / completed / abandoned), accuracy, and
average time per question — so we can build a personal "reports" view in the player.

---

*Frontend contact: lawexa28@gmail.com*
