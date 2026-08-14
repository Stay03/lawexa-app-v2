# Mobile native overhaul

The v2 app is a good web app on a phone. It is not yet an app. This is the work
that closes that gap, in ten phases, in the order that stops any phase being
built twice. It began as nine; scrolling was added as phase 4 on 14 August when
Arthur reported it, because a defect people meet every day outranks polish and it
lives in code no other phase touches.

Owner brief, 14 August 2026: "for the native looking thing on mobile I don't
mind a massive rewrite. Fix issues in whole instead of quick fixes." And: "First
understand what I need check the codebase not docs and then do a fresh research
on what you understand from what I want to see the cleanest way to implement it,
no compromise."

Every phase in this folder has its own `plan.md` written after fresh research,
and its own `post-implementation.md` written after the work is filmed. Code is
the source of truth for research, not documents.

---

## What is wrong today, measured

These are findings from reading the code, not opinions.

**Nothing responds to a finger.** The shared press class `v2-interactive` exists
and is used in a small number of places. Everything else has either a `hover:`
style or nothing. Tailwind 4 compiles `hover:` inside `@media (hover: hover)`,
which never matches on a touch screen, so a hover-only control is a control with
no feedback at all on a phone. Tapping a case row changes zero pixels.

**A channel screen wears two hats before it says anything.** On a phone the
shell header is 56px and the place header is another 45px, and the channel's
identity is split across both. With the push nudge and a live quiz that becomes
four bars and about 197px before the first message, plus the notch inset.

**Back is a link, not a back.** There is no `router.back()` anywhere in v2 and no
history stack of the app's own. Every back control is a link to a computed
parent, which always pushes a new entry. Leaving a channel and pressing the
phone's back button returns you to the channel you just left. The one piece of
history intelligence in the app is the overlay stamp in `use-url-overlay.ts`.

**Four taps on the home screen reboot the whole app.** `HomeQuickJump` uses
plain anchors for Cases, Statutes, Notes and Quiz. Its comment says the reload is
deliberate because those routes fall through to v1. That stopped being true when
those routes migrated. It is mobile only, on the home screen, on the four most
used links in the product.

**Fifty overlays, none of them full screen.** 17 dialogs, 16 sheets and 17
confirmations. A dialog is a centred box with a screen-width cap. A side sheet is
three quarters of the width. About 15 of them are long forms or lists that want
to be screens on a phone.

**There is no create button.** Notes and radars create on real screens. Spaces,
channels, lists, quizzes and folders create in dialogs. Nothing floats.

**The wrong skeleton, then another skeleton.** There are 37 `loading.tsx` files.
Four segment boundaries (cases, statutes, notes, folders) are document shaped and
still wrap their own list route, because a route group adds an inner boundary and
does not remove the page from the outer one. Radars never got the route group at
all, so its list skeleton wraps its detail pages. On top of that, the v2 root
boundary is deliberately blank, so a cold section switch shows a blank beat and
then a skeleton, which reads as two skeletons.

**The message you were told about is not there when you arrive.** The full body
of a new message is broadcast only to the room of the channel that is currently
on screen. App wide, the client is told that something arrived and never what.
The transcript cache is deliberately never stale, so opening the channel paints
the old transcript instantly and the missed message only lands after a refetch
that starts once the screen is already drawn. That refetch is the "quick second"
the owner sees, and the message animating in is the thing appearing in front of
his eyes.

---

## The ten phases, and why in this order

The rule that decides the order: nothing may be built on a shape that a later
phase changes. Skeletons come after modals become screens, because each new
screen is a new route with its own loading state. Motion comes last, because
motion between screens needs the screens to be final.

| # | Phase | Why here | State |
|---|---|---|---|
| 1 | Touch feedback | Moves no structure, so it cannot clash with anything below. Felt on every screen the same day. | shipped `7fbb38d` |
| 2 | Warm transcript | Independent of layout. Fixes the notification path in the cache, not the UI. | shipped `4df2345` |
| 3 | Mobile header | The back control lives in the header, so the header shape must settle before back is rebuilt. | shipped `168c588` |
| 4 | Scrolling in a long conversation | A daily-use defect, reported from the field, in code nothing else touches. Moving it up cost nothing. | shipped `3359bb8`, confirmed by the reporter |
| 5 | Navigation and back | The history stack, real back controls, client side jumps, one create affordance. | shipped `ce0c0ea` |
| 6 | Edge gestures | Depends on 5 making every step a real history entry. | shipped `539f9b6` |
| 7 | Modals become screens, and the member list groups | Needs 3, 5 and 6, because a screen is only a screen if back works. | shipped `313d37d` + `91430ea` (member list), this wave (screens) |
| 8 | Skeletons | After 7, or twenty-two of them get written twice. | next |
| 9 | Motion and pull to refresh | On the shapes that are now final. | |
| 10 | Language sweep | Last, so it catches every word the nine phases above wrote. | |

### Phase 1, touch feedback

One press behaviour for the whole app, applied where it belongs rather than
sprinkled per component. The research settles the values: a press must be
instant on press and fade on release, it must not fire while the reader is
scrolling, and an opacity or colour change is exempt from reduced motion while a
scale change is not.

### Phase 2, warm transcript

The app already knows, at notification time, the channel, the message id and a
text preview. It never uses them to warm the transcript. This phase warms page
one of the channel's messages when the unread event arrives, so opening the
channel is a cache read. Where a backend change would make this exact rather than
approximate, that ask is written and taken to backend.

### Phase 4, scrolling in a long conversation

Both transcripts guess the height of off-screen messages, and Chrome quietly
corrects the reader's position when a guess is replaced by the truth. Safari has
never had that feature, which is why this only ever showed on an iPhone and a
Mac. The guessing is now gated on the capability itself.

### Phase 3, mobile header

One bar on a phone. Back on the leading edge, the place identity as one tap
target that opens the details surface, one or two actions, and everything else in
an overflow. This is what every messaging app converged on and it is where about
45px of permanent chrome comes back.

### Phase 5, navigation and back

An app owned route stack so a back control knows whether there is anywhere to go
back to: pop when the parent is genuinely behind you, push only on a cold
landing. Plus the plain anchors that reboot the app, and one consistent create
affordance.

### Phase 6, edge gestures

Research says plainly: do not hand build swipe to go back in the browser. iOS
runs its own edge gesture that cannot be turned off, Android runs the system
gesture, and a custom one fires alongside them. Slack, Telegram and X ship none.
The correct work is to make every step a real history entry, protect every
horizontal scroller with `overscroll-behavior-x: contain`, and keep the two real
edge conflicts honest. A custom swipe is defensible only inside the Android and
iOS wrapper, where the native gesture is off and we own the edge, and the two
wrapper switches are named in that phase's plan.

### Phase 7, modals become screens

**It also carries the member list grouping.** Owner, 14 August: the channel and
thread member lists should separate who is here from everyone else. Decided the
same day, after checking what the data can actually support: three groups from
what we already receive, which is **here now**, **here but not looking** (a
member in the channel whose tab is in the background, which the room already
tells us and nothing has ever shown), and **everyone else**. No backend ask. It
is built here rather than sooner because this is the phase that rebuilds that
list as a screen, and doing it twice is the thing this order exists to prevent.

The long forms and the lists fill a phone screen and stay dialogs on a desktop,
from one element whose shape changes in CSS. Confirmations stay dialogs.

**AMENDED WHEN THE PHASE WAS BUILT, 14 August.** This section used to say the
forms become ROUTED screens, "one plain route rendered responsively". They did
not, and the reason is worth carrying forward: every one of these overlays is
already bound to `useUrlOverlay`, which pushes one stamped history entry on open
and pops its own entry on close — so hardware Back already closed them, and
after phase 6 the edge swipe did too, because the edge swipe IS hardware Back.
Twelve real routes would have added a path the reader cannot see, twelve loading
boundaries for phase 8 to write, and a second mechanism doing the first one's
job with two ways for them to disagree. The gap was never routing. It was
geometry. The full argument is in the phase folder's `plan.md`.

### Phase 8, skeletons

One skeleton per destination. Kill the wrong shape, kill the chain, and keep the
house discipline of a still fallback handing over to a pulsing one only where the
geometry is identical.

### Phase 9, motion and pull to refresh

Movement between screens, and pull to refresh on the lists that a person expects
to pull.

### Phase 10, language sweep

Every word this overhaul wrote, checked for the em dash the owner does not want,
and for plain language.

---

## How each phase is worked

1. Research first, and code beats documents. Online research for the technique,
   codebase research for what is actually there.
2. `plan.md` in the phase folder, precise enough to build from.
3. Build it clean. No quick fixes, no `any`, no TODO left behind.
4. Gates: `npx tsc --noEmit`, `npx eslint`, and `V2_ENABLED=true npx next build`.
   Never prettier, this repo has no config for it.
5. Film it with Playwright at phone size against real data. The gates have never
   once caught a defect that mattered on this work. Every defect found in the
   image strip was found on film.
6. `post-implementation.md`: what shipped, what was measured, what was left.
7. Commit, push, and say so in the channel.

## Phase folders

- `phase-1-touch-feedback/`
- `phase-2-warm-transcript/`
- `phase-3-mobile-header/`
- `phase-4-scroll-smoothness/`
- `phase-5-navigation-and-back/`
- `phase-6-edge-gestures/`
- `phase-7-modals-to-screens/`
- `phase-8-skeletons/`
- `phase-9-motion-and-refresh/`
- `phase-10-language-sweep/`
