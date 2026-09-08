// Argument-review screen model — session overlay, rail derivation, grouping.
// Pure functions only, shared by the page, the case rail and the review pane.

import type {
  ArgumentCaseRef,
  ArgumentSide,
  CaseArgumentReviewItem,
} from '@/types/admin-case-arguments';

/******************************************************************************
                            Review session state
******************************************************************************/

/**
 * What this session has done to a row, layered over the server data instead of
 * refetching it. The queue filters on unreviewed rows, so any refetch after a
 * decision would drop the row the reviewer just acted on and the list would
 * shift under their eye. `failed` replaces a decision when the server refuses,
 * carrying the reason back onto the row and making it actionable again.
 */
export type RowSessionState =
  | { kind: 'approved' }
  | { kind: 'rejected' }
  | { kind: 'failed'; action: 'approve' | 'reject'; message: string };

export type ReviewSession = ReadonlyMap<number, RowSessionState>;

/**
 * A row still needing a decision: not decided server-side, not decided here.
 *
 * `reviewed` is true for a THROWN-OUT row as well as an approved one, so this
 * cannot test `!item.reviewed` alone without treating every rejection as
 * outstanding work.
 */
export function isActionable(
  item: CaseArgumentReviewItem,
  session: ReviewSession
): boolean {
  if (item.reviewed) return false;
  const state = session.get(item.id);
  return state === undefined || state.kind === 'failed';
}

/******************************************************************************
                            Case rail derivation
******************************************************************************/

export interface RailCaseEntry {
  caseRef: ArgumentCaseRef;
  /** Unreviewed argument ids seen for this case in the loaded queue prefix. */
  ids: number[];
  /**
   * False only for the last entry while more queue pages exist: that case may
   * straddle the page boundary, so its count is a floor rather than a total.
   * The rail renders those with a trailing "+" instead of claiming a number it
   * has not seen.
   */
  countKnown: boolean;
}

/**
 * Group the loaded queue prefix into cases, in first-appearance order.
 *
 * There is no endpoint listing cases with pending arguments — `summary` gives
 * a count and not a list — so the rail is derived from the queue itself and
 * extended page by page as the reviewer moves down it. Rows with no case are
 * skipped: case-at-a-time review cannot reach them and a dead rail entry would
 * only pretend otherwise.
 */
export function groupQueueByCase(
  rows: CaseArgumentReviewItem[],
  hasMorePages: boolean
): RailCaseEntry[] {
  const entries: RailCaseEntry[] = [];
  const byCase = new Map<number, RailCaseEntry>();
  for (const row of rows) {
    if (!row.case) continue;
    let entry = byCase.get(row.case.id);
    if (!entry) {
      entry = { caseRef: row.case, ids: [], countKnown: true };
      byCase.set(row.case.id, entry);
      entries.push(entry);
    }
    entry.ids.push(row.id);
  }
  if (hasMorePages && entries.length > 0) {
    entries[entries.length - 1].countKnown = false;
  }
  return entries;
}

/** How many of the entry's seen rows this session has not yet dealt with. */
export function remainingInEntry(
  entry: RailCaseEntry,
  session: ReviewSession
): number {
  let remaining = 0;
  for (const id of entry.ids) {
    const state = session.get(id);
    if (state === undefined || state.kind === 'failed') remaining += 1;
  }
  return remaining;
}

/** Split ids into server-sized batches. */
export function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

/******************************************************************************
                       Grouping within one case
******************************************************************************/

export interface CounselGroup {
  /** The name to print above the submissions. Null when none was extracted. */
  counselName: string | null;
  rows: CaseArgumentReviewItem[];
}

export interface SideGroup {
  side: ArgumentSide | null;
  /** "For the appellant", or "Side not recorded" when the extraction had none. */
  heading: string;
  counsel: CounselGroup[];
  rows: CaseArgumentReviewItem[];
}

/** How a side reads above a list of submissions. */
export function sideHeading(side: ArgumentSide | null): string {
  if (side === 'appellant') return 'For the appellant';
  if (side === 'respondent') return 'For the respondent';
  return 'Side not recorded';
}

/**
 * A row's counsel, preferring the matched record over the printed line.
 *
 * `counsel_name` already carries the server's choice between the two, but a
 * row can have a resolved `counsel` and a null `counsel_name`, so read both
 * rather than trusting one. An empty string is not a name.
 */
export function counselNameOf(row: CaseArgumentReviewItem): string | null {
  const name = row.counsel?.name ?? row.counsel_name ?? row.counsel_name_raw;
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Group one case's arguments the way they were argued: by side, then by the
 * counsel who made them, both in first-appearance order within `sort_order`.
 *
 * Appellant before respondent when both are present, because that is the order
 * a judgment reports them and the order a reviewer reads them in. A row with no
 * side sorts last rather than being hidden — an unrecorded side is a thing the
 * reviewer should see, not a reason to drop the submission.
 */
export function groupCaseArguments(
  rows: CaseArgumentReviewItem[]
): SideGroup[] {
  const ordered = [...rows].sort((a, b) => a.sort_order - b.sort_order);

  const sides: SideGroup[] = [];
  const bySide = new Map<string, SideGroup>();
  for (const row of ordered) {
    const key = row.side ?? '';
    let group = bySide.get(key);
    if (!group) {
      group = {
        side: row.side,
        heading: sideHeading(row.side),
        counsel: [],
        rows: [],
      };
      bySide.set(key, group);
      sides.push(group);
    }
    group.rows.push(row);

    const name = counselNameOf(row);
    const last = group.counsel[group.counsel.length - 1];
    if (last && last.counselName === name) last.rows.push(row);
    else group.counsel.push({ counselName: name, rows: [row] });
  }

  const rank = (side: ArgumentSide | null): number =>
    side === 'appellant' ? 0 : side === 'respondent' ? 1 : 2;
  return sides.sort((a, b) => rank(a.side) - rank(b.side));
}
