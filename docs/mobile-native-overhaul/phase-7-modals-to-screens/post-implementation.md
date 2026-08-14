# Phase 7 — post-implementation

Two waves shipped separately.

- **Wave 0, the member list grouping** — `313d37d`, with the two new modules
  landed in `91430ea`. See "What went wrong" below; that split was a mistake,
  not a plan.
- **Waves 1 to 5, modals become screens** — this record.

---

## What shipped

### One new component, `v2/shell/overlay/ResponsiveOverlay.tsx`

A full screen on a phone, the familiar centred card from `md:` up, from one
element. It composes `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogSurface`,
`DialogTitle`, `DialogDescription` and `DialogClose`. **`components/ui` is
unchanged, so v1 ships exactly as before.**

The shape changes in CSS, never in JavaScript. Two reasons, both written into
the file so nobody "tidies" them away: a JS breakpoint has no answer during the
server render, so the first paint is a guess and the correction is a flash; and
swapping between two Content elements on resize remounts the subtree, which
throws away every keystroke already typed — and a phone rotating to landscape
crosses 48rem.

### Twelve conversions

| # | File | Was | Is |
|---|---|---|---|
| 1 | `spaces/dialogs/SpaceFormDialog.tsx` | centred card, `sm:max-w-2xl` | screen / `md:max-w-2xl` |
| 2 | `spaces/dialogs/ChannelFormDialog.tsx` | centred card | screen / card |
| 3 | `channels/dialogs/ChannelEditDialog.tsx` | centred card | screen / card |
| 4 | `organizations/OrganizationFormDialog.tsx` | `max-h-[90vh]` card | screen / card |
| 5 | `channels/lists/ListFormDialog.tsx` | `max-h-[90vh]` card | screen / card |
| 6 | `organizations/RequestVerificationDialog.tsx` | centred card | screen / card |
| 7 | `channels/members/InviteMemberDialog.tsx` | centred card, 3 footers | screen / card, one footer |
| 8 | `collab/membership/InvitePeopleDialog.tsx` | centred card | screen / card |
| 9 | `channels/quiz/QuizFormDialog.tsx` | `max-h-[90vh]`, 3 bands | screen / card |
| 10 | `invites/ChannelJoinRequestsSheet.tsx` | sheet at 75% of a phone | full width |
| 11 | `spaces/detail/SpaceScreen.tsx` ×2 | sheets at 75% | full width |
| 12 | `radars/detail/SettingsSheet.tsx` | **said `w-full`, was 75%** | full width |

Row 12 is the one worth keeping. `SheetContent` sizes itself with
`data-[side=right]:w-3/4`, and **an attribute selector outranks a bare class of
the same specificity however late it is written** — so the plain `w-full` that
somebody had already written there was a dead class, silently discarded. The
sheet read as fixed and opened at three quarters of a phone. All four now use
the variant-matched form the channels wave had already proved.

### Two changes that were not asked for and are better

`InviteMemberDialog` had three `DialogFooter`s, one inside each tab's branch,
and two of them were the same button. They are one footer chosen by tab now.
`QuizFormDialog`'s consequence line was a `<p>` inside `DialogDescription`,
which is itself a `<p>` — markup the browser silently rewrites, closing the
outer paragraph early and orphaning the sentence outside the element the dialog
is described by. It is a `<span class="block">` now.

---

## The decision that shrank this phase, and why it contradicts the main plan

The main plan said these become "routed screens on a phone … using one plain
route rendered responsively". They did not, and the plan has been amended rather
than quietly departed from.

**The routing half already existed.** Every one of these overlays is bound to
`useUrlOverlay`, which pushes exactly one stamped history entry on open and pops
its own entry on close. Hardware Back already closed them; after phase 6 the
edge swipe did too, because the edge swipe *is* hardware Back.

A real route would have added a path the reader cannot see, twelve route files,
twelve loading boundaries for phase 8 to write, and a second mechanism doing the
job the first already does — with two ways for them to disagree. The gap was
never routing. It was geometry.

---

## Measured, at 360 / 390 / 430 px, against a live server and real data

Every number below was read off the element, not inferred.

**Geometry.** Fourteen overlays measured. Every one: surface width equals
viewport width, `left: 0`, `top: 0`, height equals viewport height. Zero page
errors across every run.

| Overlay | Result |
|---|---|
| Edit space | 390/390, full height, body scrolls 630→793 |
| Create a channel | 390/390 |
| Edit channel | 390/390 |
| New list | 390/390, "Create list" in view |
| Create an organization | 390/390, "Create organization" in view |
| New quiz in general | 390/390, stacked on the library sheet, "Create quiz" in view |
| Invite to My Workspace | 390/390 |
| Invite to general | 390/390 |
| Invite by link (space) | 390/390 |
| Waiting to join (space) | 390/390 |
| Waiting to join (channel) | 390/390 |
| Members (space, channel) | 390/390 (already correct, re-checked) |

At 360px and 430px the space form measured 360/360 and 430/430, with Save and
Cancel both fully in view at all three widths. Before this phase that form was
~1,115px of content in a box inset 16px each side.

**Desktop is unchanged.** At 1280×800 the space form is a centred card: 672px
wide (`max-w-2xl` exactly), 623px tall, left 304 with 304 to spare on the right,
`border-radius: 23.2px`, back chevron hidden, Save right-aligned in the footer.
This was the regression that mattered most, because it is the half nobody is
looking at.

**Back unwinds a stack one layer at a time.** Opened by tapping, not by URL —
opening both by URL puts them on one entry and proves nothing.

| Step | Channel | Space |
|---|---|---|
| roster open | 1 layer, `?panel=members` | 1 layer, `?roster=1` |
| tap Invite | 2 layers | 2 layers, `?roster=1&invite=1` |
| Back | 1 layer, invite gone | 1 layer, invite gone |
| Back | 0 layers, query empty | 0 layers, query empty |

---

## One defect the film caught, which no gate could have

**A form screen opened with the Close button focused.** Radix focuses the first
focusable element on open. In a card that is the first field, which is what a
desktop wants. In the new shape the first focusable is the back chevron, because
a phone bar puts it on the leading edge — so a reader opening a form to fill in
arrived with the way out lit, and a screen reader announced the exit before the
thing itself. It was visible in the first phone frame as a ring around the
chevron.

Fixed by declining the auto-focus below `md:` and placing focus on the surface:
nothing lit, no keyboard springing up uninvited, the reader taps the field they
want. Measured after the fix — phone: focus on the surface, not the chevron;
desktop: focus still on the Name input, unchanged.

Reading `matchMedia` there is not a render-time breakpoint. It runs once, in an
event, after mount: no server answer to get wrong, no hydration to diverge, and
no remount on a later resize because the focus has long since happened. That is
why the shape is CSS and only this is not.

The title also sat tight against the chevron at `gap-1`; it is `gap-2` now, the
same as the channel bar phase 3 built.

---

## What is not filmed, and why

Two conversions could not be exercised against real data from this account:

- **`RequestVerificationDialog`** needs an organization to exist. This account
  has none, and creating one on production to take a screenshot is not a
  reasonable trade.
- **`radars/detail/SettingsSheet`** needs a radar. `GET /api/radars` returns an
  empty list for this account.

Both are stated rather than implied. The `SettingsSheet` change is one class,
identical in shape to the three sibling sheets that *are* filmed full width, and
the verification form went through the same conversion as the eight forms that
are. That is an argument for low risk, not evidence, and it is not written here
as evidence.

---

## What went wrong

**The member-list commit went out without its own new files, and broke the
deploy.** `git commit -- <paths>` commits tracked, modified files matching those
paths and says nothing about untracked ones. The local `next build` passed
because the files were on disk. Production failed on
`Can't resolve './PresentMemberRow'`.

The rule that came out of it, now in memory and followed for this commit: `git
add` the new files first, then `git commit -- <paths>`, then run `git ls-files
--others --exclude-standard` and confirm it prints nothing of yours. **A local
build cannot catch this. Only the file list can.**

**A `next build` failed on a corrupt `.next/dev/types/routes.d.ts`** — the dev
server had been killed mid-write. Not a code error; `rm -rf .next/dev` and
rebuild. Worth knowing, because the error it prints is a type error in a file
nobody wrote.

---

## Left for later

- **The eight short dialogs stay dialogs**, deliberately: `RequestCaseDialog`,
  `ConnectionRequestDialog`, `PastedContentCard`, `FolderNameDialog`,
  `LinkDialog`, `ReviewDialog`, `ShareDialog`, the `FolderPicker` dialog. A
  confirmation is a question, not a destination.
- **Six sheets were already right** and were not touched:
  `ChannelMembersSheet`, `ThreadsSheet`, `MessageCollectionSheet`,
  `QuizLibrarySheet`, `ChannelAiSessionsSheet`, `MembersSheetFrame`.
- **Phase 8 inherits no new routes**, which was the point of not building any.
