# Phase 4 — Content Library: plan

**Objective:** the shareable content domains rebuilt server-first — this is where social
previews and SEO get fixed (audit Part 3 §12).

**Opened July 25, 2026**, immediately after phase 3 closed. Scoped by the owner to
**cases first, alone** ("do for only case now"), with a message to the backend team
afterwards naming every endpoint the new reader uses.

## Scope

1. **Cases**: list (server-prefetched, infinite per data policy) + detail + report view; reader
   mode; view limits; bookmarks (optimistic per mutation policy). Server `page.tsx` +
   `generateMetadata` + `opengraph-image.tsx` per case. — **WAVE 1, SHIPPED. See below.**
2. **Statutes**: list with country tabs + detail on the v2 AKN renderer ONLY (statutes-old and
   the v1 tree renderer are not ported). Table overflow wrappers (audit mobile finding).
   Metadata + OG.
3. **Notes**: browse/read/create/edit/publish with the TipTap editor and case mentions
   (mention tooltips move onto the query cache — kill the module-level Map). No purchases.
   Metadata + OG for public notes.
4. **Folders & files**: folders (colors/icons/nesting, add-item flows now optimistic-or-patch
   per policy), files upload/manage.
5. **Bookmarks page** + trending/community read surfaces if cheap here (else phase 6).
6. **Sitemap entries** for cases/statutes/notes; breadcrumb title resolution (no more raw slugs).

## Exit criteria

Pasting a case/note/statute link on social shows a rich, correct preview; content browsing in
v2 feels faster than v1 (server-rendered first paint); back-navigation preserves list position
per data policy; `post-implementation.md` written.

---

# Wave 1 — Cases

## The keep / redesign / drop study

Standing rule (`feedback_keep_drop_study_before_redesign`): study each v1 screen first-hand
before rebuilding it. Done by reading the shipped v1 code end to end — three routes, 25
components, 2,500 lines.

### `/cases` — the library list

| v1 | verdict | why |
|---|---|---|
| Infinite list, URL-backed search, URL-backed tag filter | **KEEP** | The right model. Rebuilt on the v2 list spine. |
| Row: title, court, country, date, views, holding preview, tags, bookmark | **KEEP the content** | Everything on it is worth showing. |
| `CaseListGroup` — a bordered box around the whole list | **DROP** | The same chrome the owner rejected on the home ("I don't like the box"). Hairlines between rows, nothing around them. |
| Row typography: 20px title, 16px metadata, filled chips for court + country | **REDESIGN** | A scan hit four grey pills before reaching a case name. The case name is now the only thing at full weight; the rest is one quiet line. |
| Tags as `<button>`s **inside** the row's `<Link>`, cancelled with `preventDefault` | **DROP from the row** | Works with a mouse, a coin toss with a screen reader, and it swallowed five tag names into the row's accessible name. Tags moved to the case page and the filter chip. |
| Holding truncated at 300 chars in JS **and** clamped to 2 lines in CSS | **REDESIGN** | Two truncations meant the ellipsis a reader saw was usually the wrong one. One clamp, in CSS, at the real width. |
| Recently Added / Trending tabs | **KEEP, rewired** | v1 mounted both infinite queries always, shared ONE intersection-observer ref between them, and read `activeQuery` inside the effect — so the sentinel belonged to whichever tab rendered last. Now: one sentinel bound to the active query, each view its own key, and the view is in the URL. |
| Tabs hidden behind `activeQuery.isLoading` | **DROP** | Tabs are static chrome; standards §8i says they render on the first frame. |
| "Request this content", rendered **twice** on one screen | **KEEP once** | Same component, two mutually-exclusive positions (empty state, and a search with ≤3 results). |
| `CasePagination` | **DROP** | Dead — infinite scroll replaced it. |
| `PageHeader` "Case Library / Browse and search legal cases…" | **DROP** | The shell header already names the route. |
| No `loading.tsx` at all | **FIX** | Real route boundary, sharing one component with the page's own Suspense fallback. |

### `/cases/[slug]` — the case

The headline finding: **v1 rendered the same case three different ways.**

- a default **card** view (six bordered cards: principles, body, a metadata grid, judges, and
  each related set),
- a **reader mode** document behind a toggle persisted in `localStorage` (default **off**),
- a **blog** theme visible only to `superadmin`, behind a palette dropdown.

Roughly 950 lines of component for one page, three code paths that could disagree — and they
did: the card view treated `body` as **HTML**, the reader treated it as **plain text**.

| v1 | verdict | why |
|---|---|---|
| The three-way split, the reader-mode toggle, the persisted store, the superadmin palette | **DROP** | A judgment is a document; it gets the document. The toggle asked every reader to pick a layout for a page with one correct answer, and the layout they picked is the one we now always ship. |
| The card view | **DROP** | Six rectangles around one judgment is the "box" problem at its worst. |
| `dangerouslySetInnerHTML={{ __html: body }}` (card view) and `` `<p>${paragraph}</p>` `` string-building (reader + report) | **DROP — and it was a defect** | The admin form writes `body` from a bare `<Textarea>`; it is plain text, so both HTML paths were wrong about what they held, and the second concatenated unescaped content into markup. Small blast radius (only our editors author cases) and a stored-XSS shape. v2 renders text as React elements — nothing is ever handed to the browser as HTML. Legacy markup is degraded down to text, one-way. |
| Two near-identical heading formatters, one per surface, already drifted (the report's recognised more heading words than the summary's) | **DROP** | One renderer, both surfaces. |
| Title, court/country/date, citation, tags, judges, topic, holding, summary | **KEEP** | All of it. |
| Similar / Cases cited / Cited by, with treatment badges and unlinked-citation handling | **KEEP** | And each set now has a heading and one line saying what it is — in reader mode v1 showed "Similar cases" as an unlabelled list. |
| Actions bar (bookmark, share, feedback, add-to-folder) **above** the case | **REDESIGN** | The first thing a reader met on a judgment was a toolbar. Now under the heading block, at metadata weight. |
| Feedback button, add-to-folder button | **DEFERRED, not stubbed** | Both are whole v1 features behind the import boundary; folders is its own phase-4 workstream. A button that opens nothing is worse than an absent one. |
| Soft view limit (summary replaced) + hard limit (429 screen) | **KEEP, redesigned** | Gold, not red — a limit is an invitation, not a failure. The soft state now keeps the title, holding and citations visible, so a blocked reader can still tell whether this was the case they wanted. |
| `FloatingPromptInput` — a floating pill opening a sheet with its **own** chat engine (~800 lines: its own SSE handling, message rendering, tool-call rendering and conversation list) | **DROP the engine, KEEP the job** | It had already drifted from the real conversation page (legacy stream mode, different thinking indicator, no reasoning traces). v2 creates a normal conversation tagged `references: [{type:'case'}]` and hands the reader to the real conversation screen. |

### `/cases/[slug]/report` — the full judgment

**KEEP as its own route** (a full judgment is tens of thousands of words; a reader who wants
only the holding should never download it). Rebuilt on the same renderer and the same states
as the case page. v1 asked for the three related sets here and rendered none of them — dropped.

## What shipped

**Routes** (`/cases/*` added to `routes.manifest.ts`)

- `app/v2/cases/` — page + `loading.tsx`. Server `generateMetadata` (indexed, canonical, OG),
  an **awaited** page-1 prefetch, `unstable_dynamicStaleTime = 300`.
- `app/v2/cases/[slug]/` — page + `loading.tsx`. `generateMetadata` from the shared,
  unauthenticated, 5-minute-cached read; per-case OG card.
- `app/v2/cases/[slug]/report/` — page + `loading.tsx`. Canonical points at the case.
- `app/api/og/cases/[slug]/route.tsx` — the share card.
- `app/sitemap.ts` — one entry per case, bounded and stated (20 pages × 100).

**Feature** (`v2/features/cases/**`)

`queries.ts` (list, infinite list, infinite trending, three detail shapes, case conversations),
`server.ts` (the prefetch), `case-row-model.ts` (one row model, two endpoints), `list/**`
(screen, browser, row, states, request dialog), `detail/**` (document, text renderer, related
cases, actions, ask cluster, states, reading CSS), `report/**`.

**Shared, extracted rather than forked**

- `v2/runtime/url-params.ts` — the native-history filter write, extracted from the
  conversations search box so the cases tag and view filters use the proven path.
- `v2/runtime/use-url-search.ts` — the race-free search box, now shared by both list pages.
- `v2/shell/SearchField.tsx` — the field **and** its still reservation in one module, so a
  route fallback and the live control can no longer drift.
- `v2/features/bookmarks/` — `cache.ts` (the multi-surface writer), `mutations.ts`,
  `BookmarkButton.tsx`.
- `startConversation` + `HomeComposer` gained `references` and `placeholder`, which is what
  lets the case page reuse the one composer instead of growing a second chat engine.

**Decisions worth a second opinion (owner)**

1. **The reader-mode toggle is gone.** Reader mode defaulted to OFF, so most people saw the
   card view; everyone now gets the document. This is the biggest visible change.
2. **The ask box is inline at the end of the case, not floating.** A composer floating over a
   judgment covers the text being read. If people want to ask mid-read, the fix is a floating
   layer like the conversation screen's — the create path would not change.
3. **No "N new" pill on the cases list**, unlike conversations. Nobody publishes a case from
   another tab, so `REFETCH_ON_VISIT` is deliberately absent and the `reference` tier is the
   lever. Stated in `queries.ts`.

**Verification**

`tsc --noEmit` clean · `eslint --max-warnings=0` clean over `v2`, `app/v2`, `app/api/og`,
`app/sitemap.ts`, `lib/api/server.ts` · `V2_ENABLED=true next build` clean, with all five v2
case routes correctly **dynamic** and `/sitemap.xml` prerendered with a 1-day revalidate.
(A build **without** that flag is meaningless — the kill switch `notFound()`s before
`cookies()` and the whole v2 tree prerenders as static 404s.)

**Measured against prod while building (July 25) — two facts that changed the build**

| call, no token | answer | what it changed |
|---|---|---|
| `GET /api/cases` | **401** | The library is NOT public. `CasesBrowser` gates on the session and shows a designed sign-in state; the RSC prefetch skips signed-out requests entirely. v1 hides this by minting a guest token for every visitor (`useGuestAuth`) — **v2 has no equivalent, and that is a real gap for the auth workstream.** |
| `GET /api/trending/cases` | **401** | Same. |
| `GET /api/cases/{unknown-slug}` | **404**, not 401 | The single-case read is not behind the login wall, so the OG card and `generateMetadata` work. Asked backend to confirm it is intended. |

**Consequence: the per-case sitemap entries ship EMPTY.** The enumeration is written and
correct; it gets a 401 and stops, so `sitemap.xml` carries its eight static routes and no
cases. Verified by reading the built output. Kept rather than deleted, and said out loud in
both `app/sitemap.ts` and `lib/api/server.ts` — a sitemap that silently lists nothing looks
exactly like one that works. **Phase-4 exit criterion partially unmet for cases until the
backend answers.**

**Open with the backend team**

`backend-ask-2026-07-25-cases-read-endpoints.md` — every endpoint the reader uses, plus the
questions above. Two that matter most:

1. **Does `GET /api/cases/{slug}` record a view and spend a plan unit per request?** One
   reader reading one case can produce five of those calls, two of them from a shared link's
   preview.
2. **A no-login list of case slugs**, which is what unblocks the sitemap.
