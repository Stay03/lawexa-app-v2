# Phase 4, Wave 5 — Folders: build plan

Owner go: August 4, 2026, all six decisions locked AT THE RECOMMENDATIONS.
Read `wave-5-folders-study.md` first — it holds the v1 verdicts, the probed
wire contract, the four defects and the design research this plan executes.

## 1. The locked decisions

1. **Nesting: yes**, browsed ONE LEVEL AT A TIME (the API's own grain).
   Breadcrumb on desktop, one named parent link on mobile. Three levels
   encouraged; deeper is allowed, never blocked.
2. **No colour picker, no icon picker.** One monochrome folder glyph.
   Legacy colours still tint existing rows; v2 mints none.
3. **No public "Explore" feed.** v2 shows the viewer their own folders.
   Every new folder is created private, with no toggle in the UI.
4. **Four item types: case, note, statute, file.** Conversations are
   dropped (the id-enumeration leak) and folder-as-item is dropped
   (real nesting already exists). Both may ARRIVE from v1-filled
   folders — drop them at the row mapper, never crash.
5. **Folder page = one stream**: subfolders first, then items, with a type
   filter above and ONE honest count.
6. **Undo, not confirm**, for removing an item and deleting a folder.

## 2. Foundation already in place (coordinator — do not rebuild)

- `v2/routes.manifest.ts` — `'/folders/*'` claimed, no carve-outs.
- `v2/features/folders/types.ts` — the probed four-payload contract,
  optional-where-absent, item union incl. the two unrendered types.
- `v2/features/folders/api.ts` — wire layer (no public feed, no navigate,
  no restore).
- `v2/features/folders/queries.ts` — `level()` (one tree level),
  `detail()`, `items()`; viewer-partitioned, REFETCH_ON_VISIT.
- `v2/features/bookmarks/bookmark-row-model.ts` — the dangling
  `content: null` guard already shipped in this wave's prep.

## 3. Build split

### Builder A — BROWSE (the two folder screens)

Routes: `app/v2/folders/(library)/page.tsx` + list-shaped `loading.tsx`;
`app/v2/folders/loading.tsx` (folder-page shaped — what you navigate INTO);
`app/v2/folders/[uuid]/page.tsx`.

Feature code: `v2/features/folders/list/**`, `v2/features/folders/detail/**`,
`v2/features/folders/folder-row-model.ts`, `v2/features/folders/item-row-model.ts`,
`v2/features/folders/folder-mutations.ts` (create / rename / delete ONLY).

- List: the viewer's ROOT folders, house two-zone rows — lead = monochrome
  folder tile + name + `N items · N subfolders` (+ a Private mark only if a
  legacy folder is public), trail = `updated N ago` falling back to created
  (list rows may omit `updated_at`). Search via `SearchField` + `use-url-search`.
  "New folder" action → one field (the name), nothing else.
- Detail: breadcrumb (desktop) / named parent link (mobile) built from the
  detail's `parent` (one level) + `slug_path` for display only — never
  invent an ancestor you cannot name and link. Then ONE stream: subfolder
  rows first (from `children`, which is unpaginated — render all, they are
  the tree), then the paginated items. `TabRow` type filter (All / Cases /
  Statutes / Notes / Files) shown only when the folder holds more than one
  type. One honest count in the header.
- Items render through `item-row-model.ts`: an exhaustive mapper over the
  wire union returning `null` for `conversation` and `folder` (the two v2
  does not render) — the bookmarks mapper is the exemplar. Per-type meta:
  case = citation + judgment date, statute = short title + year + status,
  note = author + preview, file = name + kind/size WHERE PRESENT (the file
  content shape is UNPROBED — render what exists, claim nothing).
- Folder actions: rename (one field), delete → UNDO toast (no confirm
  dialog). Delete cascades on the server and restore exists, but v2 ships
  no restore call this wave, so the undo window is the optimistic cache
  only: state plainly what the toast can and cannot do, and never promise
  a recovery the build cannot perform. If that cannot be made honest,
  STOP and report rather than shipping a lying toast.
- States: signed-out, empty root ("Group the cases, statutes and notes for
  one matter in one place" + New folder), empty folder, search-empty,
  error, and the not-found/403 folder. Guests: folders are REAL for guests
  (probed) — no bounce, no create-account panel.

### Builder B — ADD TO FOLDER (the integration this wave exists for)

Feature code: `v2/features/folders/picker/**`,
`v2/features/folders/item-mutations.ts` (add / remove item ONLY).
Shared-file touches (yours alone, coordinate nothing else): the case,
statute and note action rows.

- `FolderPicker`: one component, two skins — Radix Dialog ≥sm, bottom
  sheet below. Opens showing the viewer's ROOT folders newest-updated
  first (the wire already sorts), a search field, and drill-down into
  subfolders with a back affordance naming where you are. The LAST row is
  always `Create folder "<typed name>"` — one field, creates and adds in
  one gesture. Verb is **"Add to folder"**, never "Move".
- Wire it as one more pill in the existing action rows on the case,
  statute and note screens, beside the bookmark control — match each
  row's existing grammar exactly, do not restyle those screens.
- Adding: optimistic, per-target mutation scope, `meta.invalidates` on
  the folder caches. A duplicate is a 422 — render it as the honest
  "already in that folder" answer, not an error toast.
- Removing an item (from the folder page — export a hook Builder A can
  call; agree the export name with the coordinator via your report, do
  not edit A's files): optimistic removal + UNDO toast that re-adds.
  Removal is provably non-destructive (the item itself is untouched), so
  the toast may promise the undo it actually performs.
- There is NO reverse lookup ("which folders hold this item") — the ask
  is filed. Until it lands the picker must NOT claim added-state it
  cannot know; the 422 is the honest signal.

## 4. Both builders

Gates: `npx tsc --noEmit` clean, eslint `--max-warnings 0` on your files.
No builds, no git, no package installs, no edits outside your boundary.
House rules: React Compiler lint runs as ERRORS (no setState-in-effect, no
`Date.now()` in render, stable selector refs); two-zone meta grammar with
`min-w-0` on grid items; skeleton-first; symmetric motion with
`motion-reduce`; import boundary — lib/api, types, pure utils and
components/ui only, NEVER v1 components/hooks/stores.
Report: files + one-line purpose each, deviations with reasons, then
ASSUMPTIONS split VERIFIED (with how) and UNVERIFIED.
