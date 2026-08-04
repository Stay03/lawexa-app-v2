# Phase 4, Wave 4 — Notes (reading + writing)

Owner go: August 4, 2026. This document is the study record, the locked
decisions, and the build plan. Builders: read this whole file, then the
referenced house docs, before writing code.

## 1. What v1 has (study verdicts)

v1 notes = 10 pages + 26 components, built as a notes MARKETPLACE.

| v1 surface | Verdict |
|---|---|
| `/notes` library (all published notes, paid included, price cards) | REDESIGN — free notes only, no prices anywhere |
| `/notes/mine` (own notes page) | REDESIGN — becomes the My notes tab on `/notes`; old path redirects |
| `/notes/[slug]` reader (`NoteContent` renders author HTML via `dangerouslySetInnerHTML`, line 67) | REDESIGN — parse to React, strip author inline styles (the invisible-text bug fix) |
| `/notes/create`, `/notes/[slug]/edit` (`NoteForm` 349 lines, Tiptap editor with fixed toolbar) | REDESIGN — new editor, autosave, no marketplace fields |
| `/notes/[slug]/publish`, `/notes/publish`, `/notes/purchases` (`NotePublishPage` 389 lines, `NotePriceCard` — buy button was NEVER implemented, `onPurchase` is a TODO) | DROP from v2 — carved out of the manifest, still fall through to v1 |
| `/notes/[slug]/export-docx` (client page that triggers a download then bounces) | DROP the route — v2 reader gets an export button instead; the route stays excluded so old links still work via v1 |
| `components/notes/mention/*` (case-mention: tippy-based, un-debounced per-keystroke API calls) | REBUILD — Tiptap suggestion + debounced search + React-rendered list, no tippy |
| `WriterModeToggle` | DROP — no writer-mode; the page is the paper |

## 2. Owner decisions (all locked)

1. Paid notes are HIDDEN from v2 entirely. No price, no purchase UI, no
   "coming soon". A deep link to a paid note gets an honest not-available
   state. ("Note selling is not a thing yet — no current demand, maybe later.")
2. Create + edit ARE in scope. Plain personal notes: title + content,
   nothing else. No pricing, no publish flow, no tags UI, no thumbnails.
3. My notes tab: IN.
4. Underline AND strikethrough: both kept (both in StarterKit v3).
5. No text color, ever — v1's editor never had color (verified across the
   whole git history); colored notes came from outside the app. The v2
   reader strips inline styles at parse; the v2 editor offers no color.
6. Ask-AI on notes: LATER (case-chat pattern when it comes).
7. Guests read; guests do not write. Authoring surfaces show the
   create-account panel (quiz `QuizCreateAccountState` pattern). Guest
   accounts are view-only pre-registration — standing owner principle.
8. v2-created notes are born plain DRAFTS (private to their author). No
   publish UI in this wave; a published v1 note edited in v2 keeps its
   status (we never send `status`).

## 3. The backend contract (all six asks shipped, 2026-08-04, their `54d44e0`)

Full reply: `Stay03/lawexa-api-v3 docs/frontend-replies/reply-2026-08-04-notes-rebuild.md`.

- `title` optional on POST, nullable on PUT; `""` normalizes to `null`;
  render `null` as "Untitled" client-side (display-site fallback only).
- Slug set ONCE at creation, changes only when a save explicitly sends a
  different `slug`. v2 saves never send `slug` (the update type cannot carry
  it). Untitled notes get `untitled-x3f9`-style stable addresses.
- `GET /api/notes/by-id/{id}` — the editor's canonical read.
- `POST /api/files` upload / `DELETE /api/files/{id}` delete. Keep the id
  from the upload response next to the embedded URL. Deleting a note does
  NOT delete its images.
- 60 saves/min per user (POST+PUT, notes-only bucket). `X-RateLimit-*`
  readable; 429 WITH `Retry-After` = rate limit (back off by it); 429
  WITHOUT (POST only) = plan's note-creation quota (honest limit state).
- Content limit 5MB of characters; the 65,535 counter is dead — never show it.

## 4. Foundation already in place (coordinator, do not rebuild)

- `v2/routes.manifest.ts`: `'/notes/*'` claimed; marketplace carve-outs
  (`/notes/publish`, `/notes/purchases`, `/notes/*/publish`,
  `/notes/*/export-docx`) fall through to v1 via the new exclusion list.
- `v2/features/notes/types.ts` — honest v2 types (`NoteRecord`,
  `NoteCreateInput`, `NoteUpdateInput`; nullable title, no pricing fields).
- `v2/features/notes/api.ts` — wire layer (library is free-only at the wire,
  by-id, file delete included).
- `v2/features/notes/queries.ts` — key factory (`library`, `mine`, `detail`
  by slug, `byId`). Builder A may extend it; Builder B imports only.

## 5. Build split

### Builder A — READING (library + reader)

Routes: `app/v2/notes/(library)/page.tsx` (+ list-shaped `loading.tsx` in
the group), `app/v2/notes/loading.tsx` (document-shaped — the children
navigated INTO `/notes` are notes), `app/v2/notes/[slug]/page.tsx`,
`app/v2/notes/mine/page.tsx` (redirect → `/notes?tab=mine`).

Feature code: `v2/features/notes/library/**`, `v2/features/notes/reader/**`,
`v2/features/notes/note-row-model.ts`.

- Library: one stream, `TabRow` tabs **All notes | My notes** (`?tab=mine`),
  `SearchField` + `use-url-search` reading `?search=`, rows in the two-zone
  meta grammar, skeletons, empty/error/guest states. My notes rows carry an
  honest draft/published mark; library never shows paid or draft notes
  (wire-enforced + belt-and-braces filter).
- Reader: the note as a calm document (cases two-voice grammar). SAFE
  RENDERING is the heart: parse the stored HTML to React elements — no
  `dangerouslySetInnerHTML` anywhere — through a strict allowlist
  (headings, lists, quote, code, link, image, bold/italic/underline/strike);
  author inline styles/colors are DROPPED (this is the owner's
  invisible-text bug, and the fix is here, not backend). Case-mention
  anchors from v1 content render as case links with the cases hover-preview
  pattern. Unknown/hostile markup degrades to text.
- Reader chrome: byline + updated date, bookmark star (`BookmarkButton`,
  type note), export-DOCX button (calls the API, downloads, no route), and
  an Edit affordance ONLY when the viewer owns the note → `/notes/{slug}/edit`.
- Paid deep link (`is_paid` and no readable content): honest "not available"
  state. Draft deep link by a non-owner: the API 403/404 answer renders as
  the designed not-found state.

### Builder B — WRITING (editor + autosave)

Routes: `app/v2/notes/create/page.tsx` (+ editor-shaped `loading.tsx`),
`app/v2/notes/[slug]/edit/page.tsx` (+ `loading.tsx`).

Feature code: `v2/features/notes/editor/**`, `v2/features/notes/mutations.ts`.

- Editor: Tiptap 3.15.3 (installed). Page-is-the-paper; no fixed desktop
  toolbar. Desktop = selection `BubbleMenu` (`@tiptap/react/menus`) +
  markdown input shortcuts. Mobile/touch = NO bubble (iOS callout is
  unsuppressable — Tiptap #1806/#6276); the formatting bar docks in the v2
  shell's Dock row over `KeyboardInsetSync`. Toolbar verbs: bold, italic,
  underline, strikethrough, H2, H3, bullet + ordered list, quote, link,
  inline code, image, @case-mention; undo/redo buttons mobile-only.
  Toolbar state via `useEditorState` selectors — NEVER `editor.isActive()`
  in render (React Compiler lint is errors).
- Autosave: draft created on FIRST CHANGE (`POST`, untitled fine), then
  `PUT` by id. 1.5s idle debounce + 45s heartbeat while typing never
  pauses. Never send `slug`. Status is transient ("Saved just now" fades),
  errors are a quiet inline retry chip (`silentError` meta), mutation scope
  per note. Respect the rate-limit contract (§3). Flush on
  `visibilitychange`/`pagehide`, not `beforeunload`.
- After create, the URL moves `/notes/create` → `/notes/{slug}/edit` with a
  QUIET history replace (component state stays the source of truth; the
  quiet-write idiom in `v2/runtime/url-params.ts` — pass the current
  `history.state` through, never null). No remount, no navigation.
- IndexedDB mirror ALWAYS (untitled included; keyed by a client draft id
  before create, note id after; copy the `confidential-transcript.ts`
  shape). Restore is NEVER automatic — offer "Unsaved changes from {time} —
  Restore / Discard" on entry when the mirror is newer than the server copy.
- Images: upload via the wire layer, insert by URL, remember upload ids;
  best-effort `deleteFile` when an image uploaded THIS SESSION is removed
  before it was ever saved into the note. Nothing fancier.
- Case-mention: rebuild on `@tiptap/suggestion` + debounced (≥250ms) case
  search + React-rendered suggestion list (keyboard navigable). No tippy.
- Delete note: from the editor (confirm dialog; Radix auto-close trap —
  `preventDefault` + close-in-`onSuccess`), then to `/notes?tab=mine`.
- Mutations write the fresh envelope into BOTH detail caches and invalidate
  the lists (`meta.invalidates`).
- Owner/guest gates: guests get the create-account panel; a non-owner
  landing on `/edit` gets an honest state, never a crash.

## 6. Verification

Each builder: `tsc --noEmit` + `next lint` clean; ASSUMPTIONS list split
VERIFIED / UNVERIFIED in the report. No builds, no git, no file writes
outside the listed boundaries (shared files named above are read-only for
builders; `url-params.ts` addition is Builder B's ONLY shared-file touch).

Then: adversarial checker per builder (re-derive claims against the wire
contract; transpile pure modules and run them on fixtures), fix rounds,
central `V2_ENABLED=true` build, mock-API film (recipe v2), commit, report.

## 7. Post-implementation record (August 4, 2026)

Shipped in commit `580c078` (63 files). Both checkers said SHIP AFTER
FIXES; every finding was fixed and re-proved:

- Reading: the sanitizer survived ~75 independent hostile fixtures in
  Chrome, then 58 more after the fix round. Three HIGH fixes: the
  `.note-prose` class collision with v1's global stylesheet (renamed
  `v2-note-body`), a backslash URL bypass of the off-site guard, and a
  probe gate that skipped the parser for unlisted-tag content.
- Writing: the autosave machine survived an independent 57-assertion
  attack, then 76 after the fix round. The HIGH fix: the mention parse
  rule needed `priority: 60` because ProseMirror runs all MARK rules
  before NODE rules — without it the Link mark consumed every mention on
  load. Proved at rule-ordering level AND live on film (mention survives
  editor reload).
- Film: 22 scripted checks, desktop + mobile, light + dark, all passing;
  the v1 invisible-text sentence is readable on light, the script tag is
  dead, autosave create → save-by-id → quiet URL move observed on the
  wire, guest panels on every writing surface.
- Build: the commit builds green standalone (verified in an isolated
  worktree; the shared worktree carried a parallel session's in-flight
  phase-5 edits, which stayed untouched and uncommitted).

**Same-day hotfix (`5d9c6a0`):** the owner hit an empty All notes tab on
prod. Probed with a guest token: the library has 494 free notes and the
free filter works — but LIST rows carry no `status`/`is_paid`/
`is_private`/`updated_at`/`content`, and the belt filter's
`status === 'published'` read the absence as "not published", dropping
every real row. A locked paid detail also OMITS the `content` key (not
`null`) and carries `has_access`. Fixed: proof-based gates everywhere,
trail falls back to `created_at`, reader lock keys on `has_access`.
Films missed it because the mock served fuller rows than prod — the mock
now serializes the probed per-payload shapes. Rule: a gate over an
optional wire field tests proof; a mock serializes the probe, not the
type.

Known follow-ups, deliberately left:
1. `v2/features/bookmarks/mutations.ts` `writeContentCaches` has a no-op
   `note` branch — a star pressed on `/bookmarks` does not repaint an
   open notes list. One-line fix calling `writeNoteBookmarkEverywhere`
   when someone owns that file next.
2. Note pages are `noindex` — every notes read still 401s tokenless
   (probed Aug 4). Backend-ask candidate if the owner wants notes on
   Google: public reads for published free notes; then both routes take
   the cases metadata treatment in one edit each.
3. The DOCX download names the file `{slug}.docx` (axios blob drops
   Content-Disposition). Cosmetic.
4. Long-note (multi-MB) parse performance untimed; parse is one memoised
   pass.
5. The segment `loading.tsx` paints the reader silhouette before the
   editor's on a cold `/edit` load — documented deviation, brief beat.
