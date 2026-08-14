# Phase 3: one bar on a phone, what shipped

Date: 14 August 2026.

## Measured, before and after

| Phone, inside a channel | Before | After |
|---|---|---|
| Shell header | 56px | **0px** (it stands down) |
| Screen bar | 45px | 57px |
| Both, always | 101px | **57px** |
| Worst case, with the push ask and a live quiz | ~197px | ~106px |

Desktop at 1280 is unchanged: 56px shell bar, 57px place bar, byte for byte the
same controls. A normal page on a phone still has its 56px shell bar.

## What the one bar carries

Back, the crest, the channel name with one subtitle line under it, who is here
now, and one overflow. The identity is a single tap that opens the channel's
details, which is what every chat app trains a reader to expect.

The subtitle says the most useful true thing available: the description if there
is one, else where a thread branched from, else who can see the channel.

## The three calls I made rather than asked

1. **The bell left the phone channel bar.** No chat app puts a global inbox
   inside a conversation, and it is one Back away. Mentions still arrive as a
   toast.
2. **The hamburger left it too.** Back replaces it, and the channel list is in
   the space lobby that Back leads to.
3. **The push ask moved to the bottom**, above the composer.

All three are reversible in a line if the owner disagrees.

## What the film caught that the gates did not

The push ask, moved down beside the composer, **rendered translucent over the
transcript**: messages read straight through it. It had been a tinted full-width
row pinned under the header, where a tint was enough because nothing scrolled
behind it. The composer floats over the feed, so the ask now has a ground of its
own: opaque background, its own border, its own corners. Found on the first
frame of film, invisible to tsc, eslint and the build.

## How it works

The collab header context gained `barOwner`, published by `CollabFrame` as
`screen` on channel routes and `shell` on space routes. The shell bar hides
itself below `md` with a CSS variant, never a viewport hook, so the correct bar
paints before hydration.

The notch padding moved off the shell's header row and onto whichever bar is
showing. A row that pads itself for the notch and then shows nothing is a dead
strip, which is the trap the dock already documents for the bottom edge.

## Verified

- Phone, channel: shell bar 0px, screen bar 57px, no page errors.
- The identity opens `?panel=about`; **Back closes it**, like every other panel.
- Phone, thread: the same one bar.
- Desktop 1280: unchanged.
- Phone, a normal page: the shell bar is still there.

## Left for later

- The details sheet is a sheet, so phase 6 will convert it along with the rest
  when modals become screens.
- The nudge's own copy still has an em dash. Phase 9 sweeps it with everything
  else.
