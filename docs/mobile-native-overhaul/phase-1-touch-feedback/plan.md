# Phase 1: touch feedback

Every tappable thing in the app answers a finger, in one place, with one
behaviour, in the grammar a phone already uses.

## What is there today, measured

Counted by a static scan of all 591 files under `v2/` and `app/v2/`, reading
each JSX opening tag. Numbers are code sites, not rendered elements, so a row
that renders 40 times counts once. Treat them as plus or minus 5 percent,
because 46 sites build their class list at runtime.

| Feedback a finger gets | Sites | Share |
|---|---|---|
| A real press state | 15 | 2.1% |
| A focus flash inherited from a Radix menu item | 72 | 9.9% |
| A switch or checkbox flipping | 9 | 1.2% |
| **Nothing at all** | **633** | **86.8%** |

Total tappable sites: 729, across 222 files. 283 are `<Button>`, 163 are plain
`<button>`, 147 are `<Link>`, 72 are menu or select items, and the rest are
anchors, inputs, switches and a handful of click handlers on a div.

Two findings make this worse than the table looks.

**`hover:` is dead on a phone.** Tailwind 4.1.18 compiles every `hover:`
utility inside `@media (hover: hover)`, and this repo defines no override. 464
of the 633 have a hover style and it never runs on a touch screen. Hover-only is
not weak feedback on a phone, it is no feedback.

**The class that looks like the press system is a highlight remover.**
`v2-interactive` is on 135 files. It is this, and only this:

```css
.v2-interactive {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

`-webkit-tap-highlight-color: transparent` takes away the grey flash the browser
would have drawn by itself. The comment above the rule says the replacement
`:active` states are "enforced in phase-2+ components". For 633 of 729 sites
that never happened. So on 135 files we removed the only feedback there was.

**A press state that has never once fired.** Nine bookmark stars put
`active:scale-90` on the icon inside the button rather than on the button.
`:active` matches the pressed element and its ancestors, never its children, so
the star only shrinks if the finger lands exactly on the 16px glyph inside a
36px target. Files: `BookmarkButton.tsx:69,92`, `StatuteBookmarkButton.tsx:59,82`,
`NoteBookmarkButton.tsx:62,85`, `BookmarkRow.tsx:358`,
`AddToFolderButton.tsx:53`, `FolderItemRow.tsx:218`.

## What a press should be, from the platforms

Researched from vendor source, not from opinion.

| Thing | Value | Where it comes from |
|---|---|---|
| Pressed state layer | 12% of the content colour | Material 3 system state tokens, `md-sys-state` v0_192 |
| Press duration band | 100 to 200ms, standard easing `cubic-bezier(0.2, 0, 0, 1)` | Material motion tokens |
| Wait before showing a press inside a scroller | 100ms | AOSP `ViewConfiguration.TAP_TIMEOUT`, applied by `View.java` only when `isInScrollingContainer()` |
| Minimum time a press stays visible | 64ms | AOSP `ViewConfiguration.PRESSED_STATE_DURATION` |
| Movement that cancels a press | 8dp | AOSP `TOUCH_SLOP` |
| iOS pressed appearance | content drops to about 0.2 opacity, instant on press, animated on release | SwiftUI default button style, measured by objc.io S01E399 |
| iOS press inside a scroll view | delayed, interval undocumented | Apple `UIScrollView.delaysContentTouches`, default true |
| Reduced motion | a colour or opacity change is NOT motion animation and stays on; a scale change IS and must go | W3C Understanding WCAG 2.3.3 |

Two behaviours are common to both platforms and are the whole point of this
phase:

1. **Instant on press, eased on release.** Not a 150ms fade in. The 15 press
   states we do have all sit on elements with `transition-colors`, so they ease
   in over 150ms, which is backwards.
2. **No press while scrolling.** Both platforms delay the press inside a
   scroller so a flick does not light up whatever the finger landed on. Material
   Web waits 150ms, Ionic waits 200ms and is criticised for feeling slow. AOSP
   waits 100ms, which is the number we take.

## What we are building

A press system, not a press class. One controller and one rule, so a new button
written next month is covered by writing nothing.

### 1. The controller: `v2/runtime/press.ts`

A single passive `pointerdown` listener on the document, mounted once by the v2
layout.

- On pointer down, find `target.closest()` of the interactive set:
  `button`, `[role="button"]`, `[role="tab"]`, `[role="menuitem"]`,
  `[role="option"]`, `a[href]`, `summary`.
- **Only the closest one is marked.** This is why a controller exists and a bare
  CSS `:active` rule does not: `:active` matches the pressed element *and every
  ancestor*, so a button inside a row would dim both. A message row holds up to
  15 nested tappables.
- Skip anything disabled, `aria-disabled`, or carrying `data-press="none"`.
- Touch or pen inside a scrollable ancestor: arm a 100ms timer, and mark the
  element when it fires. Mouse, or nothing scrollable above it: mark immediately.
  This is exactly AOSP's rule.
- Cancel on `pointercancel` (the browser fires it the moment it takes the gesture
  for a scroll), on `pointerup` outside the element, and on movement over 8px.
- Once marked, keep the mark for at least 64ms so a fast tap is still seen.
- The controller adds two attributes: `data-press-host` once, permanently, and
  `data-pressed` for the duration of the press.

### 2. The rule: `v2/shell/shell.css`

```css
@layer utilities {
  html.v2-document-lock [data-press-host] { /* the release */ }
  html.v2-document-lock [data-press-host][data-pressed] { /* the press */ }
}
```

Three constraints, each found in the code rather than guessed:

- **It must be layered.** `shell.css` rules today are unlayered, and unlayered
  CSS beats Tailwind v4's `@layer utilities`. An unlayered rule would silently
  override the 15 existing `active:` utilities instead of composing with them.
- **It must be scoped to `html.v2-document-lock`.** `shell.css` is imported by
  the v2 layout but stays in the head after a soft navigation into v1. A bare
  `button` selector would restyle the app the live users are on.
- **The press channel is opacity, not background.** Background is the channel the
  existing 15 use, and it is also the one thing we cannot set without knowing
  what the element's own background is. Opacity is what iOS does, works on any
  element, and composes with a tint where one exists.

Values: opacity `0.62` on press, instant; back to 1 over 150ms on release with
Material's standard easing. No scale in the global rule, because scale is motion
under WCAG 2.3.3 and would have to be switched off again for anyone who asks for
less motion.

### 3. The sweep

- Fix the nine bookmark stars so the press is on the button.
- Take the ad-hoc `active:` classes off the sites where the shared system now
  says the same thing, and keep only the ones that are deliberately different
  (the reaction pill's scale, the quiz answer card).
- Put `data-press="none"` on: the drag grip in `ListItemRow.tsx`, switches and
  checkboxes, text inputs and search fields, and the scroll containers that use
  `:active` themselves (`.v2-quiet-scroll`).
- Leave the message row alone as a press host, but make sure its nested
  tappables are the thing that marks, which the closest-ancestor rule already
  guarantees.

## What we are NOT doing

- No ripple. It is Android's grammar, not iOS's, and this app has one look on
  both.
- No haptics. There is no reliable web API for a press-weight haptic and
  `navigator.vibrate` is not it.
- No minimum display time at the data layer, and no delay on anything except the
  scroll guard above.

## How it is verified

Gates first: `npx tsc --noEmit`, `npx eslint`, and `V2_ENABLED=true npx next build`.
Then film it, because the gates have never caught a defect that mattered on this
work.

Playwright, at 390x844 with touch on, against real screens:

1. A press on a case row, a channel row, a Button and a tab shows the state.
   Measured as computed opacity while the pointer is down, not by looking.
2. A flick that starts on a row does NOT light it up. This is the one that
   matters and the one a human tester would never do reliably.
3. A fast tap still shows the press for at least 64ms.
4. A press on a button inside a row marks the button and not the row.
5. A disabled control never marks.
6. The drag grip never marks, and reordering a list still works.
7. Nothing regressed on desktop hover.

## Definition of done

Every tappable in v2 answers a finger, none of them lights up during a scroll,
the nine dead press states are alive, and the numbers above are re-measured and
recorded in `post-implementation.md`.
