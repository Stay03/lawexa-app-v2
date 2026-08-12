# Threads — frontend plan

Written 2026-08-12, after the backend shipped threads to prod. Every backend
fact here was read out of `Stay03/lawexa-api-v3` rather than taken from a
summary. Phase 1 is the shippable slice.

---

## 0. What the code says that our notes did not

These were found by reading the server, and five of them are **live defects
now**, because threads went live before any of this UI existed.

**0.1 — a thread's `name` is a machine slug, not its title.** `createThread`
sets `name = "thread--{uuid}"` because `channels` carries
`UNIQUE(space_id, name)`; the human text is a separate `title` column, and
`ChannelResource`'s own docblock says "the `name` is a generated slug — do not
show it to anyone". Every surface that prints `channel.name` would print
`thread--0f3a1c…`: the header, `ChannelIntro`, the composer's accessible
label, the feed's `role="log"` label, the members sheet, the pins subtitle,
the leave/delete confirms, the shell header, and the mention toast's "In …".

An earlier probe of ours reported the header looked right. It was wrong: the
probe dressed a REAL channel up as a thread, so `name` was already human.

**0.2 — `channelAccess()` refuses a thread in a private channel.** It reads
`is_member` + `visibility`, but on a thread `is_member` means FOLLOW state, not
access. A private parent plus a thread you have not spoken in resolves to
`closed`, so the screen offers "ask to join" — and `POST /channels/{thread}/join`
answers 422 ("Threads are not joined — post in one to follow it"). The policy
says the opposite: `view`, `previewMessages`, `viewMessages`, `post` and
`viewMembers` all delegate to the PARENT. Access must be derived from the
parent; only `update`/`delete` belong to the thread, and `invite`/`manageMembers`
are always denied.

**0.3 — `POST /channels/{thread}/read` throws for a non-follower.** `markRead`
opens with `firstOrFail()` on the membership row. The read pointer is gated on
participation, so every dwell/Esc/jump in a thread you do not follow fires a
request that cannot succeed. It is silent, but it must be gated on follow
state.

**0.4 — `root_message` has no `created_at`.** It is
`{uuid, author, content_preview, is_deleted, type}`, and `content_preview` is
`null` (not `""`) when deleted, truncated at 200 chars.

**0.5 — `parent_channel_name` is not on main yet.** Plan for it; degrade
without it.

**0.6 — the `thread` stub rides four lists**, not one: `listMessages`,
`listReplies`, `listPinned`, `listBookmarkedMessages`. `mergeViewerFields` must
protect it in all of them.

**0.7 — the space rollups count threads; the channel listings do not.**
`listChannels`/`listUserChannels` apply `topLevel()`, so threads never appear in
the rail or drawer — correct. But `SpaceService`'s `unread_channels_count` and
`mention_count` subselects do NOT. So an unread thread lights the space dot and
the app badge with **no row anywhere that explains it**. That is live, and it
makes the threads list (Phase 4) an obligation rather than a nicety.

**0.8 — a standalone thread and a hard-deleted root look identical on the
wire.** Both are `root_message: null`. Our copy must be true of both.

---

## Phase 1 — a thread is a place you can enter, understand, and leave

Shippable with zero new threads: a mention inside a thread already deep-links
to `/channels/{uuid}?m=…`, and today that link lands on a slug-titled room that
may refuse the reader outright. Phase 1 is a repair.

**1.1 One name, one owner.** New `v2/features/channels/thread-model.ts` with
`channelDisplayName(channel)` = `is_thread ? (title ?? name) : name`. Route
every name read through it — `PlaceHeader`, `states.tsx`, `ChannelScreen`,
`ChannelFeed`'s aria-label, `ChannelComposer`'s aria-label,
`ChannelMembersSheet`, `MessageCollectionSheet`, `CollabFrame`, and
`runtime/realtime/spine.tsx` (the mention toast). `Channel` gains `is_thread`,
`parent_channel_uuid`, `title`, `parent_channel_name?`, `root_message?`.

**1.2 A thread's gate is its parent's gate.** New `threadAccess(thread, parent)`
in `v2/features/collab/access.tsx`, deriving read/participate from the parent
and exposing `isFollowing = thread.is_member === true`. `ChannelScreen` fetches
the parent detail when `is_thread` (a cache hit on every in-app path; one extra
serial call only on a cold link). The read pointer is gated on follow state,
per 0.3. The presence room stays on participation — `broadcasting/auth` calls
`viewMessages`, which delegates to the parent.

**1.3 The way back.** `PlaceHeader` takes a `parent` prop and leads with a back
chip at every width: chevron + the parent's name, linking to
`/channels/{parent}?m={rootUuid}`. The `?m=` is the point — it reuses the
existing deep-link resolver so the parent lands on the branched message and
flashes it. We restore the PLACE, not the pixel offset. `CollabFrame`'s
`backHref` and the rail's lit row both follow the parent.

**1.4 Which surfaces a thread keeps.** Keep: feed, composer, engagement, pins,
saved, Lawexa sessions, Lists, Files, members (read-only — invite and manage are
hard denies), delete (relabelled "Delete thread"). Notifications only when
following. Drop: edit channel (it would overwrite the slug), leave (un-follow is
deliberately undesigned), join requests (422), quizzes and the game overlay,
the push nudge. `ChannelIntro` is replaced by `ThreadOpening`.

**1.5 What it branched from.** New `ThreadOpening.tsx` at the head of the
transcript, in `ChannelIntro`'s slot, in `ReplyQuote`'s grammar so it never
reads as a message in this thread. Three states: root alive (author, preview,
"in {parent}", tappable); `is_deleted` (author kept, no preview, not tappable,
"{Name}'s message started this. It has since been deleted."); and `null` —
"This thread doesn't have a first message.", chosen because it is true of both
things null can mean (0.8).

**1.6 The first door travels.** `QuietSystemLine` gains `onOpenThread`; a
`thread_started` row becomes a link to the thread, keeping its recessive
grammar. It becomes `role="group"` rather than `role="separator"`, because
ARIA's presentational-children rule strips interactive descendants from a
separator — the same trap already documented for `UnreadDivider`. The whole
sentence is the target; the server's words are never parsed.

**1.7 Entering is a route.** `/channels/{threadUuid}`, because a thread IS a
channel, `ChannelScreen` already keys by channel and remounts wholesale, and
the notification dispatcher ALREADY pushes that address — an in-place mode
would leave that live path landing on a broken screen.

**1.8 Verification.** Fixtures made out of band (Phase 1 ships no create
affordance): a rooted thread, one whose root was since deleted, and a
standalone one, in both a private and a `space_public` parent. Screenshots to
LOOK at: the human title in the header, the back chip, the root block, a real
composer; the same URL as a parent member who has never posted (must show the
room, not "ask to join", and must fire ZERO `POST /read`); the deleted-root
sentence; the standalone sentence; the back chip landing on the flashed
message; the overflow menu's dropped items.

---

## Phase 2 — the standing door, the number, live counts

`MessageThreadStub` on `Message`; `mergeViewerFields` gains a `thread` arm (a
stranger's edit must not strip the thread line); `applyThreadStub` writer.
`ThreadLine` under the message, a sibling of `ReplyCountLine` but a LINK with a
branch glyph, never a chevron — a chevron promises expansion, a thread
navigates. The unread number is three states in the house's existing grammar:
`null` (not following) muted title, `0` (following, caught up) foreground
title, `n` bold + gold dot. Weight = do you belong; dot = is there something
new. No Follow button, because there is nothing behind it. `thread.updated` is
subscribed in `room.ts` and patches the stub WITHOUT touching
`my_unread_count`, which the broadcast deliberately omits.

## Phase 3 — starting a thread

`createThread` on `channelsApi`; the row action lives in the overflow menu
(the hover cluster is three verbs by decree), gated off inside a thread. No
title dialog: branching sends no title and the server derives it from the root.
The idempotent 200 is treated exactly like the 201 — both mean "you are in the
thread for this message" — and the label reads "Open thread" once a stub
exists, so the collision is nearly unreachable anyway.

## Phase 4 — where the conversations went

A `?panel=threads` lens (not a `SectionSwitch` pane: Chat/Lists/Files replace
the transcript, whereas this is a lens over the channel's own conversations,
like pins and saved). Page-based infinite query, NOT the feed's cursor. All /
Following filter via `?mine`. Obligatory rather than optional because of 0.7.

## Phase 5 — the seams

The mention toast (fixed by 1.1, but verify by reading it); notification inbox
and push end-to-end; v1 is stated and not fixed (it has no quiet-system-line
handling at all, so `thread_started` shows as a bubble headed "Deleted
account" there — pre-existing, and v1 may not import v2); and a backend ask
covering 0.3, 0.5, 0.7 and 0.8.
