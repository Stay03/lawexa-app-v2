# Phase 8 — post-implementation

Shipped as `858686d`.

---

## The headline is what did NOT need doing

The main plan described this phase as a rewrite: four wrong-shaped segment
boundaries, a section with no route group, and a blank-then-skeleton chain. That
text was written from the July architecture audit, and by 15 August most of it
had already been fixed by the July skeleton pass.

`cases`, `statutes`, `folders` and `quiz` all follow the rule correctly today.
`app/v2/cases/loading.tsx` carries the docblock that states it and ends "Do not
'simplify' the two files back into one." `app/v2/loading.tsx` is empty on
purpose and says why.

**So the work was not rebuilding the system. It was checking every route against
the rule the codebase already states, and fixing the three places that do not
follow it.** That distinction is the whole value of the phase: re-solving a
solved problem would have churned files that are already right and produced a
diff nobody could review.

---

## What was actually wrong, and what shipped

### 1. Radars never received the July fix

```
before                              after
radars/page.tsx                     radars/(list)/page.tsx
radars/loading.tsx  → RadarsFallback  radars/(list)/loading.tsx → RadarsFallback
                                    radars/loading.tsx → neutral
radars/[radarUuid]/                 radars/[radarUuid]/
radars/[radarUuid]/scans/[scanUuid] radars/[radarUuid]/scans/[scanUuid]
radars/new/                         radars/new/
```

A segment's `loading.tsx` wraps its CHILD SLOT. With the list page sitting
directly under the segment, one file was doing two jobs — the list's own
fallback and the boundary every child is navigated into — so it painted the
radar LIST on the way to a radar, a scan, or the create form.

The segment boundary is now neutral, because its children are two documents and
a form and rule 2 in `app/v2/loading.tsx` is literal about that case: a segment
whose children differ must never wear one sibling's shape. Nothing is lost —
all three children already carry their own correctly-shaped boundary.

### 2. `notes/[slug]` was the only document route without its own boundary

`cases/[slug]` and `statutes/[slug]` each have one. `notes/[slug]` did not, and
leaned on `notes/loading.tsx` — which forced the SEGMENT boundary to wear the
reader's shape, putting a document silhouette ahead of `/notes/create` and
`/notes/{slug}/edit`.

**Its docblock had already considered making it neutral and rejected that**,
recording the trade honestly: the alternative on offer was a blank beat ahead of
every note, which is the common path by a wide margin.

That reasoning was sound under the constraint it was made under. The constraint
was removable. Adding `notes/[slug]/loading.tsx` means the note keeps its
document skeleton on every list→note click — painted by the boundary closest to
the changed segment — and the segment above is free to be neutral. Nobody loses
a skeleton and nobody sees the wrong one.

This is recorded carefully because overturning a written decision is exactly the
kind of change that should be argued rather than assumed.

### 3. `/spaces/discover` had no boundary at all

It fell through to the deliberately-empty v2 segment boundary, so a cold arrival
was a blank beat and then a finished page. Blank is right for a boundary that
cannot know its destination; it is wrong for a destination whose shape is known.

The screen had no reusable fallback, so its chrome was extracted into a
`DiscoverFrame` used by both the screen and the new route fallback rather than
copied. A hand-drawn skeleton diverges from the real surface within two design
rounds; a shared frame cannot.

---

## Measured

**The discover hand-off moves nothing.** With the rows request held back 8s, at
390px:

| | while pending | when live |
|---|---|---|
| heading | `x16 y80 w358 h32` | `x16 y80 w358 h32` |
| search field | `x16 y178 w358 h36` | `x16 y178 w358 h36` |

`movedAtHandoff: []`. Note precisely what this measures: the **Suspense-level**
hand-off inside the screen. By 2.5s the route boundary had already handed over
on a warm dev server, so it was not caught on camera — but it renders the same
`DiscoverFrame`, so the outer hand-off is the same shape by construction rather
than by observation.

**Every touched route still resolves**: `/radars` 200, `/radars/new` 200,
`/notes` 200, `/spaces/discover` 200. The production build emits all of them,
and the `(list)` group adds no URL segment — `/v2/radars` is still `/v2/radars`.

Gates: `tsc` clean, `eslint` clean, `V2_ENABLED=true next build` green,
158 static pages.

---

## What I could not prove, stated plainly

**The radars before-state was never filmed.** Three attempts failed:

1. A hard `page.goto` into `/radars/{uuid}` — wrong navigation type. Next renders
   the innermost boundary directly on a hard load, so the parent segment's shape
   never appears. The probe showed one stable detail skeleton and proved nothing.
2. Clicking the real `New radar` link with the RSC payload stalled by
   `page.route` — **stalling the request also stalls the navigation that would
   have shown the boundary.** The path never changed for the whole 5s.
3. The same click under CDP network throttling instead of interception — the
   click still did not navigate.

This account has no radars to click, which is the root cause.

So the radars defect is a **code-structure finding, not a filmed one**: the
boundary demonstrably renders `RadarsFallback`, and it demonstrably sits above
three non-list children with no route group between them. The fix is a
mechanical application of a pattern proven in four sibling sections and cannot
regress the paths it touches, because each already has its own boundary. That is
an argument for low risk. It is not a photograph, and it is not written here as
one.

---

## Left for later

- **Neither of the two neutral boundaries was seen on film either** — they show
  only on a cold cross-section jump, which the dev server is too warm to
  reproduce reliably. Same status as above.
- The six correct sections were not touched.
- No existing skeleton was redesigned. The shapes are the components' own, which
  is the point of them.
