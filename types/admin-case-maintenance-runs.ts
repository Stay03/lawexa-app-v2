// Admin case maintenance runs — types
// Backend: /api/admin/case-maintenance-runs (role:admin)
//
// Agreed with @backendclaude in #Product Development, 22 August 2026, and
// written from the field names he sent rather than from the description that
// preceded them. Two things in that description did not line up and were
// settled before any of this was written; both are recorded where they bite.

import type { JobUserRef } from '@/lib/utils/observability';

/**
 * Which job a run is doing.
 *
 * Named "maintenance" and not "backfill" because it carries both: fetching a
 * case again from NWLR, and the free editorial cleanups that need no provider
 * and no AI.
 */
export type CaseMaintenanceRunType = 'nwlr_refresh' | 'editorial_cleanup';

export const CASE_MAINTENANCE_RUN_TYPES: CaseMaintenanceRunType[] = [
  'nwlr_refresh',
  'editorial_cleanup',
];

/**
 * Where a run is.
 *
 * `paused` and `cancelled` are NOT two words for one thing, and the difference
 * decides what the buttons may do:
 *
 *  - `paused` is reversible. A person can pause a 25-hour run overnight, and
 *    the system pauses one itself when the provider keeps failing rather than
 *    spending 1,800 fetches on a dead gateway. `resume` covers both.
 *  - `cancelled` is a person ending it, terminal, and the only control on this
 *    screen that must ask before it acts.
 */
export type CaseMaintenanceRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export const CASE_MAINTENANCE_RUN_STATUSES: CaseMaintenanceRunStatus[] = [
  'pending',
  'running',
  'paused',
  'completed',
  'cancelled',
];

/**
 * Where one case inside a run is.
 *
 * `awaiting_confirmation`, `conflict` and `no_match` belong to `nwlr_refresh`
 * only — a cleanup never produces them, so a screen filtered to cleanup must
 * not offer them as filters.
 *
 * `awaiting_confirmation` is the safety step on the 126 cases we can match by
 * title alone. A wrong match writes another case's judgment and cannot be
 * undone, so nothing is written until a person picks.
 */
export type CaseMaintenanceItemStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'conflict'
  | 'no_match'
  | 'cancelled';

export const CASE_MAINTENANCE_ITEM_STATUSES: CaseMaintenanceItemStatus[] = [
  'pending',
  'awaiting_confirmation',
  'running',
  'completed',
  'failed',
  'skipped',
  'conflict',
  'no_match',
  'cancelled',
];

/** Item statuses a cleanup run can never reach — see above. */
export const CLEANUP_ONLY_EXCLUDED_ITEM_STATUSES: CaseMaintenanceItemStatus[] = [
  'awaiting_confirmation',
  'conflict',
  'no_match',
];

/**
 * How a case was tied to a document at the provider.
 *
 * TWO VOCABULARIES, and they are not the same one. The PREVIEW groups a case
 * into a bucket before anything runs — `exact_key`, `part_only`, `title_only`
 * and so on. A finished ITEM reports how it was matched in the end, and uses
 * different words: `citation_key` is what a completed item carries where the
 * preview said `exact_key`.
 *
 * Kept as one open-ended lookup rather than a closed union, because a label
 * this screen has never seen must degrade to showing the raw value rather than
 * rendering nothing. The first version was a closed union and a real
 * `citation_key` fell straight through it into a blank cell.
 */
export type CaseMatchMethod = string;

/**
 * How many items are in each state.
 *
 * EVERY KEY IS ALWAYS PRESENT, even at zero — stated by the backend author so
 * a missing key never has to be read as either "none" or "something broke".
 */
export type CaseMaintenanceProgress = Record<CaseMaintenanceItemStatus, number>;

export interface CaseMaintenanceRun {
  uuid: string;
  type: CaseMaintenanceRunType;
  status: CaseMaintenanceRunStatus;
  total_items: number;
  progress: CaseMaintenanceProgress;
  /**
   * How many cases this run actually ALTERED.
   *
   * ── READ THIS INSTEAD OF `progress.completed` ──────────────────────────
   * The single most misleading number on the screen if it is ignored, and the
   * backend author raised it before it could bite: a cleanup over the whole
   * corpus finishes thousands of items that change nothing, because most cases
   * are already correct. An NWLR run does the same when a case was already
   * refreshed or the evidence did not agree.
   *
   * So `completed` means WE LOOKED AT IT and `changed_count` means WE ALTERED
   * IT. Showing the first as if it were the second would report 11,609 cases
   * rewritten when forty were — a screen lying with true numbers, which is the
   * hardest kind to notice.
   *
   * Always present, always a number, on both kinds of run.
   */
  changed_count: number;
  options: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: JobUserRef | null;
}

/** The case a run item is about, as the item carries it. */
export interface CaseMaintenanceItemCase {
  id: number;
  title: string;
  citation: string | null;
  slug: string;
}

/**
 * Why the server reached the conclusion it did, field by field.
 *
 * This is what makes a decision judgeable rather than a guess: our title and
 * year against the document's, and whether each agreed. A person looking at a
 * conflict can see that the citation matched and the titles did not, which is
 * exactly the case where a human should be the one to say yes.
 */
export interface CaseMaintenanceEvidence {
  our_key?: string | null;
  our_year?: number | null;
  our_title?: string | null;
  year_match?: boolean;
  title_match?: boolean;
  citation_match?: boolean;
  document_year?: number | null;
  document_title?: string | null;
  document_stated_key?: string | null;
  document_stated_citation?: string | null;
}

/**
 * What happened to one case.
 *
 * ── THIS IS AN OBJECT, NOT A STRING, AND THAT CRASHED THE SCREEN ──────────
 * The contract called it "free text about what happened". It is not: it is a
 * structured record carrying `changed`, `evidence`, `case_slug` and
 * `boundary_confidence`. Typed as a string and rendered directly, React threw
 * error #31 — objects are not valid as a child — and the run page went white
 * for the owner while he was watching his first real run.
 *
 * Typed from a live payload this time, not from a description of one.
 */
export interface CaseMaintenanceItemDetail {
  /** Whether this case was actually altered, as opposed to merely handled. */
  changed?: boolean;
  /** Present on `name_search` items — see {@link CaseMaintenanceNameSearch}. */
  name_search?: CaseMaintenanceNameSearch | null;
  evidence?: CaseMaintenanceEvidence;
  case_slug?: string | null;
  /** How the end of the judgment text was found. */
  boundary_confidence?: string | null;
  reference?: CaseMaintenanceReference | null;
}

/**
 * What we managed to read out of OUR OWN citation before going to the provider.
 *
 * ── IT SEPARATES THE TWO WAYS A CASE GOES UNMATCHED ───────────────────────
 * The error line alone cannot tell them apart, and they need opposite fixes:
 *
 *  - `part: null` with `mentions_nwlr: true` — the citation names NWLR but
 *    carries no part or page. Nothing was ever asked of the provider; the
 *    reference is somewhere we did not look, usually the title.
 *  - a part and page, with a 404 beside it — we asked, and the provider had
 *    nothing there. Either their library lacks it or our part number is wrong.
 */
export interface CaseMaintenanceReference {
  key?: string | null;
  part?: number | null;
  page?: number | null;
  /** True when the citation mentions NWLR at all, parseable or not. */
  mentions_nwlr?: boolean;
}

/**
 * The detail of an item, or nothing — with `[]` treated as nothing.
 *
 * Two of the four items in the owner's run carried `detail: []`. See the field
 * itself for why an empty record arrives as a list.
 */
/**
 * What the name search found, when a citation could not identify a case.
 *
 * ── THIS WAS BEING SENT AND NOBODY READ IT ────────────────────────────────
 * The screen rendered "Nothing changed" on every row that needed a decision,
 * because nothing here was typed and the renderer fell through to the default.
 * So the ONLY rows showing a reviewer nothing were the ones asking them to
 * decide, and "Yes, use it" invited them to accept a case never displayed.
 * The owner asked, exactly: "use what?".
 *
 * Everything needed to answer him was already on the payload.
 */
export interface CaseMaintenanceNameSearchCandidate {
  title: string | null;
  citation: string | null;
  date: string | null;
  provider_case_id: string | null;
  /** 0 to 100. How close the reported name is to ours. */
  title_similarity: number | null;
  /** Whether any party name is common to both. A hard gate, never scored. */
  shares_party: boolean | null;
  party_reason: string | null;
  part_agreement: string | null;
  year_overlap: boolean | null;
}

export interface CaseMaintenanceNameSearch {
  /** What we asked the provider for. */
  query: string | null;
  /** The candidate that won, or null when none was good enough. */
  winner: CaseMaintenanceNameSearchCandidate | null;
  /** Why a person is being asked — a tie, a low score, a failed gate. */
  reasons?: string[] | null;
  /** The score a candidate must beat to be written without a person. */
  threshold?: number | null;
  candidates?: CaseMaintenanceNameSearchCandidate[] | null;
  auto_eligible?: boolean | null;
}

export function caseMaintenanceDetail(
  detail: CaseMaintenanceItemDetail | unknown[] | null,
): CaseMaintenanceItemDetail | null {
  if (!detail || Array.isArray(detail)) return null;
  return detail;
}

export interface CaseMaintenanceItem {
  id: number;
  case: CaseMaintenanceItemCase;
  status: CaseMaintenanceItemStatus;
  match_method: CaseMatchMethod | null;
  /** What it matched to at the provider, when it matched. */
  provider_case_id: string | null;
  /**
   * See {@link CaseMaintenanceItemDetail} — an object, never a string.
   *
   * AN EMPTY ONE ARRIVES AS `[]`, NOT `{}`, because PHP serialises an empty
   * associative array as a JSON list. A `!detail` guard passes it straight
   * through — `[]` is truthy — and every field then reads `undefined`. Read it
   * through {@link caseMaintenanceDetail}, never directly.
   */
  detail: CaseMaintenanceItemDetail | unknown[] | null;
  error: string | null;
  status_code: number | null;
  started_at: string | null;
  completed_at: string | null;
  /**
   * How closely the BEST candidate resembled the case, 0-100. The server picks
   * the best rather than the first, so this does not silently follow a change
   * in candidate ordering.
   *
   * NULL AND ZERO ARE DIFFERENT THINGS AND MUST NEVER BE MERGED.
   * `null` — nothing was scored. No candidate came back at all, or the item
   *          never went to a name search. 68 of 116 items on 27 August.
   * `0`    — we searched, candidates DID come back, and none resembled the
   *          case. Item 103 has ten candidates, every one scoring 0, because
   *          its title carried a citation into the query.
   * Showing them as one group tells a reviewer that a hundred cases were looked
   * at and found unrelated, which is false for the sixty-eight.
   */
  score: number | null;
  /** The score at or above which the server accepts a match without asking. */
  threshold: number | null;
}

/* ── Choosing what to run ──────────────────────────────────────────────────── */

/**
 * How the cases for a run are chosen.
 *
 * ── `mode` IS REQUIRED, AND IT WAS NOT IN THE WRITTEN CONTRACT ────────────
 * Measured against the live endpoint on 22 August: a body without it is
 * refused with 422 `selection.mode field is required`, and the accepted values
 * are exactly `nwlr`, `all` and `ids`. The shape agreed in the channel had
 * only `filter` and `case_ids`, so every call built from it fails.
 *
 * Kept as a discriminated union rather than three optional fields, because
 * "mode: ids with no case_ids" is its own 422 and the type should make that
 * unrepresentable rather than leave it to be discovered at runtime.
 */
export type CaseMaintenanceSelection =
  /** Every case that qualifies for an NWLR refresh. */
  | { mode: 'nwlr' }
  /** Every case in scope for the chosen job. */
  | { mode: 'all' }
  /** Exactly these cases — what the tick boxes produce. */
  | { mode: 'ids'; case_ids: number[] };

export interface CaseMaintenancePreviewParams {
  type: CaseMaintenanceRunType;
  selection: CaseMaintenanceSelection;
  page?: number;
  per_page?: number;
}

/** Counted over the WHOLE selection, not over the page of rows beside it. */
export interface NwlrRefreshPreviewSummary {
  total: number;
  exact_key: number;
  part_only: number;
  title_only: number;
  already_refreshed: number;
  no_reference: number;
}

export interface EditorialCleanupPreviewSummary {
  total: number;
  would_change: number;
  unchanged: number;
  held_back: number;
}

export type CaseMaintenancePreviewSummary =
  | NwlrRefreshPreviewSummary
  | EditorialCleanupPreviewSummary;

/** Narrowing helper — the two summaries share only `total`. */
export function isNwlrPreviewSummary(
  summary: CaseMaintenancePreviewSummary,
): summary is NwlrRefreshPreviewSummary {
  return 'exact_key' in summary;
}

/**
 * One candidate row in the preview: what you tick.
 *
 * ── THE TWO JOBS RETURN DIFFERENT ROWS ────────────────────────────────────
 * Not a variation on one shape — two shapes, sharing only `case`. The written
 * contract described the NWLR one and never mentioned that a cleanup answers
 * with something else, which is how a `part` field that never exists on a
 * cleanup came to be read on every cleanup row.
 *
 * A union rather than one type with everything optional, so a screen cannot
 * reach for `part` on a cleanup row without narrowing first.
 */
export interface NwlrPreviewRow {
  case: CaseMaintenanceItemCase;
  /** Which group it falls into for THIS run — not derivable on our side. */
  bucket: CaseMatchMethod | null;
  /** Parsed out of the citation. Present on this shape only. */
  part: number | null;
  page: number | null;
  provider_case_id: string | null;
}

/** One field the cleanup would rewrite, before and after. */
export interface CleanupFieldDiff {
  from: string | null;
  to: string | null;
}

export interface CleanupPreviewRow {
  case: CaseMaintenanceItemCase;
  /** Whether this run would touch the case at all. Most of the corpus: false. */
  would_change: boolean;
  /** Set when something stopped it being changed. */
  held_back: string | null;
  /** Which fields would be rewritten, e.g. title, citation, slug. */
  flags: string[];
  /**
   * The rewrite itself, per field.
   *
   * ARRIVES AS `[]` WHEN EMPTY, not as `{}`. An empty PHP associative array
   * serialises to a JSON array, so anything reading this must tolerate both
   * or it will read keys off an array and find none.
   */
  diff: Record<string, CleanupFieldDiff> | never[];
}

export type CaseMaintenancePreviewRow = NwlrPreviewRow | CleanupPreviewRow;

/** Narrowing helper — the two row shapes share only `case`. */
export function isCleanupPreviewRow(
  row: CaseMaintenancePreviewRow,
): row is CleanupPreviewRow {
  return 'would_change' in row;
}

/** The diff as entries, tolerating the empty-array form. */
export function cleanupDiffEntries(
  row: CleanupPreviewRow,
): [string, CleanupFieldDiff][] {
  return Array.isArray(row.diff) ? [] : Object.entries(row.diff);
}

export interface CaseMaintenanceStartPayload {
  type: CaseMaintenanceRunType;
  selection: CaseMaintenanceSelection;
  options?: Record<string, unknown>;
}

export interface CaseMaintenanceRunsParams {
  page?: number;
  per_page?: number;
  type?: CaseMaintenanceRunType;
  status?: CaseMaintenanceRunStatus;
}

/**
 * Sort keys the items endpoint accepts. Anything else is a 422, deliberately —
 * a silently ignored sort parameter would leave the reviewer looking at an
 * arbitrary order while believing it was ranked.
 *
 * `-score` puts the best matches first and the UNSCORED last, which is the
 * order the review screen wants: certain at the top, nothing-found in the
 * middle, never-searched out of the way.
 */
export type CaseMaintenanceItemSort = 'score' | '-score' | 'id' | '-id';

export interface CaseMaintenanceItemsParams {
  page?: number;
  per_page?: number;
  status?: CaseMaintenanceItemStatus;
  match_method?: CaseMatchMethod;
  /** Ordered in the database, so it holds across pages rather than sorting one
   *  page in the browser and calling it ranked. */
  sort?: CaseMaintenanceItemSort;
}

/* ── Deciding many at once ─────────────────────────────────────────────── */

/**
 * The outcome for ONE item inside a batch. A batch never fails as a whole: a
 * partial success returns 200 with entries in `failed`, so the screen can name
 * which ones did not go through instead of turning green on a half-write.
 */
export interface CaseMaintenanceDecideSuccess {
  id: number;
  status: CaseMaintenanceItemStatus;
}

export interface CaseMaintenanceDecideFailure {
  id: number;
  /** Server's words, shown to the reviewer as-is rather than reworded. */
  reason: string;
}

export interface CaseMaintenanceDecideResult {
  decision: 'confirm' | 'reject';
  requested: number;
  succeeded: CaseMaintenanceDecideSuccess[];
  failed: CaseMaintenanceDecideFailure[];
}
