# Phase 4: scrolling, what shipped and what is still unproven

Date: 14 August 2026.

**CONFIRMED IN THE FIELD, 14 August 2026, after this shipped.** Arthur, who
reported it, says the scrolling and the load-more above are both good now on his
iPhone. So the change fixed the defect on the engine it lives in. Everything
below was written before that confirmation and is left exactly as it was: it is
the record of shipping a fix I could not reproduce in the lab, and of what I
would have needed to close it if the field had said otherwise.

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

## What was needed to close it, and what closed it

The field closed it: the person who reported it says it is good on the device it
was reported on. That is the strongest evidence available for a defect that
exists only on an engine I have no copy of, and it is the reason the mechanism
in `plan.md` should be treated as the confirmed cause rather than the leading
theory.

The rest of this section is what I had asked for before that answer arrived:

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
