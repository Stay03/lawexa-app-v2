import type {
  CaseProblemKey,
  CaseReviewRow,
  DuplicateGroup,
  FixState,
} from '@/types/admin-case-data-review';

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

/******************************************************************************
                          Verified source documents
******************************************************************************/

/** The providers behind a copy, deduplicated, in the order the server sent. */
export function sourceProviders(row: CaseReviewRow): string[] {
  return [...new Set((row.sources ?? []).map((doc) => doc.source).filter(Boolean))];
}

/**
 * A copy is verified when a named provider supplied the judgment behind it.
 *
 * The server's own flag wins where it is present. `sources` is the fallback for
 * a payload that predates the flag, and the two cannot disagree in a way that
 * matters: a row with source documents is verified whichever field says so.
 */
export function isVerified(row: CaseReviewRow): boolean {
  return row.is_verified ?? (row.sources ?? []).length > 0;
}

/**
 * What the source documents say about a whole group, which is more than any one
 * copy says on its own.
 *
 * `same_document` is the strongest statement this screen can make: one document
 * imported twice, proven by a shared hash rather than inferred from matching
 * fields. `different_reports` is the one that STOPS a merge — both copies are
 * verified but the providers address them as different reports, so they are
 * probably two judgments that happen to share a name.
 */
export type GroupSourceVerdict =
  | { kind: 'same_document'; provider: string }
  | { kind: 'different_reports'; externalIds: string[] }
  | { kind: 'one_verified'; caseId: number; provider: string }
  | { kind: 'all_verified' }
  | { kind: 'none' };

export function groupSourceVerdict(group: DuplicateGroup): GroupSourceVerdict {
  const verified = group.cases.filter(isVerified);
  if (verified.length === 0) return { kind: 'none' };

  if (verified.length === 1 && group.cases.length > 1) {
    const only = verified[0];
    return {
      kind: 'one_verified',
      caseId: only.id,
      provider: sourceProviders(only)[0] ?? 'a source',
    };
  }

  // A hash shared by EVERY copy, not merely by two of a group of three: a
  // partial match would name the group after a fact true of only part of it.
  const hashSets = verified.map(
    (row) => new Set(row.sources.map((doc) => doc.content_hash).filter(Boolean))
  );
  const sharedHash = [...hashSets[0]].find((hash) =>
    hashSets.every((set) => set.has(hash))
  );
  if (sharedHash) {
    return { kind: 'same_document', provider: sourceProviders(verified[0])[0] ?? 'a source' };
  }

  /**
   * Different addresses only mean different reports WITHIN ONE PROVIDER.
   *
   * Each provider numbers reports its own way — nwlr writes `1141_1_597`,
   * judy.legal a plain number, akn-uri a path — so two copies held by different
   * providers ALWAYS have different external ids, and reading that as "two
   * different judgments" would flag every cross-provider pair as a case to hold
   * back. That is a false alarm that stops a correct merge, which is the
   * expensive direction to be wrong in here.
   *
   * So compare only the providers that appear on every copy. Where the copies
   * share no provider at all there is nothing to compare and the verdict falls
   * through to `all_verified`, which claims nothing.
   */
  const byProvider = verified.map((row) => {
    const map = new Map<string, Set<string>>();
    for (const doc of row.sources) {
      if (!doc.external_id) continue;
      const ids = map.get(doc.source) ?? new Set<string>();
      ids.add(doc.external_id);
      map.set(doc.source, ids);
    }
    return map;
  });
  const sharedProviders = [...byProvider[0].keys()].filter((provider) =>
    byProvider.every((map) => map.has(provider))
  );
  const disagreeing = sharedProviders.filter((provider) => {
    const seen = byProvider.map((map) => [...(map.get(provider) ?? [])].sort().join('|'));
    return new Set(seen).size === seen.length;
  });
  if (
    verified.length === group.cases.length &&
    sharedProviders.length > 0 &&
    disagreeing.length === sharedProviders.length
  ) {
    const provider = disagreeing[0];
    return {
      kind: 'different_reports',
      externalIds: byProvider.map((map) => [...(map.get(provider) ?? [])].join(', ')),
    };
  }

  return { kind: 'all_verified' };
}
