# Phase 8 — skeletons

One skeleton per destination. Nothing shows a shape that belongs to somewhere
else, and nothing shows two shapes on the way to one place.

---

## First finding: most of what the main plan says is wrong here is already fixed

The main plan's skeleton section was written from the July architecture audit.
Re-reading the code on 15 August, before touching anything:

> "Four segment boundaries (cases, statutes, notes, folders) are document shaped
> and still wrap their own list route, because a route group adds an inner
> boundary and does not remove the page from the outer one."

**Three of those four are correct today.** `cases`, `statutes` and `folders` each
have their list page inside a `(library)` route group with its own
`loading.tsx`, and a segment-level `loading.tsx` shaped for the children that
are navigated INTO it. `app/v2/cases/loading.tsx` even carries the docblock
explaining the rule and ends with "Do not 'simplify' the two files back into
one."

The v2 root boundary is also not an accident. `app/v2/loading.tsx` is
deliberately empty, and says why: a segment boundary that cannot know its
destination's shape must be neutral, and neutral means empty, because "any
silhouette would be a lie about where the reader is going".

So this phase is not the rewrite the main plan implies. **The rules already
exist and are written down in the code. The work is finding the places that do
not follow them.** That is a smaller and more precise job, and it is recorded
here because a phase that restated a solved problem and re-solved it would waste
a day and churn files that are already right.

---

## The measured map

Every `page.tsx` under `app/v2`, against the `loading.tsx` that actually covers
it. A `loading.tsx` wraps its directory's CHILD SLOT, and a route group adds a
nesting level without adding a URL segment — that is the whole mechanic this
table turns on.

### Correct, and not to be touched

| Section | Group | Segment boundary | Children | Verdict |
|---|---|---|---|---|
| `cases` | `(library)` | `CaseFallback` (document) | `[slug]`, `[slug]/report` | all document — right |
| `statutes` | `(library)` | `StatuteFallback` (document) | `[slug]/[[...provision]]` | one child, right |
| `folders` | `(library)` | `FolderDetailFallback` | `[uuid]` | one child, right |
| `quiz` | `(hub)` | `QuizSegmentFallback` | play, results, history, stats | mixed, so a dedicated neutral fallback — right |
| `(collab)/channels` | `(index)` | none | `[channelId]` | list and detail each own theirs |
| `(collab)/spaces` | `(list)` | none | `[spaceId]` | same |

### 1. Radars never got the route group — the real defect

```
app/v2/radars/page.tsx            ← the LIST, directly under the segment
app/v2/radars/loading.tsx         ← renders RadarsFallback, the LIST shape
app/v2/radars/[radarUuid]/…       ← a document
app/v2/radars/[radarUuid]/scans/[scanUuid]/…
app/v2/radars/new/…               ← a form
```

Because `radars/loading.tsx` wraps the child slot, opening a radar paints the
**radar list skeleton first**, then the detail boundary replaces it with the
document skeleton. Two different shapes on the way to one place — the exact
complaint that produced the `(library)` pattern for cases in July, in the one
section that never received it.

The fix is the pattern the other four already prove:

- move `radars/page.tsx` into `radars/(list)/`, with `(list)/loading.tsx`
  rendering `RadarsFallback`;
- change `radars/loading.tsx` to suit what is navigated into it.

Its children are a document, a nested scan document, and a create form. That is
more than one shape, so **rule 2 in `app/v2/loading.tsx` applies literally: it
must be neutral, never one sibling's shape.** `new/` and `[radarUuid]/` both
already have their own correctly-shaped boundaries, so nothing is lost.

### 2. One destination has no skeleton at all — not five

Six routes have no `loading.tsx` of their own. **Five of them do not need one,
and finding that out is the difference between one file and six:**

| Route | What it actually is | Needs one? |
|---|---|---|
| `channel-invitations` | `redirect()` | no — never renders |
| `organization-invitations` | `redirect()` | no |
| `space-invitations` | `redirect()` | no |
| `settings/organization` | `redirect()` | no |
| `notes/mine` | `redirect()` | no |
| `spaces/discover` | a real browse list | **yes** |

A `redirect()` page has no paint to wait for. Writing a skeleton for one would
be a file that can never be seen.

So `spaces/discover` is the only gap. It gets a `loading.tsx` rendering the same
frame the screen itself paints — the house rule from `home-frame.ts`, so route
boundary → Suspense fallback → live content is one continuous shape and nothing
moves at either hand-off. The screen had no reusable fallback export, so the
chrome is extracted into a `DiscoverFrame` used by both rather than copied.
**A hand-drawn skeleton that is not the component's own shape diverges from the
real surface within two design rounds**, which is why none are hand-drawn here.

### 3. `notes` has mixed children under a reader-shaped boundary

`notes/loading.tsx` renders `NoteFallback`, the reader. Its children are
`[slug]` (a reader — right), `[slug]/edit` (an editor) and `create` (an editor).
Two shapes, so by rule 2 this should be neutral.

**Its docblock had already considered neutral and rejected it**, recording the
trade honestly: a document silhouette ahead of an editor is a near miss, and the
alternative on offer was a blank beat ahead of every note, which is the common
path by a wide margin.

That reasoning is sound and the conclusion is still avoidable, because **the
choice was never binary.** `cases/[slug]` and `statutes/[slug]` each carry their
own `loading.tsx`; `notes/[slug]` is the only document route in the app that
does not, which is exactly why its segment boundary had to compromise. Give
`notes/[slug]` the boundary its siblings already have and:

- a note keeps its document skeleton on every list→note click, painted by the
  boundary closest to the changed segment;
- the segment above is free to follow rule 2 literally.

Nobody loses a skeleton and nobody sees the wrong one. This is not
re-litigating a recorded decision; it is removing the constraint the decision
was made under.

---

## What this phase will not do

- Redesign any existing skeleton. The shapes that exist are the components'
  own, which is the point of them.
- Touch the six sections in the "correct" table.
- Add a skeleton to a route that renders instantly from cache.

## Done means

1. No route paints a skeleton belonging to a different route.
2. No route paints two different skeleton shapes on the way to one page.
3. Every destination that has a known shape shows it, rather than a blank beat.
4. Every skeleton in the app is the same component its page uses for its own
   Suspense fallback, so the hand-off moves nothing.
