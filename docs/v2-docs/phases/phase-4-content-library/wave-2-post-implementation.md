# phase-4 wave 2 (statutes + radar) — post-implementation

> Closed July 31, 2026. Two parallel implementer agents (one per feature), one
> shared playbook; every round independently audited (adversarial code checker
> per feature), then built, filmed, and critiqued centrally. Two critique
> rounds per feature; all items closed.

## What was built

**Statutes** (`v2/features/statutes/**`, `app/v2/statutes/**`, additive
`types/statute.ts`):
- Library list: server page + full public metadata + filter-aware awaited
  prefetch; URL-backed search (quiet replace) + country tabs (slug in URL, id
  on the wire, live→seed facets chain — counts render only from the live
  source); StatuteRow (title / designation / flag+country / year / status
  dot+word), skeletons, designed empty/error/signed-out states, infinite
  scroll.
- Reader: client-fetched full AKN XML (deliberately never dehydrated),
  namespace-proof parser → flat block sequence + outline in ONE walk; ZERO
  `dangerouslySetInnerHTML` (v1 had nine); progressive mounting (16 + 40/batch)
  × `content-visibility: auto`; scroll-spy with an at-bottom fallback, rooted
  at the shell scroller; contents rail ≥96rem (arithmetic in the code) with a
  pill+sheet below it; `#akn-{eId}` deep links (StrictMode-safe); header with
  status badge + `repealed_by`; per-statute bookmark layer; UTC-safe dates;
  404/429/unreadable-XML/empty states.

**Radar** (`v2/features/radars/**`, `app/v2/radars/**`):
- List: private metadata (noindex), URL-backed status tabs, unread badges,
  first-run pitch state, shared actions layer + one archive confirm dialog
  (owns its own close; pending state is real).
- Create: keyboard-first chips (IME-safe, cap-honest announcements),
  APG-correct comboboxes for timezone (full IANA list, offset search) and
  jurisdictions, fieldset schedule with native-radio pills, device timezone
  via uSES (no SSR mismatch — the page prerenders), review dialog with honest
  cost lines, 422→field mapping that opens the collapsed group and focuses the
  first error, blocked-first-scan in-page state, post-create naming shimmer
  (3s/45s poll) that settles into the AI name.
- Detail: server-filtered workflow tabs (quiet `?tab=`), ONE ScanRow across
  tabs + the folded "All activity" view (v1's /scan-log route died), settings
  as a sheet on quiet-pushed `?settings=1` (Back closes — v1's /settings route
  died), 15s list polling that stops when terminal.
- Report: three viewer classes (owner / signed-in / public share), case-doc
  reading grammar via `report.css`, position-numbered sources (gaps
  preserved), triage toolbar on the ported `useTriageScan`, share dialog,
  10s polling while running.

**Shared (integrator-owned)**: `/statutes/*` + `/radars/*` in
`v2/routes.manifest.ts`; Radar sidebar entry; `formatCaseDate` UTC fix +
per-case bookmark mutation scope (defects the audits surfaced in the cases
templates); `ordinal()` exported from `lib/utils/cron.ts`.

## Verification

- `npx tsc --noEmit` clean; `eslint --max-warnings 0` clean on every touched
  file; `V2_ENABLED=true npx next build` exit 0 (NOTE: the flag is REQUIRED at
  build time — `/v2/radars`, `/v2/radars/new`, `/v2/conversations` prerender
  statically, and without it the layout kill switch bakes them as 404s).
- ~65 filmed screens/states via the Playwright harness (guest session for
  statutes against real prod data incl. the 881KB CFRN export; a dedicated
  prod film account + full fixture set for radar). Measured probes: deep-link
  scroll, bottom scroll-spy, mobile table overflow scroll, rail overflow at
  1440/1600, settings-sheet Back-close, naming shimmer→settle.

## Known gaps / follow-ups

1. **Tab keyboarding unification** — `RadarTabs` implements the full APG
   contract; statutes `CountryTabs` and the cases tab rows still share v1's
   roles-without-keyboarding gap. Deliberately deferred: the right fix is ONE
   shell tabs primitive adopted by all three features in a focused pass.
2. Contents rail exists only ≥96rem (the honest geometry with a 256px sidebar
   + 48rem column); below that the pill+sheet serves. Revisit only if the
   shell ever reclaims sidebar width.
3. Statute OG cards are text-only; sitemap statute entries ship empty —
   both blocked on the public-read backend ask.
4. Failed/skipped scans appear only under "All activity" (v1 parity) — raised
   to the owner as a product question, not a defect.
5. Backend asks consolidated in `docs/v2-docs/backend-ask-2026-07-31-statutes-radar.md`.

## Notes for the next wave

The case side-chat panel is the next phase-4 item; statutes chat dock stays
deferred (decision D2). The film harness recipe (fixtures, film account,
verify scripts) lives in the session scratchpad and is reproducible from the
memory notes.
