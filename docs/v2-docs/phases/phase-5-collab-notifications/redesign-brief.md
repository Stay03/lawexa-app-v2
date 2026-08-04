# Spaces & Channels — redesign brief (2026-08-04)

Written after the owner tested the shipped phase-5 build. His verdict, verbatim:

> "the space page also needs a new design — in fact the whole space and channel needs a
> new UI/UX design, something nice, modern and creative: new components, new layout etc.
> The current one is just v1 design, no difference. Look at each screen, criticise it and
> come up with better UI/UX."
>
> "the create space needs a better and more creative design — feel free to create new
> components. I want a very professional, clean and sleek UI/UX."

Binding feel directive, unchanged from `design-research.md`:
**Discord's fluidity, Linear's cleanliness, our gold.**

Every claim about what exists today was read from the shipped code. This brief is the
input to the next wave; it is not a record of work done.

---

## The diagnosis

The wave shipped **correct behaviour inside a generic container**. Every collab screen is
the same object: `LIST_COLUMN` → a small toolbar → a `divide-y` stack of 36px-tile rows →
`CollabMessage` for all three non-happy states. A space, a channel, an invitation, a
bookmark and a case all render as the same row. We delivered Linear's cleanliness — and
specifically Linear's **document** cleanliness applied to a **place**.

Three structural failures cause most of the surface ones.

**1. There is no persistent place.** `/spaces` → `/spaces/{uuid}` → `/channels/{uuid}` are
three unrelated full-page routes. Nothing about the space survives into the channel except
a 14px text link in the channel's meta row (`ChannelScreen.tsx:339-345`). Switching channels
inside one space costs a back navigation, a list repaint and a second tap. That is the exact
opposite of "instant channel switching".

**2. There are no people.** `MemberAvatar` is initials in a circle, used in four places.
The spaces list, the space header, the channel header, the my-channels rows and the
invitation titles show member **counts as words** and zero faces — while
`components/ui/avatar.tsx` already ships `AvatarGroup` / `AvatarGroupCount`, unused
anywhere in collab.

**3. One row anatomy is doing five jobs.** `SpaceRow`, `SpaceChannelRow`, `MyChannelRow`,
`InvitationRow` and `ModuleRow` are the same 36px-tile + title + two-zone-meta + trailing
badge, and three of them privately re-declare an identical `Dot()` helper
(`SpaceRow.tsx:144`, `SpaceScreen.tsx:389`, `InvitationRow.tsx:170`). Uniformity was the
goal; sameness is the result.

---

## Ranked — top 8 by impact per effort

1. **Shared collab layout + `SpaceRail` / `SpaceDrawer`.** One persistent place; channel
   switching becomes a pane swap on desktop and one drawer tap on mobile. Converts "three
   pages" into "a product". *High effort. Decisive — nothing else fixes the core complaint.*
2. **`SpaceCrest` + `PresenceStack` everywhere** (list lanes, space header, channel header,
   invitation cards, my-channels rows, roster). Kills the grey-glyph monotony and puts people
   in a people product. *Low-medium effort — both are ~60-line components. Very high impact.*
3. **Create-space / create-channel as `ChoiceCards` + live preview + starter channels and
   invites.** Requested by name, and it removes the three-chained-empty-states path.
4. **`PlaceHeader` + `ActionCluster`** replacing the header on space / channel / organization.
   One header family, one hairline, faces instead of counts, a breadcrumb crest instead of a
   text link. *Three screens fixed at once.*
5. **Composer aligned to the transcript column, plus attach and typing-line alignment.**
   Removes the "borrowed from the AI chat" read in one file.
6. **`FeedDivider` hierarchy** (unread becomes dominant and gains "Mark as read"; day
   recedes) + per-row hover timestamps + `max-w-[66ch]` text measure.
7. **Promote `/channels` into the nav** with the global unread count on the row, and
   propagate the `last_message` preview into `SpaceChannelRow`. *Very low effort.*
8. **Density unification:** Files from cards → hairline rows with thumbnails; Lists index
   from rows → `ListCard` grid; delete `channels/members/MemberRow.tsx` for `RosterRow`.

---

## New shared components

| component | job |
|---|---|
| `SpaceCrest` / `OrgCrest` | The one identity mark — deterministic monogram + hue from uuid, sizes sm/md/lg, type glyph as a corner mark. Used in lanes, headers, rails, breadcrumbs, invitations. |
| `PresenceStack` | Overlapping member faces (+N) with a count label; clicking opens the roster. One answer to "who is here", replacing three different member affordances. **No presence dots** — that rule holds. |
| `PlaceHeader` | The header grammar for a *place*: crest, breadcrumb, name, kicker facts, `PresenceStack`, `ActionCluster`, optional section control. Shared by space, channel and organization. |
| `SpaceRail` | The persistent channel list for a space (docked on desktop, drawered on mobile) carrying the unread grammar, the active-channel state and the create affordance. |
| `ActionCluster` | The trailing action group: a segmented lens pair (pinned / saved) plus one labelled overflow. Ends the row of identical grey squares. |
| `ChoiceCards` | The radio-card primitive for product forks (Work vs Study, Personal vs Org, Public vs Private). Replaces four `Select`s that hide consequences behind a dropdown. |
| `FeedDivider` | One divider, variants `day` / `unread` / `session`, with real hierarchy — unread dominant with a mark-read action, day recessive. |
| `ChatComposerShell` | The transcript-width composer surface (attach · mention · emoji · textarea · send) with a staging-tray slot, reused by chat and by the Lists add-item composer. |
| `CollabEmpty` / `CollabFailure` | The split of today's one-size `CollabMessage`: empties teach and act with a ghost of the populated surface; failures are compact inline strips with retry. |
| `MetaLine` | The two-zone meta primitive — replaces six hand-rolled copies and three private `Dot()` helpers. |
| `RosterPanel` | One roster (search, role sections, self pinned, pending, inline invite panel) on `MembersSheetFrame`. Deletes the duplicate row and skeleton. |

---

## Screen by screen

### `/spaces` — the list
**Today:** `LIST_COLUMN` → pill `TabRow` (All/Work/Study) + Invitations button + New space →
`divide-y` `SpaceRow`s (36px grey type glyph, name, unread dot, lock, meta line, optional
2-line description, mention badge).
**Criticism:** a space has the same silhouette as a bookmark row. Two grey glyphs for fifty
spaces, so the list is read, never recognised. Type is encoded three times (glyph, word,
filter tabs). No faces, no last-activity time, no channel names, so it cannot be scanned by
liveness or content. Row height swings 2→4 lines against a 2-line skeleton.
**Keep:** one stream with type as a filter; `?type=` in the URL; the unread grammar; the
geometry-matched skeleton.
**Direction:** a **place lane** — `min-h-20`, `rounded-xl`, gap-separated objects with edges.
`SpaceCrest` 48px → identity column (name; second line = live **channel chips**, unread ones
gold) → right column `PresenceStack` over mention badge + last activity. Description leaves
the lane (it belongs on the space page). Invitations demotes to a `PendingPill` that only
renders when the count is above zero. Crest continuity: the same crest at the same hue on the
lane, the space header and the channel breadcrumb.

### `/spaces/[spaceId]` — space detail
**Today:** a case-style document header (11px glyph tile, kicker, `h1`, kebab) then
`Channels` + a `divide-y` of `SpaceChannelRow`.
**Criticism:** heading, hairline, list — and nothing else. No members strip, no recent files,
no "what happened here today". Members are a 12px text button. The channel rows are **poorer
than the cross-space rows**: `MyChannelRow` shows a last-message preview, `SpaceChannelRow`
shows a description. No ordering intelligence — a channel with 12 mentions can sit below three
dead ones. "New channel" is the quietest control on the page.
**Direction:** make the space a **layout, not a page**. A `SpaceShell` renders a persistent
`SpaceRail` (~240px) at `md:`+ holding the crest, name, `PresenceStack` and the channel list
with the unread grammar unchanged. Selecting a channel is a route change *inside* the frame, so
the rail never unmounts. The right pane becomes a lobby: `PlaceHeader` then a grid of
`SpaceDigest` blocks — Active today (unread channels with previews and faces), People, Recent
files, Lists in progress. Channels sort into Unread / Channels / Muted sections.

### Create space
**Today:** one `Dialog` — name `Input`, two side-by-side `Select`s (Type, Owner), description
`Textarea`, a privacy `Switch` in a bordered row, footer.
**Criticism:** the dialog-shaped form the owner rejected. The two decisions that define the
object are two identical grey dropdowns. Privacy's consequence is 12px muted text, quieter than
its own label. **No preview** — the user never sees the thing being made. And the flow guarantees
an empty room: create → empty space → dialog → create channel → empty channel. Three empty states
on the happiest path.
**Direction:** a **two-step composer** in `sm:max-w-2xl`, split left/right.
*Step 1 — Identity:* a borderless 24px title field, `ChoiceCards` for Type (glyph + one sentence
each), `ChoiceCards` for Owner when an org exists. Right: a **live `SpacePreview`** — the real
crest at 64px with the monogram updating as you type, rendered as the exact lane the list will
show.
*Step 2 — Open the doors:* privacy as `ChoiceCards`, an email chips input reusing
`InvitePeopleDialog`'s validation, and **starter-channel chips** (`general` on by default, plus
`matter`, `admin`, `research`) created in the same submit. On success, land in the first channel
with the composer focused.
Step transition: symmetric 180ms slide+fade of the left column only; the preview stays put.

### Edit space
Same dialog, one step, with a compact `PlaceHeader` strip at the top (crest + "12 members ·
4 channels") so you are editing a visible object. Privacy as `ChoiceCards`, with a warning tone
when switching Private → Open on a space that already has members. `Delete space` as a ghost
destructive text button in the footer's left corner. Save disabled until something changed
(today it fires a pointless PUT on an untouched form).

### Create channel
**Today:** name `Input`, a visibility `Select` whose two options are long sentences,
description `Textarea`.
**Criticism:** no `#` affordance and no normalisation preview, so nothing teaches that the
product wants `general` and not `General Discussion — Matter 4471`. A binary with consequences
rendered as a dropdown that hides them. Creating a **private** channel has no invite step, so
the honest outcome is a private room with one member and a four-surface path to fix it.
**Direction:** a live channel-header preview at the top; a `#`-prefixed name field that shows
the normalised result under the field (never silently rewriting while typing); `ChoiceCards` for
visibility; the purpose field labelled "What's this channel for?" with a helper saying it appears
in the header and the empty state; and — revealed by a 200ms grid-rows collapse when Private is
chosen — a member picker reusing the space-roster candidate logic, so a private channel is born
with its people in it.

### Channel screen
**Today:** identity header (`border-b`) + push nudge (`border-b`) + quiz bar + tab strip
(`border-b`) ≈ 150px of chrome before the first message on a 640px phone. Pins, Saved and
overflow are three adjacent 32px grey squares. Members and online are plain text separated by
middots. The composer is `max-w-xs` / `sm:max-w-md` — 320/448px — floating under a 768px
transcript, with a round `AtSign` and a round `ArrowUp` borrowed from the AI chat, and no
attachment affordance despite the Files tab. The unread divider and the day separator are the
same gold pill. The hover cluster is seven equally-weighted glyphs positioned `-top-3.5`, over
the previous message. History opens with a 12px muted sentence.
**Direction:**
- *Header:* one `h-14` bar, one hairline. Left: visibility glyph + name + the space as a real
  breadcrumb chip carrying the 16px crest. Right: `PresenceStack` (replacing both the member
  count and the "3 online" text) then `ActionCluster`. Description moves into an expandable on
  the name — it currently costs 20px on every channel forever.
- *Sections instead of tabs:* Chat/Lists/Files become a compact segmented control **with counts**
  in the header on `md:`+ (counts are already in cache), reclaiming the whole tab row and its
  hairline. On mobile they become a bottom segmented bar, hidden on Chat.
- *Feed:* keep every mechanic. Add `max-w-[66ch]` on message text (the direction's own rule,
  unenforced today), an author-run continuity rail (1px left border down the run, warming to
  gold on a run containing a mention), and a per-row hover timestamp in the left gutter so any
  message can be dated. Open every channel with `ChannelIntro` — crest, `# name`, purpose,
  `PresenceStack`, invite, created date — used identically as the empty state.
- *Dividers:* `day` = a quiet 11px uppercase label, no pill, no rule. `unread` = a full-bleed
  gold hairline with a left "New" label and a right "Mark as read" button (that intent exists
  only via Esc today). `session` unchanged.
- *Row actions:* three verbs — react, reply, overflow — vertically centred at the row's right
  edge with a gradient mask, never occluding the message above. Touch keeps
  `MessageActionsSheet` exactly as built; it is the best-designed touch surface in the wave.
- *Composer:* `ChatComposerShell` at `max-w-3xl`, `rounded-2xl border bg-background/95
  backdrop-blur`, `shadow-lg`, row = attach · mention · emoji · textarea · send. The typing line
  moves inside the shell's top edge, left-aligned to the text column. Char counter appears at
  ≤200 remaining, not 500.

### Members panel
**Today:** two implementations. The channel sheet builds its own `Sheet` and its own skeleton
and renders `members/MemberRow.tsx`; space and org use the shared `MembersSheetFrame` +
`RosterRow`. The two rows are near-identical. No search, no sections, no online state, no
pinned self. Invite opens a **second overlay on top of the sheet**. `InviteMemberDialog`
hand-rolls a fourth tab idiom.
**Direction:** one `RosterPanel` on `MembersSheetFrame` for all three. Sticky sub-header with
search and Invite. Sections: Online, Admins & owner, Members, Pending. Self pinned in its
section with a "You" chip. Invite becomes an **inline panel** inside the same sheet using the
existing symmetric grid-rows idiom. Delete `channels/members/MemberRow.tsx` and its duplicate
skeleton. Keep `InvitePeopleDialog`'s 429 quiet-timer behaviour verbatim — one of the
best-judged details in the wave.

### Lists tab
**Today:** master/detail inside a tab inside a channel inside a space, with a 32px back arrow
as the only exit and **no motion at all** on the index↔detail swap. Index rows have no leading
mark, breaking the rhythm every other v2 list keeps. `AddItemComposer` sits at the bottom of the
scrolling content, not sticky. Completion is carried only by an emerald bar — a third accent.
**Direction:** index becomes a two-column grid of `ListCard`s led by a 36px **ring-progress
mark** (SVG donut, gold, filling to a `Check` at 100%). Cards are justified here: a list *is* a
container. Detail gains a compact header (back chevron + title inline + ring + kebab) and a
sticky `ChatComposerShell` footer, so "compose at the bottom" is one idiom in the product.
Index→detail animates 180ms slide-x + fade, reversed on back, instant under `motion-reduce`.

### Files tab
**Today:** the only surface in the feature using bordered cards, inside the same screen as the
hairline-row Chat. Images get a generic icon — no thumbnails. Upload feedback is a spinner and
the word "Uploading…", with no percentage and no cancel. No grouping, no search, no sort. The
zip caution is a permanent third line competing with the filename. Rejections stack unbounded.
**Direction:** hairline rows matching Chat's density. A 40px `FileMark` — thumbnail for images
(plain `<img>` with fixed dimensions; the app configures no `remotePatterns`), tinted type glyph
otherwise. The archive caution becomes a chip with a tooltip. Date sections using `FeedDivider`'s
day variant. A type filter `TabRow` above ~8 files. A docked `UploadTray` with determinate
progress and cancel, absorbing failed entries with a Retry. The empty state becomes the drop
zone itself.

### Invitations inbox
**Today:** the most emotionally loaded row in the product — someone asking you to join their
firm — renders as the same grey-tile row as a bookmark. The inviter is a 16px avatar inside a
12px meta line. Nothing tells you what you are joining: no member count, no channel count, no
crest. Decline and Accept are equal-size buttons that orphan themselves under the row on mobile.
**Direction:** `InvitationCard` — a `rounded-xl border p-4` object, because each row is a
**decision**. Lead with the **inviter's 40px avatar**; the headline reads as a sentence
("**Ada Nwosu** invited you to **Firm HQ**") with the object's crest inline. Second line is
facts: `Work space · 12 members · 4 channels`, or `Organization · Verified`. Third line: the
role chip and the age. Actions asymmetric — a full-width primary Accept on mobile, a
text-weight Decline — because the two are not equally likely. Keep the exit collapse exactly as
built. Drop the intro sentence.

### `/organization`
**Today:** a generic `Building2` glyph on grey (the logo is deliberately not rendered — no
`images.remotePatterns` configured), a header, and one verification panel. Nothing else. It is a
settings screen promoted to a top-level URL, which is what decision D7 said it must not be.
**Direction:** `PlaceHeader` with an `OrgCrest` (monogram now, real logo when a rendering path
is agreed), then a two-column grid: verification panel + details on the left; **Spaces owned by
this organization** (reusing the spaces lane, filtered from cache — no new endpoint) and a
**People** block on the right. Make the emerald a real `--success` token rather than two
hardcoded emerald usages in unrelated features.

### `/channels` — my channels
**Today:** the **best row in the feature** — the only one that previews content — at a URL with
**no entry point**. `nav.config.ts` has one "Spaces" row; nothing links to `/channels`. No
filters, no search, no grouping. Its only toolbar affordance points away from it.
**Direction:** promote it. A "Channels" nav row above "Spaces", gated by `canAccessCollab`,
carrying the global unread count the spine already computes, so the nav itself becomes a triage
surface. Toolbar becomes `TabRow` (All / Unread / Mentions) + search. Rows lead with the space
**crest** so cross-space scanning is visual, keep the preview, and group by Today / This week /
Earlier.

### Mobile — space ↔ channel movement
**Today:** three full page loads to reach a message, each repainting from a skeleton. Switching
channels inside a space costs two navigations. The only "up" affordance in a channel is a 14px
muted text link buried in a meta row — on a phone, the channel does not tell you which space you
are in unless you read the third element of a middot line. The global drawer, the one persistent
mobile chrome, contains **AI conversations**, not your channels. The drawer's Search button has
no handler.
**Direction:** a contextual header on collab routes (`[back chevron][space crest]` left, `#
channel` centre with the space name as an 11px kicker); a `SpaceDrawer` holding the `SpaceRail`
content, bound to its own state (not the global `openMobile`); tapping a channel there is a route
change inside the same layout, so three page loads become one. Edge-swipe to open it. Chrome
diet: description collapses into the name, Lists/Files leave the permanent tab row. Net ~60px
reclaimed above the first message. Wire the drawer's Search or remove it.

---

## Protect — earned correctness a redesign must not destroy

- **The unread grammar** (`v2/features/collab/unread-grammar.ts`): bold + gold dot = unread;
  **a number is only ever mentions**; muted dims and can never bold; **no red anywhere**. New
  rows derive from these functions, never re-invent them.
- **The scoped dim wrapper.** In `SpaceChannelRow.tsx:75-77,138-146` and
  `MyChannelRow.tsx:55-57,122-130` the muted dim is on a *wrapper* and the mention badge is
  deliberately its **sibling**, because `opacity` composites the whole subtree. Move the badge
  inside the dim wrapper and you silently quiet the one signal Ruling A says a mute may never
  suppress.
- **The whole `ChannelFeed` scroll contract**: layout-effect first landing (`?m=` → unread line
  → bottom), bottom-anchored history-pull restore keyed to fetch settlement, the time-watermark
  pill count, the follower that snaps above 80px, and "new messages never move the viewport or
  focus".
- **`forceMount` chat via `invisible` + `inert`, never `display:none`** (`ChannelScreen.tsx:631-640`).
  A tab redesign that unmounts or `display:none`s the chat pane destroys scroll position, the
  outbox rows and the unread anchor.
- **The a11y spine**: pre-mounted `role="log"`, APG feed articles with `aria-posinset`/`aria-setsize`
  and delegated PageUp/Down/Ctrl+Home/End, `aria-pressed` only on real toggles, `aria-disabled`
  (not `disabled`) on invitation buttons so focus survives the press.
- **The send ladder and the outbox**: optimistic insert → `sending` (dim, no words) → nothing →
  `failed` with inline Retry **and** Discard; the chronological outbox merge so a background
  refetch can never silently drop an unsent message.
- **Quiet URL writes** (`?tab=`, `?list=`, `?game=`) with `popstate` adoption and
  `key={channelId}` remount.
- **Engagement etiquette**: reactions never notify; a 429 is a quiet disable with a calm timer
  line, never red.
- **No presence dots on avatars.** Presence stays a soft count; `PresenceStack` shows faces, not
  status lights.
- **The three-state discipline and the `still` rule**: skeletons at the real geometry of the row
  they replace, route fallbacks reserve shape *without* a pulse, live `isPending` regions pulse.
- **Designed refusals, never redirects**: 403 → the access-denied states; owner-leave 400 → the
  in-place "Transfer ownership first" swap; `data: null` from `/my-organization` →
  `NoOrganizationState`.
- **Verification's `justSubmitted` session flag** — without it the submitter is bounced back to
  "Get verified" with no acknowledgement.
- **Invitations' optimistic exit**: held collapse, flat-index holdover, pending rows unpaintable
  by a refetch, and "accepting only navigates when it was the last one".
- **`EnablePushNudge`'s always-mounted zero-height collapse** — reuse that symmetric grid-rows
  idiom for every new reveal rather than inventing a second one.
- **dnd-kit reorder**: grip-handle activation distance, keyboard sensor, drag disabled while any
  optimistic temp uuid is present.

---

## Also required, from the same owner round

Two behaviour items belong to this wave rather than the backend:

**Every overlay must answer the Back button.** Today 3 of 53 do (the game overlay and the two
case-chat presentations). The fix is one shared `useUrlOverlay(param)` hook in `v2/runtime/`
beside `url-params.ts`: state is `string | null`, `open()` quiet-PUSHes, `close()`/`swap()`
quiet-REPLACE, one `popstate` adopter, and it absorbs `useDialog`'s `openKey` remount contract.
It deletes four hand-rolled copies of that block (`CaseScreen`, `ChannelScreen`, `RadarScreen`,
`FolderScreen`) and fixes `ListsTab`, which has the pattern but no `popstate` listener.
Recommended grammar: one `?panel=` key per screen — `edit`, `members`, `invite`, `list:{uuid}`,
`ai:{uuid}`.
**Quiet writers only** — `/spaces/[spaceId]` and `/channels/[channelId]` are dynamic routes, and
a loud history write there restarts the `/undefined` refetch loop documented in
`v2/runtime/url-params.ts:83-111`.
**Do not** put the 13 destructive confirmations in the URL: a shareable, refresh-surviving link
that re-opens "Delete this space?" is an armed trigger, and those dialogs hold error text tied to
the last failed attempt. Same for dropdowns, popovers, the mention autocomplete and the
drag-drop veil. The mobile nav drawer is a genuine judgement call — Back-to-close is expected on
a phone, but `?nav=1` in a copied link is odd.

**Long-press on mobile must not also select text.** `-webkit-touch-callout` is set nowhere in the
repo and `user-select` is set nowhere on the feed, so iOS runs its own touch-and-hold gesture in
parallel with our 450ms timer: the sheet opens over a blue highlight and a loupe. The
`contextmenu` swallow in `use-long-press.ts:66-73` handles Android and cannot help on iOS, where
the callout is governed by CSS. iOS also decides at the **start** of the gesture whether text is
selectable, so flipping a property at 450ms is too late — the rule must be static. Fix: one
utility in `shell.css` beside `.v2-interactive`, guarded by
`@media (hover: none) and (pointer: coarse)`, setting `-webkit-touch-callout: none` plus
prefixed `user-select: none`, applied to the message row only; `touch-action: pan-y` so scroll
always wins; `window.getSelection()?.removeAllRanges()` in the fire path. Because that removes
copy-by-selection on touch, **`MessageActionsSheet` gains "Copy text"** at the top of its verb
list, writing `message.content` (the raw text, so an AI answer pastes as markdown). That is also
the better interaction on its own merits — every messaging app replaces finger-selection with
hold → menu → Copy.
