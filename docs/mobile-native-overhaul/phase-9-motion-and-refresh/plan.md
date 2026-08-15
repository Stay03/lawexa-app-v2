# Phase 9 — motion, and pull to refresh

Two halves. Movement between screens, and the gesture people expect on a list.

---

## The codebase fact that decides the whole gesture half

**v2 has no pull to refresh, and it cannot get one for free.**

```css
html.v2-document-lock,
html.v2-document-lock body {
  overflow: hidden;
  overscroll-behavior: none;
}
```

The document never scrolls while v2 is mounted, and that is deliberate — it is
what stops the iOS Safari toolbar and keyboard pushing the whole page around.
The browser's native pull to refresh fires on **document** overscroll, so in v2
it can never fire at all. Not because it was switched off, but because there is
nothing for it to fire on.

Everything scrolls inside one region:

```css
.v2-shell__content {
  grid-row: 2;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
```

So a pull to refresh here is **built, not enabled**. That is a bigger commitment
than the main plan's one line implies, and it is why this plan is longer on the
gesture than on the motion.

---

## What the research says, and what it costs us

Sources at the end. The findings that actually constrain the build:

**1. A non-passive `touchmove` listener is the standard way to do this and the
standard way to ruin scrolling.** Adding non-passive touch listeners blocks
scrolling while the handler runs, and it is exactly the "well-documented
negative effect on scroll performance" that `overscroll-behavior` was introduced
to make unnecessary. Phase 4 was a scrolling defect reported from the field. We
do not get to introduce another one in phase 9.

**2. `scrollTop` goes NEGATIVE on iOS.** With `-webkit-overflow-scrolling:
touch`, Safari's rubber band drives an inner scroller's `scrollTop` below zero.
Any "am I at the top?" test written as `scrollTop === 0` is wrong on the one
platform this overhaul exists for. It must be `scrollTop <= 0`.

**3. You cannot set `scrollTop` out of range.** So the indicator cannot be
driven by moving the scroller. It has to be its own element, translated.

**4. `overscroll-behavior: contain` already gives us the containment** the
hand-rolled `preventDefault` approach is usually reaching for. We keep it and do
not add `touch-action: none`, which breaks more than it fixes.

### The design that follows from those four

- Listeners stay **passive**. `touchstart` records the origin only when
  `scrollTop <= 0`; `touchmove` reads the delta and drives a **separate
  indicator element** by `transform`. Nothing calls `preventDefault`, so the
  scroller is never blocked and a pull that turns into a scroll just scrolls.
- The indicator lives **above** the content and is translated down from behind
  the bar, with a resistance curve so the pull feels weighted rather than
  linear. It never moves the scroller itself, because point 3 says it cannot.
- **Threshold and slop reuse phase 1's numbers** rather than inventing new ones:
  8px of movement before anything is treated as a gesture, so a tap and a
  hesitant scroll are never a pull.
- **Reduced motion is not a decoration here.** WCAG 2.3.3 treats the travel as
  motion. Under `prefers-reduced-motion` the indicator does not travel: it
  appears in place and spins, and the refresh still happens. The gesture is
  never removed, only its animation.
- **The refresh itself is a query invalidation**, not a reload. The lists all
  run on TanStack Query, so the honest action is to refetch the active list and
  resolve when it resolves — never a fixed timer, which would lie about being
  finished.

### Where it goes, and where it deliberately does not

Pull to refresh belongs on a list a person believes is a feed of other people's
activity. It does not belong on a document, a form, or anything with an unsaved
draft in it.

| Surface | Pull? | Why |
|---|---|---|
| Channel transcript | **no** | it is already live over Reverb, and it loads upward — a downward pull means "older messages", which it already does |
| Spaces / channels lists | yes | other people change these |
| Notes, cases, statutes, folders, bookmarks lists | yes | |
| Radars list | yes | scans arrive on a schedule |
| Conversations list | yes | |
| A case, statute or note reader | no | a document does not refresh |
| Any form, or an overlay from phase 7 | no | a pull with an unsaved draft behind it is a trap |
| Quiz play | no | it is a live session |

The channel transcript row is the one worth arguing, and it is settled by what
the gesture would collide with: that surface already treats a downward pull at
the top as "fetch older messages", it already has a live socket, and phase 4 was
a scrolling defect in exactly that code. Adding a competing gesture there would
be reopening the riskiest file in the app for the least benefit.

---

## The motion half

The vocabulary already exists and is used consistently — 143 `motion-safe:
animate-in`, 178 `motion-reduce:transition-none`. This half is therefore not a
new system; it is applying the one that is there to the transitions that
currently have none, now that phases 3, 5, 6 and 7 have settled the shapes.

To be established by reading before anything is written:

- Which route changes currently cut hard, now that back is real (phase 5) and
  the overlays are screens (phase 7).
- Whether the View Transitions API is worth adopting here or whether it fights
  the App Router's own boundary handling. **This is a question, not a plan.** It
  is answered by measuring in this codebase, because the shell is a fixed grid
  with one scroller and that is not the layout most write-ups assume.
- The house rule stands regardless: nothing appears or disappears abruptly, and
  everything is behind `motion-safe:`.

---

## Done means

1. A pull on a list that should refresh does, and says so honestly by finishing
   when the request finishes.
2. No non-passive touch listener is added anywhere, and scrolling is measured
   after the change on the same surfaces phase 4 fixed.
3. `scrollTop <= 0`, never `=== 0`.
4. Under reduced motion the gesture still works and the travel is gone.
5. No pull exists on a document, a form, an overlay, or the transcript.
6. Route changes move rather than cut, wherever they currently cut.

## Sources

- [Take control of your scroll — customizing pull-to-refresh and overflow effects (Chrome for Developers)](https://developer.chrome.com/blog/overscroll-behavior/)
- [You're blocking touchmove events to contain scroll. `overscroll-behavior` does it natively](https://bestpractic.org/blog/overscroll-behavior-scroll-containment)
- [Six Things I Learned About iOS Safari's Rubber-Band Scrolling](https://www.specialagentsqueaky.com/blog/six-things-i-learnt-about-ios-rubberband-overflow-scrolling/)
- [Implementing pull-to-refresh in React with Tailwind CSS (LogRocket)](https://blog.logrocket.com/implementing-pull-to-refresh-react-tailwind-css/)
- [Pull to refresh (overscroll and touch events) — Patrick H. Lauke](https://patrickhlauke.github.io/touch/pull-to-refresh/overscroll.html)
