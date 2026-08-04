# Phase 4, Wave 5 — Folders: study + design direction

August 4, 2026. Two research streams: a first-hand keep/drop study of v1
with live API probes (105 probe files in the session scratchpad, all
created data cleaned up), and web design-research over the legal-research
incumbents (Westlaw, Lexis+, vLex, Bloomberg Law) plus the best
folder-mature products (Drive, Zotero 7, Raindrop, Notion). AWAITING the
owner's answers to §5 before builders launch.

## 1. What v1 has (~2,900 lines) and the verdicts

| Surface | Verdict | Why |
|---|---|---|
| `/folders` list (My Folders / Explore tabs) | REDESIGN | both tab queries always fire; whole-list skeleton on every refetch; tabs have no tab semantics |
| "Explore" tab (global feed of ALL folders, every depth) | DROP | lists strangers' folders — and your own PRIVATE ones appear in your feed; marketplace-era furniture |
| `/folders/[uuid]` detail | REDESIGN | children (unpaginated) mashed into paginated items; stat line contradicts the rows; no way back up (breadcrumbs component built, never rendered) |
| 6 type tabs on detail | REDESIGN | one tab is a client-side fiction; no Statutes tab though statutes are addable |
| Create + Edit dialogs | REDESIGN as one | 519 lines, ~95% identical |
| AddToFolderDialog (content → folder) | REDESIGN | reaches root folders only (subfolders unreachable, silently); 15-folder cap, no create-inline |
| AddItemToFolderDialog (folder → content) | REDESIGN | offers 3 of the 6 real types; file tab lies past 20 files |
| Icon/color pickers (12 icons, 10 swatches) | DROP | see §4.6 |
| Guest gate (sidebar AuthModal bounce) | DROP | frontend-only; the API gives guests full folder access |
| Trash/restore UI | NOT THIS WAVE | wired server-side, zero UI in v1; rows carry no deleted_at |

## 2. The probed wire contract (the wave-4 lesson applied)

- Auth: every folder endpoint 401s tokenless. Guests have FULL access via
  token (create/nest/fill/rename/delete/restore all probed).
- Addressing: **uuid only.** Slug and numeric id 404. Slugs are NOT unique
  (two same-name root folders share one slug; `navigate` picks arbitrarily)
  and rename rewrites the whole subtree's slug_path. `restore` alone takes
  the numeric id.
- FOUR distinct payload key-sets: Explore rows (13 keys), my-folders rows
  (17), detail (19: + `parent`, `children`), mutation responses (17 — NO
  parent/children, and the restore response's counts are STALE; refetch).
  `description`/`views_count`/`bookmarks_count`/`updated_at` are ABSENT
  (not null) from Explore rows. Gates on these fields must test proof.
- Nesting unlimited (8 probed); cycle guard 422; `parent_id: null` → root;
  `my-folders` returns ROOT ONLY, `?parent_id={uuid}` drills one level.
- Items: 6 live types (case, note, conversation, folder, file, statute —
  the API doc claims 4 and is wrong). Per-type `content` shapes recorded in
  the probe files; note items carry marketplace price fields (ignore).
  Two containment models coexist: child folders (parent_id) AND
  folder-as-item — v1 renders the same subfolder twice.
- Privacy: `is_private` = unlisted + owner-only (no sharing model). v1
  creates folders PUBLIC by default.
- Delete: soft, cascades recursively; restore brings the whole subtree AND
  items back (probed A→B→C round trip).

## 3. Defects found (live, probed)

1. **BACKEND — security.** Folder items accept other users' conversations
   by sequential NUMERIC id, and the items payload then leaks their
   private titles + uuids (guest with zero conversations read strangers'
   private conversation titles). Ask filed; v2 drops conversation items
   regardless.
2. **BACKEND.** `/api/bookmarks` reports every folder's counts as 0/0
   (list/detail/Explore all agree on the true counts). The shipped v2
   bookmarks page renders "0 items" on every saved folder. Ask filed.
3. **FRONTEND (shipped, fix THIS wave).** A deleted folder leaves a
   bookmark row with `content: null`; `bookmark-row-model.ts` dereferences
   it unguarded → TypeError on `/bookmarks`. The type lies (non-nullable).
4. **FRONTEND (v1, dies with the rebuild).** Removing a conversation from
   a folder sends `Number(uuid)` = NaN → 422; conversations are
   un-removable in v1.

## 4. Design direction (research: legal incumbents unanimous)

1. One hairline LIST in the house two-zone grammar — no cards, no grid
   (Westlaw/Lexis/vLex all use rows). Lead: monochrome folder tile, name,
   `N items · N subfolders` meta (+ Private mark). Trail: `updated N ago`.
2. Nesting = drill-down (subfolder rows above items, Drive model), NOT a
   sidebar tree, NO `role="tree"` (APG's own guidance). Breadcrumb on
   desktop; a single named parent link (`← Contract law`) on mobile.
   Encourage ≤3 levels (filing-practice evidence); warn, don't block.
3. Folder contents: ONE row shape, per-type meta (case = citation + date,
   statute = short title + year + status, note = author + preview, file =
   kind + size), `added_at` trail, TabRow type filter.
4. **Add to folder happens on the DOCUMENT** — a fourth pill beside
   Bookmark on case/statute/note screens. The picker opens as a LIST
   (recent folders first — recognition over recall), drills into
   subfolders, and its last row is always `Create folder "…"` (one field:
   the name). Verb = "Add to folder" (multi-home model), never "Move".
5. Removing/deleting = undo toast backed by the probed restore endpoint,
   not a confirm ritual (HIG/NN-g; the cases inside provably survive).
6. NO color picker, NO icon picker: monochrome glyphs, emphasis scarce
   (every legal incumbent is monochrome; Zotero caps color at 9 tags and
   gives collections none). Legacy colored folders keep their row tint.
7. New folders default PRIVATE (v1 defaults public — a client-matter name
   listed to strangers).

Late research addenda (Mendeley/EndNote/Obsidian + matter-centric legal
DMS deep-dive): the legal profession's own container is "the file" — a
matter closes and must be surrendered as ONE unit (ABA entire-file rule),
which is the deepest argument for folders-first here; "Remove from
folder" must never read like "Delete" (Mendeley's drag-to-trash trap
deletes the reference — EndNote's wording is the model); EndNote ships a
permanent "Unfiled" view as a completeness instrument — a future idea for
us ("saved but in no folder"), not this wave; membership visibility
("already in Contract law") strengthens the reverse-lookup backend ask.

## 5. Owner decisions (answer by number)

1. Nesting: full tree browsed one level at a time, breadcrumbs, ≤3
   encouraged — RECOMMENDED — or flat/one-level?
2. Drop the icon AND color pickers (monochrome; legacy tints still
   render) — RECOMMENDED — or keep color?
3. Drop the Explore tab entirely; new folders always private; the
   private/public toggle disappears — RECOMMENDED — or keep a public mode?
4. Item types in v2: case, note, statute, file — and DROP conversations
   (the security leak) and folder-as-item (duplicates nesting) —
   RECOMMENDED?
5. Detail page: one stream (subfolders first) with a type filter —
   RECOMMENDED — or hard tabs?
6. Delete/remove: undo toast (no confirm dialog) — RECOMMENDED — or keep
   confirms?

Non-questions (correctness calls, decided): uuid URLs stay; the guest
sidebar bounce dies (guests get real folders); trash UI deferred; the
`/bookmarks` null-content guard ships this wave.

## 6. Backend asks (docs/v2-docs/backend-ask-2026-08-04-folders.md)

1. URGENT: close the conversation-items id-enumeration leak.
2. Folder counts in the bookmarks payload (currently always 0/0).
3. Optional QoL: reverse lookup ("which folders hold this item") for
   picker added-state; a flat all-folders-with-path list for the picker.
