# Phase 3 — Post-Implementation

**Status:** ✅ Code complete · build-verified · ⏳ live click-through pending · **Date:** 2026-06-28

Admin question-moderation console. How it shipped vs [`plan.md`](./plan.md), and verification.

---

## 1. What shipped

**Plumbing (4):** `types/admin-quiz.ts`, `lib/api/admin-quiz.ts`,
`lib/hooks/useAdminQuiz.ts`, `lib/validations/admin-quiz.ts`.

**Components (8, `components/admin/quiz/`):** `AdminQuizStatusBadge`,
`AdminQuizBulkBar`, `AdminQuizQuestionFilters`, `AdminQuizActionDialog`,
`AdminQuizQuestionsTable`, `AdminQuizQuestionDetail`, `AdminQuizQuestionForm`,
plus the nav section `components/admin/admin-nav-quiz.tsx`.

**Pages (3):** `app/(admin)/admin/quiz/questions/{page, [uuid]/page, [uuid]/edit/page}.tsx`.

**Edits:** `components/admin/admin-sidebar.tsx` (registers the Quiz section).

## 2. Key decisions

1. **Bulk by `uuid`** — uses the backend's resolved contract (uuids in `ids`),
   one `/bulk` call. Approve/archive only; delete/restore stay single-item.
2. **Row selection built fresh** (no existing multi-select table to mirror) with
   the `Checkbox` primitive: header = "select all on this page"
   (checked/indeterminate/empty), selection tracked as a `Set<uuid>` that persists
   across pages, cleared after a successful bulk action.
3. **One shared action dialog** (`AdminQuizActionDialog`) for
   approve/archive/delete/restore, with an optional moderation note (hidden for
   delete). `e.preventDefault()` on the action keeps it open during the async call;
   it closes + toasts on success. Reused by the table rows and the detail page.
4. **Edit form: load-then-render** — the form mounts only once the question is
   loaded, taking `defaultValues` from it, so there's **no `form.reset` effect**
   (React-Compiler clean). Options + the single correct answer use a custom
   4-row control driving `correct_index`.
5. **Followed the admin-cases list pattern** — URL-driven filters, `useDebounce`
   topic-key search, `AdminPagination`, `Card` layout.
6. **No "create" screen** — questions are backend-generated; the API has no create.
7. **Dedicated admin "Quiz" nav section** (not crammed into Content), leaving room
   for Generation (Phase 4) and Analytics (Phase 5) under the same group.

## 3. Deviations / fixes during build

| Item | Resolution |
|---|---|
| Detail "Source" used `q.source_mode` (doesn't exist) | `source_mode` lives under `generation_batch` → read `q.generation_batch.source_mode`. |
| zod `z.coerce.number()` made the form's input type `unknown` → resolver type mismatch (7 errors) | Dropped `coerce`; the Select/radio already store numbers, so `z.number()` aligns input/output. |
| `form.watch()` tripped the React Compiler "incompatible library" lint | Switched to `useWatch({ control, name })`. |

## 4. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint` (all A files) | **clean** (coerce + watch issues fixed, not suppressed) |
| `npm run build` | **exit 0**, 106/106 pages; `/admin/quiz/questions` (○) + `[uuid]` & `[uuid]/edit` (ƒ) |
| `any` / `@ts-ignore` / `TODO` scan | none |

### Still to do (runtime — needs an admin login + a non-empty bank)
- [ ] Click-through: filter, open a question, edit (4 options + correct), the four
      status actions, and a bulk approve/archive on a multi-select.

## 5. Out of scope (next phases)

- **Generation observability** (batches) → Phase 4.
- **Usage analytics, matching-health, per-user quiz tab** → Phase 5.

## 6. Definition of Done status

All static-quality DoD items met (filters + pagination + selection + bulk; detail
with revealed answer + usage + trail; validated edit; new gated nav section;
loading/empty/error states; clean typed code; tsc + eslint + `next build` green).
The runtime click-through in §4 remains, pending data.
