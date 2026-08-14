# Phase 3: one bar on a phone

Owner, looking at a channel on his phone: the mobile header is "one mess we
currently have in v2 on normal pages and channels pages as well".

## What is there today, measured

On a phone a channel screen pins two full bars and can pin four:

| Bar | Height | What is on it |
|---|---|---|
| Shell header | 56px | hamburger, back chevron, crest, channel name, space name under it, bell, kebab |
| Place header | 45px | visibility glyph, purpose line, presence faces, overflow |
| Push nudge | ~36 to 56px | "turn on notifications", when it applies |
| Live quiz bar | ~49px | when a game is running |

Worst case is about 197px plus the notch, before the first message. And the
channel's identity is split across the top two: the shell bar names the place,
the place bar describes it.

Nothing else in the app does this. Every other screen publishes a title into the
shell bar and lets its own header scroll away. The channel screen is the outlier,
and it is the screen people live in.

## What every chat app does

Slack, Discord, WhatsApp, Telegram, iOS Messages, Teams and Signal all run **one
bar** on a conversation: back on the leading edge, the name with a subtitle under
it, one or two actions, an overflow. In every one of them **the name is a tap
target that opens the details**: purpose, members, files, pins, settings. None of
them carries a global notification bell inside a conversation, and none of them
hides the conversation header on scroll.

## What we build

**One bar on a phone, 56px, on the channel screen.**

- **Left**: the back chevron that is already there. Out of a thread it goes to
  the parent channel, out of a channel to the space lobby.
- **Middle, leading**: the crest, the channel name, and one subtitle line under
  it: the purpose when there is one, otherwise who can see the channel. **The
  whole cluster is one tap** and it opens the channel's details.
- **Right**: the presence faces, because who is here now is the one live thing
  worth a glance rather than a tap, and one overflow menu, which already carries
  the lenses on a phone.

**The details surface** is a new `?panel=about`, on the same overlay family as
every other panel, so Back closes it like the rest. It carries what the two bars
carried between them: the full description, who can see the channel, the space it
belongs to as a link, and the way into the roster.

**The shell bar stands down below `md` on channel routes.** It does not hide by
measuring the window: the collab header context gains a `barOwner` field, and the
shell bar hides itself with a CSS variant, so the right chrome paints before
hydration, which is a standing rule in this shell.

**Three calls I am making rather than asking, and flagging.**

1. **The bell leaves the phone channel bar.** No chat app puts one inside a
   conversation, the bar has room for four things and the bell is the fifth, and
   it is one Back press away. Mentions already arrive as a toast.
2. **The hamburger leaves it too.** Back replaces it. The channel list is in the
   space lobby that Back leads to.
3. **The push nudge moves to the bottom**, above the composer, as a card. An
   announcement at the bottom is the chat idiom, and the complaint is the stack at
   the top. The live quiz bar stays where it is: it is rare, live, self-removing,
   and it is a door that must be findable from any scroll position.

Worst case becomes about 105px instead of 197px, and the usual case is 56px.

## What we are not doing, and why

- **No hide-on-scroll.** No major chat app hides a conversation header, chat
  inverts the direction meaning (scrolling up is reading history, which would
  reveal the bar exactly when the reader wants the room), and this feed already
  has five documented owners of its scroll position. If hide-on-scroll ever
  ships it belongs on the reading screens, as its own phase.
- **Nothing changes at `md` and above.** The breakpoints are keyed to where the
  space rail docks and that scheme is coherent and uncomplained about.
- **No `position: fixed`.** The shell's height contract forbids it.
- **We do not shave the two bars.** The complaint is the count of bars and the
  split identity, not eleven pixels.

## Files, in order

1. `v2/features/collab/shell/collab-header.ts` — `barOwner`.
2. `v2/features/collab/shell/CollabFrame.tsx` — publish it.
3. `v2/shell/V2Header.tsx` — stand down below `md` when the screen owns the bar.
4. `v2/shell/AppShell.tsx` — the notch padding moves onto the bar that is
   showing, so a stood-down shell bar cannot leave a dead strip.
5. `v2/features/channels/screen/PlaceHeader.tsx` — the one-bar phone layout.
6. `v2/features/channels/screen/ChannelAboutSheet.tsx` — new.
7. `v2/features/channels/screen/ChannelScreen.tsx` — the panel, and the nudge.
8. `v2/features/channels/screen/states.tsx` — the skeleton follows the geometry.

## How it is verified

Gates, then film at 390x844: the total height of everything above the first
message, before and after; that the identity opens the details; that Back closes
it; that the desktop layout at 1280 is unchanged; and that the notch strip is
still painted.
