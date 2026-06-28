# Quiz API — request: admin session access

We're building the Quiz Mode admin console against `docs/api/quiz.md` (current `main`).
The moderation, generation, analytics, matching-health, and per-user **aggregate**
profile surfaces are all done. The one capability the admin API doesn't expose is
**session-level** access: an admin can see a user's rolled-up numbers but **cannot
list that user's individual sessions, nor open a session to see its answer-by-answer
detail.** This note describes the **contract we'd consume** — not how to build it.

> This is a description of the data we need, in our consuming terms. Envelope,
> pagination, period params, error semantics, and auth should follow whatever the
> existing `/api/admin/quiz/*` endpoints already do — we'll consume them the same way.

---

## Why we need it (use cases)

1. **Support / complaint triage** — "I was marked wrong on question X" → an admin opens
   that user's session and sees exactly what they were served, what they picked, the
   correct option, and whether the question was edited after they answered.
2. **Abuse / integrity review** — spot implausibly fast or perfect runs (per-question
   timing, score, source-tier mix) for a specific user.
3. **Per-user drill-down** — the per-user "Quiz activity" card shows aggregates; admins
   need to click into the actual sessions behind those numbers.

Today the only per-question answer data lives on the student-owned
`GET /api/quizzes/{uuid}/results`, which is gated to the session owner (`404/403` for an
admin). We need an **admin-scoped** read of the same information for **any** user.

---

## 1. List a user's sessions

What we want: a paginated list of one user's quiz sessions, so we can render a session
history table on the admin user page (and link each row into the detail below).

**We'd send** (all optional): the standard pagination params, and ideally a `status`
filter (`active | completed | abandoned`) and a date range, consistent with how the
batch list already filters.

**We'd consume, per session row** — essentially the student session shape we already
type, addressable by an admin for any user:

```jsonc
{
  "uuid": "…",                       // session id, used to open the detail below
  "status": "completed",            // active | completed | abandoned
  "served_count": 8,
  "answered_count": 6,
  "correct_count": 2,
  "score_percentage": "33.33",      // decimal string, like elsewhere (nullable)
  "started_at": "…",
  "last_activity_at": "…",
  "completed_at": "…"               // nullable
}
```

Plus the same pagination envelope as the other admin list endpoints.

A natural shape would be `GET /api/admin/users/{user_uuid}/quiz/sessions` (it sits next
to the existing `GET /api/admin/users/{user_uuid}/quiz` aggregate), but the path is your
call — we just need *a* way to enumerate a given user's sessions.

---

## 2. Read one session's per-question detail (admin)

What we want: the admin-readable equivalent of the student `results` payload, for **any**
session, **regardless of owner** — and ideally **without** requiring the session to be
ended (admins should be able to inspect an `active` session's answers so far).

**We'd consume** — the same data the student review screen already renders, so we can
reuse our results UI:

```jsonc
{
  "session": {
    "uuid": "…",
    "user": { "id": 2960, "name": "Jane Doe" },   // whose session it is
    "status": "completed",
    "served_count": 8,
    "answered_count": 6,
    "correct_count": 2,
    "score_percentage": "33.33",
    "started_at": "…",
    "completed_at": "…"
  },
  "questions": [                      // answered questions (sized by answered_count)
    {
      "sequence": 1,
      "source_tier": "own",          // own | same_topic_other | widened | recycled
      "was_correct": false,          // frozen grade
      "selected_option_id": 6,
      "time_spent_ms": 12447,
      "edited_since_answered": false,
      "question": {                  // null for a removed/archived source question
        "uuid": "…",
        "question_text": "…",
        "explanation": "…",
        "difficulty": 3,
        "difficulty_label": "Medium",
        "topic": "Criminal Law",
        "options": [
          { "id": 5, "position": 0, "option_text": "…", "is_correct": false },
          { "id": 6, "position": 1, "option_text": "…", "is_correct": true }
        ]
      }
    }
  ]
}
```

This is the student `results` shape (we already type `QuizResultsData` /
`QuizResultItem`) with two admin additions: `session.user`, and the ability to read it
for a session the caller doesn't own. A natural shape would be
`GET /api/admin/quiz/sessions/{session_uuid}` — but, again, the path is your call.

---

## What we'll build on top

- **#1** → a "Sessions" tab/section on the admin user page: a paginated session table
  (status, score, served/answered/correct, started/ended, duration) linking into #2.
- **#2** → a read-only admin version of our existing student results screen
  (per-question review: chosen vs correct option, timing, explanation, edited flag).

We don't need anything beyond these two reads to deliver the session drill-down. Other
gaps we noticed but are **not** requesting here (lower priority): live/active-session
monitor, per-question respondent breakdown / leaderboards, full-text question search,
data export, manual generation retry. Happy to spec those separately if useful.
