# Phase 4: scrolling in a long conversation

Reported by Arthur, on an iPhone **and** a MacBook, which is to say WebKit on
both:

1. "When scrolling up it looks very glitchy and broken. We noted it in channels
   pages with lots of messages, and also in normal conversation messages pages
   with a long conversation."
2. "On the channel messages page, when scrolled to the top and you click load
   more, it loads new messages in a very glitchy way. The new message doesn't
   appear smoothly above, it kind of moves the screen, which makes it jumpy."

## What the code says

Both transcripts skip the render work for off-screen message groups with
`content-visibility: auto`, and give each one a **guessed** height
(`contain-intrinsic-size`) to stand in until it is really laid out. The channel
feed guesses 96px per group; the conversation list guesses 240px, where a real
assistant answer is often 800 to 2000px.

Every time the browser replaces a guess with a real height **above** the
viewport, everything below it moves, and a reader scrolling up is standing below
it.

Chrome, Edge and Firefox absorb that silently through CSS scroll anchoring. The
app has been depending on it without saying so, except in one place where it
does say so, in the conversation list's own comment: "a height change costs
nothing (the browser's scroll anchoring absorbs it)". That is a true sentence
about Chrome and a false one about every Apple device shipping today: Safari has
never implemented scroll anchoring. It is fixed in WebKit and lands in Safari 27,
expected around September 2026.

The load-older restore is separately fine: it captures the distance from the
bottom before fetching and restores it in a layout effect, before paint. It is
exact at the instant it runs. The walking happens afterwards, as the guesses
settle.

## What we build

**Ask for the capability, not for the browser.** A new `useScrollAnchoring()`
tests `CSS.supports('overflow-anchor', 'auto')`, and the estimate-instead-of-
measure optimisation is gated on it in both transcripts.

- Where the browser can hold the reader's place, nothing changes.
- Where it cannot, every group is measured, nothing settles, and there is
  nothing for the missing capability to have absorbed.
- The day Safari 27 arrives those readers get the optimisation back with no code
  change and no version list to maintain.

It is false on the server, deliberately: the heavier, always-correct arrangement
paints first, and a browser that supports anchoring turns the optimisation on
after hydration.

## What we are not doing

- **No `flex-direction: column-reverse`.** It still freezes scrolling in iOS
  Safari in 2026.
- **No virtualization library.** The transcript has two sources (live and a
  window around a jumped-to message) and five documented owners of its scroll
  position; that is a project, not a fix, and it is the fallback only if
  measuring proves Safari cannot carry the DOM.
- **No tuning of the 96px and 240px guesses.** Better guesses shrink the jump.
  They cannot remove it.

## How it is verified, and the honest limit

Filmed in Chromium with scroll anchoring disabled by hand, and on a real WebKit
26. Both engines are recorded in `post-implementation.md`, including the fact
that neither of them reproduced the defect, and what that does and does not
prove.
