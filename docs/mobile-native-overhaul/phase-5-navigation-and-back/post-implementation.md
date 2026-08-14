# Phase 5: back goes back, what shipped

Date: 14 August 2026.

## What is in the app

`v2/runtime/back-to.ts` — `useBackTo(href)`, spread onto an existing back Link,
plus `useRouteTrail()` mounted once by the layout through
`v2/shell/route-trail.tsx` for browsers without the Navigation API.

Applied to nine back controls:

| Control | File |
|---|---|
| The phone channel chevron | `channels/screen/PlaceHeader.tsx` |
| The thread chip, `md` and up | `channels/screen/PlaceHeader.tsx` |
| The shell chevron on space routes | `collab/shell/CollabHeaderSlot.tsx` |
| Statutes reader | `statutes/reader/StatuteHeader.tsx` |
| Note reader | `notes/reader/NoteDocument.tsx` |
| Note editor | `notes/editor/NoteEditorScreen.tsx` |
| Folder up link | `folders/detail/FolderBreadcrumb.tsx` |
| Case report | `cases/report/CaseReportScreen.tsx` |
| Radar create | `radars/create/CreateRadarScreen.tsx` |

And `v2/shell/designs/HomeQuickJump.tsx` uses router links now instead of plain
anchors.

## Measured

| Case | Before | After |
|---|---|---|
| Warm: lobby, channel, press the chevron | index 1 to 2, a duplicate entry, phone Back walked into the channel again | **index 1 to 0**, 2 entries, phone Back leaves the app |
| Cold: the channel opened straight from a link | pushed the parent | **pushed the parent**, unchanged |
| Home shortcut to Cases | tore the app down and rebooted it | **the app stayed alive** |

## The failure in the first run was mine

The warm case failed on the first film and the app was right: I had opened the
lobby of a different space from the one the channel is in, so the parent
genuinely was not behind, and the helper correctly declined to go back and
pushed instead. The measurement was wrong, not the code. Worth recording,
because "back declined to go back" is exactly what a real bug would look like
too, and the difference was one uuid.

## Left for later

- The nine post-mutation navigations (leave a channel, delete a note) still
  push, so a deleted screen stays reachable behind Back. They want the same
  helper with `replace` instead of `push` as the fallback. Not in this phase
  because it changes what happens after a destructive action, which deserves its
  own film.
- The create affordance and a floating button belong to the modals phase.
