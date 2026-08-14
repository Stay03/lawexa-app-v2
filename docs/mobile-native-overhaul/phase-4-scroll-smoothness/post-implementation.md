# Phase 4: scrolling, what shipped and what is still unproven

Date: 14 August 2026.

**Read this before quoting the phase as done: the reported defect was not
reproduced, and this change is hardening rather than a proven fix.**

## What shipped

`v2/runtime/scroll-anchoring.ts` asks one question: does this browser keep the
reader's place when content above them changes height? Both transcripts now gate
their estimate-instead-of-measure optimisation on the answer.

- `v2/features/channels/feed/ChannelFeed.tsx`
- `v2/features/conversations/conversation/MessageList.tsx`

The conversation list's comment claiming "the browser's scroll anchoring absorbs
it" has been corrected: it was a statement about Chrome presented as a statement
about browsers, and it was the assumption underneath this whole phase.

## What was measured

**Chromium, anchoring disabled by hand, estimates on and off.** The gate works:
with `CSS.supports` told the truth about a browser without anchoring, the
transcript renders with **zero** estimated groups; with anchoring present, 22.
So the mechanism is wired correctly and provably switches.

**The defect did not appear in any condition.** Scrolling up 24 steps through
111 messages: 0 steps slipped, 0px worst, the total height never changed under
the reader. Same in all three conditions.

**Real WebKit 26.5, installed for this.** It reports
`CSS.supports('overflow-anchor', 'auto') === true`. The capability has landed in
WebKit trunk, so the engine available to me is already past the bug, and it too
showed 0 slip with estimates on and off.

## What that does and does not prove

It does **not** prove the fix works, and I will not claim it does.

- I have no engine that lacks scroll anchoring. Chromium has it, and the WebKit
  build I installed has it too. Arthur's Safari, shipping today, does not.
- One likely reason my Chromium reproduction stayed clean: to load older pages
  the film scrolls to the top, which renders those groups, and
  `contain-intrinsic-size: auto` then remembers their real heights. After that
  there is no guess left to settle. A real reader may hit the same thing, or may
  not, depending on how far ahead the browser renders.
- So the mechanism remains the best explanation for a defect that appears on an
  iPhone and a Mac and nowhere else, and this change removes the app's
  dependency on the missing capability. That is worth shipping on its own terms.
  It is not evidence.

## What is needed to close it

From Arthur, two facts and one recording:

1. His iOS version and his macOS Safari version. If either is Safari 27 or
   later, the capability is present and the cause is something else entirely.
2. Whether the jank happens **every** time he scrolls up through the same
   history, or only the first time. Every time points somewhere else. The first
   time only is exactly the shape of this mechanism.
3. A screen recording, which will show in one second what a paragraph cannot.

## Two suspects deliberately left alone

Neither matches the reported shape, and neither should be touched without film:

- The viewport-height keeper in the channel feed writes `scrollTop` whenever the
  scroller's height changes, which could in principle fire mid-gesture.
- The composer's `backdrop-blur` sits over the moving transcript, and stacked
  blur is a known cost on iOS.
