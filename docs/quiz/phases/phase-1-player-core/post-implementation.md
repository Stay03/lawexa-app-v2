# Phase 1 — Post-Implementation

**Status:** ✅ Code complete · ⏳ Live click-through pending · **Date:** 2026-06-27

What shipped for the player, how it differed from [`plan.md`](./plan.md), and how
it was verified.

---

## 1. What shipped

21 new files — 3 screens, their components, and shared helpers. No existing files
were modified (the sidebar nav link is Phase 2 by design; `/quiz` is reachable by
URL, behind `QuizGuard`).

**Routes**
| File | Screen |
|---|---|
| `app/(main)/quiz/layout.tsx` | Wraps the player in `<QuizGuard>` |
| `app/(main)/quiz/page.tsx` | Start / Resume |
| `app/(main)/quiz/play/page.tsx` | Play (reads `?s=`, Suspense-wrapped) |
| `app/(main)/quiz/[uuid]/results/page.tsx` | Results (+ breadcrumb relabel) |

**Components** (`components/quiz/`)
`QuizStart`, `QuizTopicChips`, `QuizPlayer`, `QuizQuestionCard`, `QuizOption`,
`QuizProgressHeader`, `QuizScoreChip`, `DifficultyBadge`, `EndSessionDialog`,
`QuizColdStart`, `QuizMessage`, `QuizPlaySkeleton`, `QuizResults`,
`QuizResultsSummary`, `QuizResultItemCard`, `QuizResultsSkeleton`.

**Helpers**
`lib/utils/quiz-format.ts` (`parseScore`, `formatScorePercent`, `formatSessionDate`,
difficulty/score colour helpers).

## 2. Key implementation decisions

1. **Auto-advance with zero effects.** The tapped option is stored as
   `{ sequence, optionId }`; it auto-clears when the next question (new sequence)
   arrives, so no `useEffect` resets it. The question card is **keyed by
   `sequence`**, which remounts it and triggers the slide-in. Fully React-Compiler
   clean (no setState-in-effect, no `Date.now()` in render).
2. **The start/resume POST happens on a click**, not in an effect — it seeds the
   session cache and routes to `/quiz/play?s={uuid}`. Reload-safe; the play screen
   re-`GET`s the current question.
3. **`useSearchParams` is Suspense-wrapped** on the play page (App Router
   requirement), matching the existing subscription-callback pattern.
4. **Breadcrumb polish:** the results page relabels the raw uuid crumb to
   "Session" via `breadcrumbStore` (Home / Quiz / Session / Results).
5. **Colours** reuse the app's existing emerald/amber/rose + `destructive`
   conventions; correctness is never colour-only (icons + text labels too).

## 3. Deviations from the plan

| Planned | Shipped | Why |
|---|---|---|
| Resume state offered "Start a new one instead" | Resume-only (no secondary "start new") | The backend `POST /quizzes` **resumes** an open session within the inactivity window, so "start new" would be a no-op while one is active. The honest action is Resume; to start fresh the user ends the session from the play screen. Correctness fix over the mockup. |
| (not listed) | Added `QuizMessage` shared component | DRYs the cold-start / ended / error / load-fail panels into one polished primitive. |
| Results score ring animates 0 → % | Static ring + entrance `zoom-in` | A live stroke animation needs either a mount effect (setState — banned by React Compiler) or a global keyframe. The zoom entrance gives life without either. |

No other deviations. All three screens match the mockups.

## 4. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` (project-wide) | **0 errors** |
| `npx eslint` on all new files (incl. effect-bearing pages) | **clean, exit 0** (React Compiler rules included) |
| `any` / `@ts-ignore` / `TODO` scan | none |
| Every state designed (loading, cold-start, ended, error, 409/422, verify-email) | yes |

### Still to do (runtime — needs a researcher login + a non-empty bank)
- [ ] Click-through in the running app: start → answer a few → end → review.
- [x] **`POST /end` response envelope confirmed** by backend (2026-06-28):
      `{ data: { session } }`, exactly as typed — no change needed.

## 5. Follow-ups

- **Phase 2** adds the role-gated sidebar nav link, the `/quiz/history` screen,
  and the richer topic picker. Until then the player is reachable at `/quiz` (URL
  only), which is enough to review and use.

## 6. Definition of Done status

All static-quality DoD items are met (responsive layout, designed states, smooth
+ motion-safe transitions, a11y, clean typed code, tsc + eslint green). The two
runtime items in §4 remain, pending a live session.
