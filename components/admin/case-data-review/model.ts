import type { CaseProblemKey, FixState } from '@/types/admin-case-data-review';

/**
 * Display model for the case data review screen.
 *
 * WHAT IS NOT HERE, DELIBERATELY: the problem list, its order, and its labels.
 * All three come from the server's summary, because the API defines each
 * problem once (its finder, its count, its per-row flag) and the whole point of
 * that arrangement is that the menu and the table cannot disagree about how
 * much work exists. Restating the list here would put a second copy in the
 * frontend, which is the same defect one layer up. Only things the server does
 * not send live in this file.
 */

/** One line saying what a problem MEANS, which a count alone never says. */
export const PROBLEM_HINTS: Partial<Record<CaseProblemKey, string>> = {
  no_full_report: 'No judgment text stored at all',
  no_court: 'No court attached to the case',
  unidentified_court: 'Attached to a placeholder court we cannot name',
  no_judges: 'No coram recorded',
  no_judgment_date: 'No date recorded',
  no_citation: 'No citation, stored or generated',
  lawexa_elr_branding: 'Still carries the retired LAWEXA ELR branding',
  citation_in_title: 'The citation is repeated inside the title',
  year_mismatch: 'The stored year contradicts the citation',
};

/** All three describe the corrected title and citation, nothing wider. */
export const FIX_STATE_LABEL: Record<FixState, string> = {
  proposed: 'Correction ready',
  already_correct: 'Already correct',
  blocked: 'No correction can be computed',
};

/**
 * Tone carries meaning here, not decoration. `blocked` is the state that stops
 * a person acting, so it is the only one that takes the alarm colour.
 */
export const FIX_STATE_TONE: Record<FixState, 'proposed' | 'quiet' | 'blocked'> = {
  proposed: 'proposed',
  already_correct: 'quiet',
  blocked: 'blocked',
};

/** A date as a reader reads it, or a dash when there is nothing to read. */
export function formatDate(value: string | null): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Which fields differ across the cases in a duplicate group.
 *
 * This is what makes a group readable: with two near-identical rows side by
 * side, the eye needs telling where to look. Values are compared as they are
 * displayed, so a null and an empty string count as the same nothing.
 */
export function differingFields<T extends Record<string, unknown>>(
  rows: T[],
  fields: (keyof T)[]
): Set<keyof T> {
  const differing = new Set<keyof T>();
  if (rows.length < 2) return differing;
  for (const field of fields) {
    const first = String(rows[0][field] ?? '');
    if (rows.some((row) => String(row[field] ?? '') !== first)) {
      differing.add(field);
    }
  }
  return differing;
}
