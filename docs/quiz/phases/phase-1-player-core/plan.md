# Phase 1 — Player Core

> The part users actually touch: **start/resume → answer one question at a time →
> review results.** This phase is where the feature has to look and feel
> *clean, professional, and slick* — that is the whole point of Phase 1.
>
> Builds entirely on the Phase 0 data layer (hooks + `QuizGuard`). No new API
> work. See [`../../main-plan.md`](../../main-plan.md) and
> [`../phase-0-foundation/post-implementation.md`](../phase-0-foundation/post-implementation.md).

---

## 1. Goal

Ship the three player screens with a focused, distraction-light, modern feel:

1. **Start / Resume** (`/quiz`) — a calm entry point with one obvious action.
2. **Play** (`/quiz/play`) — one question at a time, live score, smooth transitions.
3. **Results** (`/quiz/{uuid}/results`) — a satisfying score summary + answer review.

## 2. Design language (the non-negotiables)

We do **not** invent a new look — we extend the one already in the app:

| Token | Value (from existing components) |
|---|---|
| Surfaces | `bg-card` + `border` + `rounded-2xl`, generous `p-6` padding |
| Focused column | centered, `max-w-2xl`, lots of whitespace, `min-h-[calc(100svh-4rem)]` |
| Selection | `border-primary ring-2 ring-primary/20 bg-primary/5` + a circular check indicator (exactly like `OnboardingCard`) |
| Entrance motion | `animate-in fade-in slide-in-from-bottom-4` with **staggered** `animationDelay` per option |
| Step motion | `translate-x` + `opacity` slide keyed by question sequence (like `OnboardingContainer`) |
| Buttons / spinners | shadcn `Button` + `Loader2 animate-spin` for pending (existing pattern) |
| Toasts | `sonner` (`toast.success` / `toast.error`) via `extractApiError` |
| Motion safety | every transition gets a `motion-reduce:` fallback (instant, no slide) |

**Feel target:** quiet confidence. No clutter, no gamified noise. One question, four
clean options, a soft score chip, smooth slides. Think "premium study app," not
"trivia game."

## 3. Screens

### 3.1 Start / Resume — `/quiz`

Detects whether the user already has an `active` session (newest row of
`useQuizSessions()`), and adapts the call-to-action.

```
┌──────────────────────────────────────────────┐
│                                              │
│            ◜  Quiz Mode  ◝                    │   ← icon + title, centered
│   Practice with questions drawn from your     │
│   own study conversations.                    │
│                                              │
│   ┌────────────────────────────────────────┐ │
│   │  ▷  Start practice                     │ │   ← primary CTA (full-width, lg)
│   └────────────────────────────────────────┘ │
│                                              │
│   Pick a topic (optional)                     │   ← optional chips from useQuizTopics
│   [ Criminal Law ] [ Land Law ] [ Any ]       │
│                                              │
└──────────────────────────────────────────────┘

RESUME variant (when newest session is `active`):
   │  ↻  Resume your session                   │
   │  6 answered · 33% · started 2h ago        │   ← live progress subtext
   │  [ Start a new one instead ]              │   ← secondary
```

- **Start** → `useStartQuizSession().mutate({ topic })`; on success route to
  `/quiz/play?s={session.uuid}` (the response already seeds the session cache).
- **Resume** → route straight to `/quiz/play?s={activeSession.uuid}` (no re-POST;
  the play screen `GET`s the current question).
- **Verify-email guard:** if `user.is_verified === false`, replace the CTA with a
  friendly notice ("Verify your email to start practising") — the backend would
  `403` otherwise (gotcha #9). We also catch a `403` from start as a fallback.

### 3.2 Play — `/quiz/play?s={uuid}`

The heart of the feature. Reads `?s=` and loads the current question with
`useQuizSession(uuid)` (cache-first, seeded by Start). No `?s=` → redirect to
`/quiz`.

```
┌──────────────────────────────────────────────┐
│  Question 7              ● 33%   ⏹ End        │  ← sticky header: seq · score chip · End
│  〔 Medium 〕                                  │  ← difficulty badge
│                                              │
│   Which option best states the burden of      │  ← question_text, text-xl, leading-relaxed
│   proof?                                       │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │ ○  On the defendant                  │   │  ← option card (OnboardingCard style)
│   ├──────────────────────────────────────┤   │
│   │ ◉  On the prosecution        ✓ ring  │   │  ← tapped: primary ring + check, brief
│   ├──────────────────────────────────────┤   │     highlight, then auto-submit + slide
│   │ ○  On the judge                      │   │
│   ├──────────────────────────────────────┤   │
│   │ ○  Shared                            │   │
│   └──────────────────────────────────────┘   │
│                                              │
│   (no button — tapping an option advances)    │
└──────────────────────────────────────────────┘
```

**Interaction model (LOCKED): auto-advance on tap.** Tapping an option highlights
it briefly (answers stay hidden — no correctness shown), then submits and slides
to the next question. Faster, more "flow." A mis-tap can't be undone, which is
acceptable because correctness is never revealed mid-session.

- **Tap option** → set `selected` locally + immediately
  `useSubmitQuizAnswer(uuid).mutate({ option_id })`. The selected card shows its
  ring/check during the pending state (a ~150ms minimum highlight guarantees it's
  visible even on a fast response). All options are disabled while pending — no
  double-tap.
- **On success:**
  - the score chip animates to the new `score_percentage`,
  - the current card slides out left, the next slides in right (keyed by
    `sequence`), selection resets.
- **End** → `EndSessionDialog` (AlertDialog: "End this session? You'll see your
  results.") → `useEndQuizSession(uuid)` → route to `/quiz/{uuid}/results`.
  - **This is where we confirm the `POST /end` envelope assumption** from Phase 0
    and fix `QuizEndResponse` if the live shape differs.
- **No client timer needed** — the server stamps `time_spent_ms` from `served_at`.

**States:**
| State | Treatment |
|---|---|
| First load | `QuizPlaySkeleton` (header bar + question + 4 option skeletons) |
| Cold start (`question === null`) | `QuizColdStart` empty state: soft icon + "Your question bank is still warming up. Check back soon." + "Back to home" |
| Submitting | Next button shows spinner; options disabled (no double-submit) |
| `422` (option mismatch / double submit) | `toast.error`, refetch current question, keep playing — no count change |
| `409` (session already ended) | `toast`, redirect to `/quiz/{uuid}/results` |
| Resumed session has no current question / not active | "This session has ended" state → [View results] / [Start new] |
| Load error | inline error card + Retry |

### 3.3 Results — `/quiz/{uuid}/results`

`useQuizResults(uuid)`. The review is the reward — make it feel earned but calm.

```
┌──────────────────────────────────────────────┐
│                  ╭─────╮                      │
│                  │ 33% │   Session complete    │  ← score ring/number + headline
│                  ╰─────╯                      │
│           2 of 6 correct · 26 Jun             │  ← meta
│   [  Practice again  ]      [  Done  ]         │
│                                              │
│  ── Review ──────────────────────────────     │
│  ① Which option best states the burden…  ✓    │  ← was_correct badge
│     ✓ On the prosecution        (correct)     │  ← correct option: emerald check
│       On the defendant                        │
│     ⓘ The prosecution must prove guilt…       │  ← explanation
│                                              │
│  ② Another question…                    ✗     │
│     ✓ Correct answer here       (correct)     │  ← green = the right one
│     ✗ Your answer here          (your pick)   │  ← red = what they chose
│     ⓘ Explanation…                            │
│     ⚠ This question was updated after you      │  ← only if edited_since_answered
│       answered it.                            │
└──────────────────────────────────────────────┘
```

- Render the `data.questions` array (already only answered ones — sized by
  `answered_count`, gotcha #5).
- Per option marking: correct option → emerald check + "correct"; the user's
  `selected_option_id` when wrong → rose + "your answer"; others neutral.
- `edited_since_answered === true` → subtle amber note.
- `question === null` (removed) → muted "[removed question]" placeholder card.
- **Practice again** → `/quiz`. **Done** → `/` (home). (History link arrives in Phase 2.)
- States: `QuizResultsSkeleton`; `409` (session still active) → redirect to
  `/quiz/play?s={uuid}`.

## 4. Files to create

```
app/(main)/quiz/layout.tsx                 wraps children in <QuizGuard>, sets "Quiz" breadcrumb
app/(main)/quiz/page.tsx                    Start/Resume (client)
app/(main)/quiz/play/page.tsx               Play (reads ?s=, renders <QuizPlayer>)
app/(main)/quiz/[uuid]/results/page.tsx     Results (renders <QuizResults uuid>)

components/quiz/QuizStart.tsx               start/resume hero + CTA + optional topic chips
components/quiz/QuizTopicChips.tsx          optional topic selector (useQuizTopics)
components/quiz/QuizPlayer.tsx              play orchestrator: selection, transitions, hook calls
components/quiz/QuizQuestionCard.tsx        presentational question + options
components/quiz/QuizOption.tsx              single selectable option (echoes OnboardingCard)
components/quiz/QuizProgressHeader.tsx      sequence + difficulty + score chip + End
components/quiz/QuizScoreChip.tsx           live score pill
components/quiz/DifficultyBadge.tsx         difficulty label badge (color by level)
components/quiz/QuizColdStart.tsx           empty-bank state
components/quiz/EndSessionDialog.tsx        confirm-end AlertDialog
components/quiz/QuizResults.tsx             results orchestrator
components/quiz/QuizResultsSummary.tsx      score ring/number + meta + CTAs
components/quiz/QuizResultItemCard.tsx      one answered-question review row
components/quiz/QuizPlaySkeleton.tsx        loading skeleton (play)
components/quiz/QuizResultsSkeleton.tsx     loading skeleton (results)

lib/utils/quiz-format.ts                    parseScore(), difficulty color/label helpers
```

All data comes from Phase 0 hooks — **no component imports `apiClient` or
redefines a type.**

## 5. Micro-interactions & polish checklist

- Option cards: hover raises border to `primary/50`, selected gets the ring +
  animated check; entrance is staggered (`animationDelay = index * 60ms`).
- Score chip: number transitions (CSS) when it changes; subtle color by band
  (low = muted, mid = amber, high = emerald) — low-saturation only.
- Difficulty badge: 1–2 emerald, 3 amber, 4–5 rose, all `/10` backgrounds — tasteful.
- Question transition: 300ms slide + fade, `motion-reduce:` → instant.
- Buttons: pending spinner, never a layout shift; primary CTA is the only bold
  element per screen.
- Results score ring: a clean conic/SVG ring (no chart lib) animating from 0 → %.
- Empty/cold-start and error states are **designed**, not afterthoughts.

## 6. Accessibility

- Options are real `<button>`s; each is focusable and Enter/Space activates it
  (which, with auto-advance, submits that option). Tab moves between options.
- Question text is an `<h1>`/`<h2>` heading; visible `focus-visible` rings everywhere.
- Score/score-changes announced via an `aria-live="polite"` region.
- Dialog is the shadcn `AlertDialog` (focus-trapped, escapable).
- Color is never the only signal (check/✗ icons + text labels accompany green/red).

## 7. Build order (within Phase 1)

1. `lib/utils/quiz-format.ts` + `DifficultyBadge` + `QuizScoreChip` (tiny shared bits).
2. `QuizOption` + `QuizQuestionCard` (presentational, easy to eyeball).
3. `QuizPlayer` + `QuizProgressHeader` + `EndSessionDialog` + play page — the core loop.
4. `QuizColdStart`, skeletons, and all play-screen edge states.
5. `QuizResults` + summary + item card + results page.
6. `QuizStart` + `QuizTopicChips` + start page (ties the entry together).
7. Pass: responsive sweep (mobile sticky header/CTA), a11y sweep, motion-reduce,
   `tsc` + `eslint`.

> Sidebar nav link + the verify-email-wide polish land in **Phase 2** — Phase 1 is
> reachable by typing `/quiz` (guarded), which is enough to build and review it.

## 8. Decisions — LOCKED ✅

1. **Answer interaction → auto-advance on tap.** Tapping an option submits and
   slides to the next question (brief highlight first). No "Next" button.
2. **Topic chips → included in Phase 1.** The Start screen shows optional topic
   chips from `useQuizTopics`.

## 9. Definition of Done

- [ ] Three screens implemented to the mockups, fully responsive (mobile-first).
- [ ] Every state designed: loading, cold-start, empty, error, `409`/`422`, verify-email.
- [ ] Transitions smooth + `motion-reduce` safe; no layout shift on pending.
- [ ] A11y: keyboard, focus rings, `aria-live` score, color-independent correctness.
- [ ] Clean code: no `any`, no `@ts-ignore`, no `TODO`; all data via Phase 0 hooks.
- [ ] `npx tsc --noEmit` = 0 errors; `npx eslint` clean (incl. React Compiler rules).
- [ ] `POST /end` envelope confirmed against the live API; type adjusted if needed.
- [ ] Verified in the running app (start → answer a few → end → review).

## 10. Deferred to later phases (not Phase 1)

- Sidebar "Quiz" nav link (role-gated) + breadcrumb niceties → **Phase 2**.
- History screen `/quiz/history` + richer topic picker → **Phase 2**.
- All admin console screens → **Phases 3–5**.
