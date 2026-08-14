# Phase 6: edge gestures and sideways scrollers

## The problem

At the end of a sideways scroller the browser hands the flick on. On a desktop
Chromium that becomes a history navigation; in a WebView that gesture is the
system back-swipe. So flicking through a row of tabs or pictures could take the
reader off the screen they are on.

Counted in the code: **23 horizontal scrollers in v2**. Two were already
contained, both deliberately and both with the reason written next to them: the
statute country tabs, and the message image strip. The other twenty-one were
not.

Two of the twenty-one sit at the bezel, where the risk is highest: the notes
formatting toolbar, which is the only truly full-bleed scroller in the app, and
the reaction tray in the long-press sheet, about four pixels from the edge.

## The decision on swipe to go back

We do not build it in the browser. Confirmed with the owner: devices come with
their own.

- iOS runs an edge swipe that a web page cannot turn off, in Safari and in a
  home-screen PWA alike.
- Android runs the system gesture, claimed by the OS before the page sees it.
- A hand-built gesture therefore fires alongside them, so one swipe means two
  backs.
- Slack, Telegram and X ship none for exactly this reason.

`overscroll-behavior-x: contain` does **not** stop the system gesture and is not
meant to. What it buys is real and smaller: no accidental history navigation
from a scroller's end on Chromium, and no chaining into the document.

The version of swipe-back that is worth having lives in the wrapper apps, where
the native gesture is ours to switch on. Both switches are written down in
`post-implementation.md` for whoever builds those shells.

## What we change

- `overscroll-x-contain` on every one of the twenty-one unprotected scrollers,
  matching the two that already had it.
- The same declaration in the two stylesheets that own wide tables: the statute
  schedule tables and the radar report tables.

Two honesty fixes found on the way:

- `TabRow`'s docblock still described the statute country row as an edge-bleed
  wrapper. That stopped being true on 7 August when the bleed was removed.
- The case detail law-type tabs are data-driven and had **no scroller at all**,
  so a case with many law types overflowed its column with nothing to say so.

## What we do not do

- No JS edge-zone hacks. They are fragile, they break real scrolling, and iOS
  ignores them for the bezel swipe anyway.
- No insetting of the picture viewer's swipe area. It cannot stop the system
  gesture and would only cost edge taps. The platform already arbitrates, the
  viewer already handles the cancel, and the viewer is one history entry, so the
  system Back closes it exactly like the button does.
- No `overscroll-behavior-x: none`. `contain` is what the existing sites use and
  it keeps the local end-bounce.
