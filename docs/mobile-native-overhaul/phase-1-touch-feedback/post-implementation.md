# Phase 1: touch feedback, what shipped

Date: 14 August 2026.

## What is in the app now

**One controller.** `v2/shell/touch-press.tsx` is a single passive
`pointerdown` listener mounted by the v2 layout. It marks the closest
interactive ancestor of the finger with `data-pressed`, and nothing above it.

**One rule.** `v2/shell/shell.css` styles that mark: opacity `0.62`, instant on
press, back over 150ms on Material's standard curve, scoped to
`html.v2-document-lock` so it cannot reach v1, and inside `@layer utilities` so
it composes with the deliberate press states rather than overriding them.

**The platform's numbers, not ours.**

| Behaviour | Value | Source |
|---|---|---|
| Wait before showing a press inside a scroller | 100ms | AOSP `TAP_TIMEOUT` |
| No wait for a mouse, or outside a scroller | 0ms | AOSP `View.isInScrollingContainer` |
| Minimum time the press stays visible | 64ms | AOSP `PRESSED_STATE_DURATION` |
| Movement that cancels it | 8px | AOSP `TOUCH_SLOP` |
| Release | 150ms, `cubic-bezier(0.2, 0, 0, 1)` | Material motion tokens |

**Nine dead press states removed.** The bookmark and folder stars carried
`active:scale-90` on the icon inside the button. `:active` never matches a
descendant, so that animation only fired if the finger landed exactly on the
16px glyph inside a 36px target. The shared press now answers those buttons, and
the dead classes are gone.

**One grammar, not thirteen.** Ten files carried their own `active:bg-*` tint on
a row. With the shared press they would have tinted and dimmed together, and the
rest of the app would only dim. The tints are gone; the two deliberate scale
presses stay, because a pill that shrinks is a different affordance on purpose,
and scale composes with a dim.

**One opt-out so far.** The drag grip in `ListItemRow.tsx` carries
`data-press="none"`: a grip stays down for a whole drag and the row it is moving
already shows that. Switches, checkboxes and radios are skipped in the
controller, because their own change of state is the feedback.

## What was measured

Filmed with Playwright at 390x844 with real touch through CDP, because
Playwright's own touchscreen can only tap and every question here is about what
happens between touch down and touch up.

| Check | Result |
|---|---|
| A tap too fast to see is still seen | held for 146ms, floor is 64ms |
| A held press stays down | opacity 0.62 |
| It lets go on release | nothing left marked |
| A flick lights nothing | nothing marked at all |
| A slow press that becomes a scroll clears | shown, then cleared the moment the finger moved |
| Only the closest tappable is marked | one element, never two |
| An opted-out control never marks | nothing marked |

Seven of seven.

**Coverage, against the production build:** 81 of 88 visible tappables across
Home, Cases, a channel, Notes and Spaces answered a finger. Every one of the
seven that did not was checked by hand: all seven sit inside an `aria-hidden`
collapsed region (the composer's chip row, the spaces invitations pill), where a
real finger cannot reach them either. So every tappable a person can actually
press, answers.

Before this phase the same measurement was 15 sites out of 729 with any press
state at all, and 633 with nothing on touch.

## What I got wrong on the way, and how it was caught

Three of the four failures in this phase were in my measurements, not in the app.
Worth recording, because each one would have produced a confident false report.

1. **The recorder was dead.** A Playwright init script runs before `<html>`
   exists, so `observer.observe(document.documentElement)` threw and the press
   recorder never recorded. It reported a working tap as "never marked".
2. **The probe pressed a menu open.** A Radix trigger opens on `pointerdown`,
   and an open Radix overlay sets `pointer-events: none` on the body. One press
   on an overflow button made every later probe land on `<html>` and score a
   miss: 23 of 98. Closing the overlay between presses took the same run to 83 of
   98.
3. **Stale rectangles.** Measuring all the positions up front and pressing them
   over the next six seconds meant most presses landed on whatever had moved into
   those coordinates while the page settled.

The lesson is the one this work keeps teaching: the gates were green in every
one of those runs. Only film finds this class of thing, and film has to be
checked as hard as the code.

## Left for later

- The v1 app has no press feedback either. Out of scope by design: this rule is
  scoped to the v2 document lock on purpose.
- Elements inside `aria-hidden` collapsed regions still have real rectangles and
  `pointer-events: auto`. Nothing can press them, so nothing is broken, but it is
  a smell worth a look when the composer is next opened up.
- `<Button>`'s own base still has no press state, so a Button used outside the
  v2 shell (in v1) still does nothing. Deliberate.
