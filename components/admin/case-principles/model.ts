// Principle-review screen model — session overlay + rail derivation.
// Pure functions only, shared by the page, the case rail and the review pane.

import type {
  CasePrincipleReviewItem,
  PrincipleCaseRef,
} from '@/types/admin-case-principles';

/******************************************************************************
                            Review session state
******************************************************************************/

/**
 * What this session has done to a row, layered over the server data instead of
 * refetching it. The overlay exists because the source queries filter on
 * `reviewed=0`: any refetch after an approval would silently drop the row the
 * reviewer just acted on, and rows must never move or vanish under the
 * reader's eye. `approved`/`rejected` are set the moment the reviewer acts;
 * `failed` replaces them if the server refuses, carrying the reason back onto
 * the row and making it actionable again.
 */
export type RowSessionState =
  | { kind: 'approved' }
  | { kind: 'rejected' }
  | { kind: 'failed'; action: 'approve' | 'reject'; message: string };

export type ReviewSession = ReadonlyMap<number, RowSessionState>;

/** A row still needing action: not reviewed server-side, not done this session. */
export function isActionable(
  item: CasePrincipleReviewItem,
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
  caseRef: PrincipleCaseRef;
  /** Unreviewed principle ids seen for this case in the loaded queue prefix. */
  ids: number[];
  /**
   * False only for the last entry while more queue pages exist: that case may
   * straddle the page boundary, so its count is a floor, not a total. The rail
   * renders those counts with a trailing "+" rather than claiming a number it
   * has not actually seen.
   */
  countKnown: boolean;
}

/**
 * Group the loaded queue prefix into cases, in first-appearance order. There
 * is no endpoint listing cases with pending principles — the rail is derived
 * from the queue itself, extended page by page as the reviewer moves down it.
 * Rows with no case are skipped: they cannot be reached through case-at-a-time
 * review, and a dead rail entry would only pretend otherwise.
 */
export function groupQueueByCase(
  rows: CasePrincipleReviewItem[],
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

/** Split ids into server-sized batches (bulk-approve accepts at most 100). */
export function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}
