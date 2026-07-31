# Phase 4, Wave 2 — Statutes + Radar: study & task breakdown

> Decision document for the owner (July 31, 2026). No implementation has
> started. Wave 1 (cases) is the shipped template this wave builds on.

## Live API facts (probed against prod, July 31)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/statutes` | ✅ works (guest token OK) | list envelope `{data, pagination, links}`; params: `search`, `country` (numeric id), `status`, `year`, `sort`, `order`, `per_page` ≤ 100 |
| `GET /api/statutes/countries` | ❌ **404 — not shipped** | v1 ships a hardcoded seed fallback (Nigeria 787 / Ghana 150 / Tanzania 52 / Uganda 15) and silently swallows the error |
| `GET /api/statutes/{slug}` | ✅ works | metadata only — includes `nodes_count`, `root_nodes_count`, `document_type`, `frbr_uri` (the last two missing from our types; free header material) |
| `GET /api/statutes/{slug}/export-akn` | ✅ works, **uncapped** | full raw AKN 3.0 XML; 275KB for a 719-node Act |
| `GET /api/statutes/{slug}/outline` | ❌ **404 — parked** | agreed fields (`type, number, title, slug_path, position, depth`) exist only in the backend-reply doc |
| `GET /api/statutes/{slug}/nodes` | exists, capped at 100 | ZERO consumers since statutes-old was deleted — dead |
| `GET /api/radars` | ✅ works | standard envelope; per-user data |

**Consequence:** the v2 statute reader must be built on `export-akn` (full XML,
parsed client-side) with a **client-generated outline**. The parked `/outline`
endpoint and the countries facets are backend asks to send, not blockers.

---

## Part A — Statutes

### A0. Keep / redesign / drop (from the v1 survey)

**`/statutes` list**

| v1 | verdict | why |
|---|---|---|
| Infinite list + URL search + country tabs | KEEP the model | Same spine as the cases list. |
| Row: title, short_title, country, year, status chip, bookmark, preview | KEEP content, REDESIGN row | Rebuild in the cases-row grammar: name at full weight, one quiet meta line, hairlines not boxes. |
| Country tabs on `useStatuteCountries` + hardcoded seed fallback | KEEP mechanism, REDESIGN | Facets endpoint still 404s; keep seed fallback but stop swallowing errors silently. Show counts on tabs (fetched today, never displayed). Use country SLUG in the URL, not numeric id. |
| `AnimatedTabs` (no tablist roles, no keys) | DROP | v2 tab grammar (cases tabs) with real `role="tablist"`. |
| Double truncation (200 chars JS + 2-line clamp) | DROP | One CSS clamp. |
| `router.push` per keystroke | DROP | `replaceUrlParams` (the v2 loud write) — Back must not rewind a search letter by letter. |
| Bookmark `<button>` inside the row `<a>` | DROP | Invalid HTML; v2 row action pattern instead. |
| No loading.tsx / error.tsx / metadata / SSR | FIX | Server page + `generateMetadata` + prefetch page 1 + real route skeleton (cases template). |
| Status/year/sort filters in API, no UI | DECISION | Cheap to add as quiet filter chips; default OFF the first cut. |

**`/statutes/[slug]` reader**

| v1 | verdict | why |
|---|---|---|
| Two parallel fetches (meta + full AKN XML) | KEEP | Right shape; add server prefetch of the meta for first paint + metadata/OG. |
| `AknElementRenderer` (DOM-Element-driven recursive renderer) | KEEP the approach, HARDEN | It's the working AKN engine. Port into v2 with: namespace-safe root lookup, `React.memo` on structural nodes, stable keys, the double-`<div>` noise removed, `thead/caption` handled, and **sanitization** on every `dangerouslySetInnerHTML` site (9 today, semi-trusted admin XML on a public reader). |
| `.statute-document` CSS (265 lines, hardcoded oklch, justify+hyphens) | REDESIGN | Re-express in the v2 reading system (case-document.css grammar): theme tokens, no justified text, serif reading voice. |
| No outline / TOC / anchors | BUILD NEW | The case page's outline rail is the pattern. Derive the outline **client-side from the parsed XML** (chapters/parts/sections), stamp stable ids, scroll-spy, deep-linkable anchors. This also future-proofs: when backend ships `/outline`, only the data source swaps. |
| No large-document strategy (719+ nodes, one synchronous render) | BUILD NEW | Parse once in a worker-safe `useMemo`; render progressively: top-level containers mounted, `content-visibility: auto` on section blocks + chunked mounting so the first screen paints fast without backend ranged endpoints. |
| Header ignores status/document_type/frbr_uri | REDESIGN | Case-document header grammar: kicker (country · year · document_type), title, short_title, status badge (a repealed Act must LOOK repealed), meta row. |
| Tables blow out mobile (no overflow wrapper) | FIX | The audit's known finding — `overflow-x-auto` wrappers. |
| Statute chat dock | KEEP, v2-ized | The case page's one-screen chat dock is the shipped pattern; `references: [{type:'statute', id: slug}]` already supported. **Decision: include in this wave or defer?** (Recommended: include — the case dock components are reusable nearly as-is.) |
| Dead: StatuteDetailHeader, StatuteMetadataGrid, nodes/navigate API fns, node types, .proviso CSS, seed-lying skeletons | DROP | Delete on cutover of the route. |

### A1. Task breakdown — statutes

1. **A1 List screen** (`/statutes` → `app/v2/statutes/(library)`)
   1. server `page.tsx`: `generateMetadata` + prefetch page 1 + HydrationBoundary + `unstable_dynamicStaleTime` (cases template)
   2. `StatutesScreen` client root (header context, Suspense shape) + `loading.tsx`
   3. `statutesQueries` (v2 query layer: list infinite, countries with seed fallback + honest error signal, detail, akn)
   4. `StatutesBrowser`: URL-backed search (`replaceUrlParams`) + country tabs (slug in URL, counts shown, real tablist) + infinite list (one sentinel, v2 spine)
   5. `StatuteRow`: cases-row grammar (title weight, one meta line: country · year · status, bookmark action, single clamp preview)
   6. states: skeleton that matches the real layout, error+retry, search-aware empty
   7. film battery: tabs, search, infinite scroll, bookmark, mobile
2. **A2 Reader screen** (`/statutes/[slug]` → `app/v2/statutes/[slug]`)
   1. server `page.tsx`: `generateMetadata` (title, canonical, OG) from the metadata fetch + `loading.tsx` skeleton at real geometry
   2. `StatuteScreen`: meta query gates header; AKN query streams the document
   3. **AknDocument** (ported+hardened renderer): namespace-safe root, memoized structural nodes, sanitized HTML injection, thead/caption, overflow-wrapped tables, `.v2-statute-doc` CSS on theme tokens
   4. **Outline system**: client-derived outline (chapter/part/section), stable anchor ids, outline rail ≥80rem (case pattern), scroll-spy, `#anchor` deep links
   5. **Big-document strategy**: chunked mounting + `content-visibility`; verify on the heaviest statute in prod
   6. header: kicker/title/status badge/meta + actions row (bookmark, share, folder, feedback)
   7. statute chat dock (reuse case one-screen dock; statute references)
   8. film battery: cold load, outline nav, mobile tables, dark/light, 429 copy
3. **A3 Plumbing**
   1. `routes.manifest.ts`: add `/statutes/*`
   2. sitemap entries for statutes
   3. backend message (per inter-team rule, outcomes only): countries facets endpoint; `/outline` when ready; flag `export-akn` uncapped size for the biggest acts
   4. delete v1 dead files on cutover (listed in survey)

---

## Part B — Radar

### B0. Keep / redesign / drop (from the v1 survey)

The backend is COMPLETE for radar — every screen's endpoint exists and works.
The v1 feature is functionally rich but carries heavy duplication, a11y debt,
and several correctness warts (all catalogued in the survey transcript).

**`/radars` list**

| v1 | verdict | why |
|---|---|---|
| Status tabs Active/Paused/Archived | KEEP, URL-backed | v1 keeps tab in local state; v2 puts it in the URL (loud write) with a real tablist. |
| RadarCard (full-bleed link overlay, z-index escapes) | REDESIGN | v2 row grammar: the NAME is the link; actions are real siblings; status not color-only (dot + label). Unread count shown. |
| `per_page: 50`, silent truncation, no pagination UI | DROP | v2 infinite list spine. |
| Per-card dropdown (Scan now / Pause / Settings / Archive) | KEEP | Same actions, one shared action layer (v1 triplicates the handlers + toasts). |

**`/radars/new` create form**

| v1 | verdict | why |
|---|---|---|
| Form model: jurisdiction chips, topic chips, schedule sentence-builder, More-options collapsible, review dialog, first-scan toggle | KEEP the model | It is a good form. The problems are execution, not shape. |
| `ChipZone` (role-less click-to-type div) | REDESIGN | Keyboard-first chips: focusable zone, roving delete, aria-live on add/remove. |
| SchedulePicker | KEEP, polish | Add fieldset/legend semantics; unslice the timezone list (searchable, no silent 50-cap); move "N messages left" out of the timezone line into the review dialog where the cost line already lives. |
| Async AI naming (silent h1 swap; poll 3s/45s) | KEEP mechanics, ADD UI | v2 shows "Naming this radar…" shimmer + aria-live announce on upgrade. |
| Block-reason branch replaces the whole page | REDESIGN | An in-page state with the banner + "Go to radar", never a dead end. |
| Entities picker (dead), notificationChannelsApi (dead), review-dialog-in-edit (unreachable) | DROP | Delete with the route cutover. |

**`/radars/[uuid]` detail (inbox)**

| v1 | verdict | why |
|---|---|---|
| Inbox / Completed / Archived workflow tabs + triage | KEEP, URL-backed | The core value. Port the optimistic triage machinery (`useTriageScan`) — it is the best code in the feature. |
| Client-side re-filtering of server pages (broken-looking scroll) | DROP | Ask the server: `status=completed&workflow_status=X` for triaged tabs; the inbox tab merges in-flight + active. |
| First-scan placeholder + 15s/10s polling + completion detection | KEEP | Proven; add aria-live for row arrivals/departures. |
| Settings: sheet + hand-rolled pushState + a second route | REDESIGN | The v2 quiet-URL pattern (the case chat's `?chat=` machinery) — one route, `?settings=1` quiet-pushed so Back closes the sheet. Drop the `/settings` route. |
| Scan log (separate route, own table, drift: its own duration format) | FOLD IN | Becomes an "All activity" view on the detail (fourth tab), one row component — kills a route and a duplicated renderer. **[Owner decision D3]** |
| Radar AI dock (FloatingPromptInput) | DEFER or GENERALIZE | See decision D2. |

**`/radars/[uuid]/scans/[scanUuid]` report**

| v1 | verdict | why |
|---|---|---|
| Three viewer classes (owner / signed-in / public guest) + SSR metadata off the public endpoint | KEEP | Already the right architecture; port as-is. |
| Ownership by duck-typing (`'is_private' in scan`) | KEEP but centralize | One `resolveScanViewer()` seam instead of scattered non-null assertions. |
| Markdown report + sources | KEEP, re-render in v2 grammar | v2 reading typography; sources numbered by `position` (not array index); SSR-safe in-app links; running-scan page polls for guests too (v1 freezes). |
| Triage toolbar + share dialog (publish/unpublish, copy link, views) | KEEP | Fix: signed-in non-owner sees view count too; copy-timeout cleanup. |

### B1–B5. Task breakdown — radar

1. **B1 List** (`/radars` → `app/v2/radars`)
   1. `radarsQueries` v2 query layer (list infinite by status, detail, scans, triage mutations — port the optimistic engine)
   2. server page (noindex metadata — private surface) + loading + screen root
   3. URL-backed status tabs + row redesign (name-link, status dot+label, unread badge, meta line, actions menu)
   4. shared radar-actions layer (scan-now / pause / resume / archive — one implementation, one toast voice)
   5. film battery
2. **B2 Create** (`/radars/new`)
   1. v2 chips system (keyboard-first ChipZone replacement) — jurisdictions + topics + keywords
   2. SchedulePicker port with fieldset semantics + full timezone search
   3. form shell: More options, review dialog (cost line), first-scan toggle, server-error mapping (honest: only claim highlights when a field really highlighted)
   4. create flow states incl. block-reason in-page state + "naming…" shimmer + poll
   5. film battery
3. **B3 Detail** (`/radars/[uuid]`)
   1. header (name/status/meta row/actions) + workflow tabs (URL-backed) + server-filtered queries
   2. scan rows (one component for inbox AND activity view), first-scan placeholder, polling + completion invalidation
   3. settings sheet on quiet-URL (edit form = B2 in edit mode) + archive dialog
   4. "All activity" view (absorbs scan-log) **(if D3 = fold)**
   5. film battery
4. **B4 Report** (`/radars/[uuid]/scans/[scanUuid]`)
   1. server page: `generateMetadata` off the public endpoint (port; it is already correct)
   2. viewer resolution seam + three states; auto-mark-read; running indicator with guest polling
   3. report body in v2 reading grammar + sources (position-numbered, SSR-safe links)
   4. triage toolbar + share dialog
   5. film battery
5. **B5 Plumbing**
   1. `routes.manifest.ts`: add `/radars/*`
   2. nav entry in the v2 sidebar/drawer
   3. delete dead v1 code on cutover (survey list)
   4. memory + post-implementation notes

---

## Decisions for the owner

| # | Question | Recommendation |
|---|---|---|
| D1 | Statute reader outline: build **client-derived** outline now, or wait for backend `/outline`? | Build client-side now — same UI either way; swap the data source when backend ships. Send the backend ask regardless. |
| D2 | AI chat docks on statutes + radar screens: generalize the case one-screen dock now, or defer to a follow-up wave? | Defer to its own wave — the dock generalization (case→statute/radar references) is clean but sizeable; shipping the surfaces first keeps this wave focused. |
| D3 | Radar scan log: fold into the detail as an "All activity" view, or keep as its own route? | Fold in — one route and one row renderer fewer; nothing is lost. |
| D4 | Statutes list filters (status/year/sort exist in the API, no UI in v1): add now or later? | Later — country tabs + search first; filters are additive. |
| D5 | Build order | Statutes first (public, SEO-bearing, smaller), then radar (private, larger). |
| D6 | Backend asks to send now (outcomes only): statutes countries facets; statutes `/outline`; ask whether `export-akn` stays uncapped for the largest acts; guest principles cap (already owed) | Send one message covering all four. |

