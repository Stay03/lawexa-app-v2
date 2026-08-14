# Phase 7 — modals become screens

Owner brief, 14 August 2026, for the overhaul as a whole: "for the native
looking thing on mobile I don't mind a massive rewrite. Fix issues in whole
instead of quick fixes."

This phase also carried the member list grouping, which shipped first as its own
wave (`313d37d`, files landed in `91430ea`). What follows is the rest.

---

## What is actually wrong, measured in the code

There are 17 `DialogContent` call sites and 17 `SheetContent` call sites in
`v2/`. They do not all have the same problem, and the interesting finding is
that most of them are already right.

### The dialogs that are forms are the wrong shape on a phone

`DialogContent` is a centred card: `max-w-[calc(100%-2rem)]`, capped at
`max-h-[calc(100dvh-2rem-var(--keyboard-inset,0px))]`, with its own scroller.
That cap was added on 7 August after Arthur photographed a space form measuring
~1,115px on a 360px phone with Save, Cancel and the close X all off-screen at
once. **The cap made it reachable. It did not make it right.** What a phone
shows today is a form in a box, inset 16px on each side, floating over a page
you can still half see, with a scroll region inside a scroll region.

Nine call sites are long forms or long pickers:

| File | Today | Why it is a screen |
|---|---|---|
| `spaces/dialogs/SpaceFormDialog.tsx:295` | `sm:max-w-2xl`, three bands | Tallest form in the app. Two `ChoiceCards` groups stack below `sm:` at ~217px each. |
| `channels/quiz/QuizFormDialog.tsx:346` | `max-h-[90vh] sm:max-w-2xl` | Longest. Already three bands because it had to be. |
| `spaces/dialogs/ChannelFormDialog.tsx:133` | `sm:max-w-lg` | Name, purpose, visibility cards. |
| `channels/dialogs/ChannelEditDialog.tsx:102` | default | Same fields as create. |
| `organizations/OrganizationFormDialog.tsx:102` | `max-h-[90vh] overflow-y-auto` | The `max-h-[90vh]` is the tell: it was already too tall. |
| `channels/lists/ListFormDialog.tsx:140` | `max-h-[90vh] overflow-y-auto` | Same tell. |
| `organizations/RequestVerificationDialog.tsx:110` | default | CAC number plus a file upload. |
| `channels/members/InviteMemberDialog.tsx:166` | default | Search field over a results list of unknown length. |
| `collab/membership/InvitePeopleDialog.tsx:132` | default | Same, and it opens stacked on top of a members sheet. |

### Four side sheets are three quarters of a phone, and one of them looks fixed

`SheetContent` sizes itself with `data-[side=right]:w-3/4` and
`data-[side=right]:sm:max-w-sm`. **An attribute selector outranks a bare class
of the same specificity written later**, so a caller passing `w-full` does not
win — it is a dead class. The channels wave learned this and every sheet it
built passes `data-[side=right]:w-full`. Four sheets predate or missed it:

| File | className | State |
|---|---|---|
| `invites/ChannelJoinRequestsSheet.tsx:42` | `overflow-y-auto` | 3/4 width, never tried to be full |
| `spaces/detail/SpaceScreen.tsx:191` (invite links) | `overflow-y-auto` | 3/4 width |
| `spaces/detail/SpaceScreen.tsx:205` (waiting list) | `overflow-y-auto` | 3/4 width |
| `radars/detail/SettingsSheet.tsx:69` | `w-full … sm:max-w-xl` | **3/4 width, and reads as fixed.** The bare `w-full` loses to the attribute selector. |

The last row is the one worth naming. Somebody already decided that sheet should
be full width, wrote the class that says so, and the sheet is still three
quarters. A rule that silently discards a caller's stated intent is worse than
no rule.

### What is already right, and is being left alone

Six sheets built in the channels wave already pass the variant-matched width and
are full-screen on a phone: `ChannelMembersSheet`, `ThreadsSheet`,
`MessageCollectionSheet`, `QuizLibrarySheet`, `ChannelAiSessionsSheet`,
`MembersSheetFrame`. They are the proof the pattern works. They are not touched.

Eight dialogs are short and stay dialogs: `RequestCaseDialog`,
`ConnectionRequestDialog`, `PastedContentCard`, `FolderNameDialog`,
`LinkDialog`, `ReviewDialog`, `ShareDialog`, and the `FolderPicker` dialog. A
confirmation is a question, not a destination, and a full screen asking "are you
sure?" is a worse answer than a box.

---

## The decision that shrinks this phase

The main plan said these become "routed screens on a phone … using one plain
route rendered responsively". **That is no longer the cheapest correct thing,
because the routing half already exists.**

Every one of these overlays is already bound to `useUrlOverlay`. That hook
pushes exactly one history entry when a panel opens, stamps it, and pops its own
entry on close. So today, on a phone, the hardware Back button already closes
every one of these — and after phase 6 the edge swipe does too, because the edge
swipe is the hardware Back.

What a reader gets from a real route that they do not already have is a path in
an address bar they cannot see. What it would cost is twelve new route files,
twelve new loading boundaries for phase 8 to write, and a second mechanism doing
the job `useUrlOverlay` already does, with two ways for them to disagree.

**So the remaining gap is geometry, and only geometry.** Build the geometry,
keep the mechanism.

This is written down because it contradicts the main plan, and a plan that is
quietly departed from is a plan nobody can trust. The main plan's table row for
phase 7 is amended to match.

---

## The mechanism: `v2/shell/overlay/ResponsiveOverlay.tsx`

One v2-layer component. It composes `Dialog`, `DialogPortal`, `DialogOverlay`,
`DialogSurface`, `DialogTitle`, `DialogDescription` and `DialogClose` from
`components/ui/dialog`. **It does not modify `components/ui`**, which ships to
v1 unchanged.

`DialogSurface` exists for exactly this: the Radix machinery (focus trap,
Escape, `aria-modal`, dismissable layer) with no geometry of its own. Expressing
a full-screen shape through `DialogContent`'s `className` would mean unpicking
`grid`, `gap-6`, `p-6`, `rounded-4xl`, two `max-w` breakpoints, `top-1/2
left-1/2` and both translates, one conflicting utility at a time.

### One element, two shapes, no JavaScript breakpoint

The shape changes at `md:` in CSS. There is no `useMediaQuery`, and there must
not be:

- A JS breakpoint has no answer on the server, so the first paint is a guess and
  the correction is a flash.
- Swapping between two different Content elements on resize **remounts the
  subtree**, which throws away every keystroke typed into the form.

One element whose classes change is free of both.

### The three hazards this must honour

1. **Never mount the surface conditionally on `open`.** `Dialog open={open}` is
   always rendered and Radix Presence unmounts the surface after the exit
   animation. A wrapper that returns `null` when closed kills the exit, which
   the house motion rule forbids (`feedback_smooth_motion_and_skeletons`).
2. **The overlay carries the scroll lock.** A `DialogSurface` rendered without a
   sibling `DialogOverlay` inside the portal has no lock. It stays even on a
   phone, where it is invisible behind an opaque full-screen surface.
3. **The keyboard is only visible to CSS on one platform.** Android resizes the
   layout viewport and `dvh` tracks it. iOS overlays and `dvh` learns nothing;
   only `--keyboard-inset` (published by `v2/shell/use-keyboard-inset.ts`)
   knows. A full-screen surface pinned to `inset-0` puts its footer behind the
   iOS keyboard. So the phone surface takes its height from
   `calc(100dvh - var(--keyboard-inset,0px))`, not from `bottom-0`.

### Geometry

Phone (default), desktop (`md:` = 48rem, the same breakpoint phase 3's bar uses):

```
surface   fixed inset-x-0 top-0, height 100dvh − keyboard inset, flex column,
          opaque, slides up from the bottom
          md: centred card, capped height, rounded, ring, zoom in
bar       shrink-0, sticky, pads itself out of the notch with
          env(safe-area-inset-top); back chevron on the leading edge, title
          centred-left, optional action on the trailing edge
          md: the plain title block, X in the corner
body      min-h-0 flex-1 overflow-y-auto overscroll-contain  (both shapes)
footer    shrink-0 border-t, bottom padding = env(safe-area-inset-bottom)
          md: the usual right-aligned button row
```

`overscroll-contain` on the body matters here for the same reason it mattered in
phase 6: without it a flick past the end of the form scrolls the page behind.

### API

```tsx
<ResponsiveOverlay
  {...binding}                 // open / onOpenChange from useUrlOverlay
  title="Create a space"
  description="A space groups channels for one team, one matter or one subject."
  footer={<>…Cancel…Create…</>}
  className="md:max-w-2xl"     // desktop width only; the phone is always full
>
  {fields}
</ResponsiveOverlay>
```

`title` is required, because `DialogTitle` is required for `aria-labelledby` and
Radix warns without it. `description` is optional and renders through
`DialogDescription`. `footer` is optional; when absent the footer band is not
rendered at all rather than rendered empty.

---

## Waves

Each wave is built, gated (`tsc`, `eslint`, `V2_ENABLED=true next build`) and
filmed at phone width against real data before the next starts.

- **Wave 1 — the mechanism and the flagship.** `ResponsiveOverlay`, then
  `SpaceFormDialog`. The tallest form is the honest first test.
- **Wave 2 — the other forms.** `ChannelFormDialog`, `ChannelEditDialog`,
  `OrganizationFormDialog`, `ListFormDialog`, `RequestVerificationDialog`.
- **Wave 3 — the three-quarter sheets.** The four in the table above. These do
  not need `ResponsiveOverlay`; they need the variant-matched width class the
  channels wave already proved. Fixing them by adding one correct class is the
  clean fix, not a compromise. `SettingsSheet` also gets its dead `w-full`
  removed rather than left beside the class that replaces it.
- **Wave 4 — the stacked invites.** `InviteMemberDialog` and
  `InvitePeopleDialog`. Stacked on top of a members sheet, so the thing to prove
  on film is that Back unwinds them one at a time in the order they were opened.
- **Wave 5 — the quiz form.** `QuizFormDialog`, last because it is the longest
  and already has three bands of its own to reconcile.

## What is deliberately not in this phase

- A floating create button. The main plan puts one create affordance in phase 5,
  where it belongs; it is not re-opened here.
- Any change to `components/ui`. v1 is not in this overhaul.
- The eight short dialogs. They are correct.

## Done means

1. Every long form fills a phone screen, with its primary action visible without
   scrolling at 360px, 393px and 430px wide.
2. No overlay in `v2/` renders at three quarters of a phone's width.
3. Hardware Back closes each one, and stacked ones unwind in order.
4. The keyboard never covers a footer button on either platform's model.
5. A desktop sees no change at all. This is the regression test that matters
   most, because it is the half nobody is looking at.
