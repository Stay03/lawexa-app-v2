import type {
  CaseDetail,
  CitedByFilters,
  CitedByListResponse,
  CitedByParams,
  CitedBySort,
  CitingCase,
} from '@/types/case';
import { firstCitation, formatCaseName } from '../case-name';
import { formatCaseDate } from '../case-row-model';
import { meaningfulTreatment } from '../detail/authorities';
import type { AuthorityItem } from '../detail/AuthorityList';

/**
 * cited-by/model — the pure shaping behind "Cited by": the section on the case
 * page and the panel that opens from it.
 *
 * WHY THE LIST MOVED INTO A PANEL. A leading judgment is cited by hundreds of
 * later ones (Nwadike v Ibekwe: 462, measured 5 October 2026). The case payload
 * caps `cited_by` at 50 rows, and the section used to print the ROW count as
 * its size ("Cited by · 50"), which told the reader the case had been cited 50
 * times. The section now prints the real total and shows the most-cited ten;
 * "See all" opens a panel over the page that searches, sorts, filters by court
 * and year, and pages through every one of them (owner's choice, 5 October).
 */

/** Rows the case page shows before "See all". */
export const CITED_BY_PREVIEW_COUNT = 10;

/** Rows per page in the panel: the endpoint's ceiling. */
export const CITED_BY_PAGE_SIZE = 50;

/** Year chips shown before "More years". */
export const YEAR_CHIPS_FOLDED = 6;

/**
 * How many later cases cite this one. `cited_by_count` is the real total;
 * `cited_by` is at most 50 of them. An older payload without the count falls
 * back to the rows, and the larger of the two wins so a count that lags its
 * own rows can never print fewer citations than the page shows.
 */
export function citedByTotal(detail: Pick<CaseDetail, 'cited_by' | 'cited_by_count'>): number {
  const rows = detail.cited_by?.length ?? 0;
  return Math.max(detail.cited_by_count ?? 0, rows);
}

/**
 * Whether the case page needs the panel. At or under the preview size every
 * citing case is already in the payload, so the section renders those rows
 * and asks for nothing more.
 */
export function needsFullList(total: number): boolean {
  return total > CITED_BY_PREVIEW_COUNT;
}

/** The control under the preview. */
export function seeAllLabel(total: number): string {
  return `See all ${total}`;
}

/** The URL mirror of an open panel (`?cited-by=all`). Opening pushes it, so the
 *  phone's Back closes the panel before it leaves the page. */
const PANEL_PARAM = 'cited-by';

/** The search-param write for the panel opening (`true`) or closing (`false`). */
export function panelParam(open: boolean): Record<string, string | null> {
  return { [PANEL_PARAM]: open ? 'all' : null };
}

/** Whether a URL's search string says the panel is open: what Back and
 *  Forward adopt. */
export function panelOpenIn(search: string): boolean {
  return new URLSearchParams(search).has(PANEL_PARAM);
}

/** A report citation carries its own year: "(2024) 2 NWLR …", "[1955] AC …". */
const CITATION_YEAR = /[([]\d{4}[)\]]/;

/**
 * A library case's reference line: citation · court, and the judgment year
 * only when the citation has no year of its own (owner, 6 October 2026:
 * "remove the extra year now the citation already has year"). `null` when
 * there is nothing to say. Shared by every list of library cases on the case
 * page (Cited by, its panel, Similar cases), so they cannot disagree.
 */
export function caseReference(
  rawCitation: string | null | undefined,
  court: string | null | undefined,
  judgmentDate: string | null | undefined,
): string | null {
  const citation = firstCitation(rawCitation ?? null);
  const year = citation && CITATION_YEAR.test(citation) ? null : formatCaseDate(judgmentDate ?? null, 'year');
  return [citation, court, year].filter(Boolean).join(' · ') || null;
}

/** Map one row of the paged endpoint to the case page's row grammar: the
 *  name, then the reference line (`caseReference`). */
export function citingCaseItem(row: CitingCase): AuthorityItem {
  const reference = caseReference(row.citation, row.court, row.judgment_date);
  return {
    key: `case-${row.id}`,
    // The bare title: the display title has the citation appended, and the
    // reference line already carries it.
    name: formatCaseName(row.title || row.display_title),
    nameTitle: row.display_title || row.title,
    reference: reference || null,
    href: `/cases/${row.slug}`,
    searchHref: null,
    badge: meaningfulTreatment(row.treatment),
  };
}

/**
 * Every loaded page as one list, first occurrence kept. Offset pages can shift
 * under the reader (a citation added between page 1 and page 2 pushes a row
 * across the boundary), and a repeated row would also repeat a React key.
 */
export function flattenCitingPages(
  pages: readonly Pick<CitedByListResponse, 'data'>[] | undefined,
): CitingCase[] {
  if (!pages) return [];
  const seen = new Set<number>();
  const rows: CitingCase[] = [];
  for (const page of pages) {
    for (const row of page.data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}

/** What the reader has asked the panel for. `null` is "any". */
export interface CitedByQuery {
  sort: CitedBySort;
  search: string;
  courtId: number | null;
  year: number | null;
}

/** The panel opens on the order the case page's ten were chosen by, so its
 *  first rows are the ones the reader just saw. */
export const DEFAULT_CITED_BY_QUERY: CitedByQuery = {
  sort: 'most_cited',
  search: '',
  courtId: null,
  year: null,
};

/** The request for a query. A blank search and an "any" filter are left off
 *  rather than sent empty. */
export function citedByParams(query: CitedByQuery): Omit<CitedByParams, 'page' | 'per_page'> {
  const params: Omit<CitedByParams, 'page' | 'per_page'> = { sort: query.sort };
  const search = query.search.trim();
  if (search) params.search = search;
  if (query.courtId !== null) params.court_id = query.courtId;
  if (query.year !== null) params.year = query.year;
  return params;
}

/** Whether the list shows fewer than all the citing cases. Sort does not
 *  narrow. */
export function isNarrowed(query: CitedByQuery): boolean {
  return query.search.trim() !== '' || query.courtId !== null || query.year !== null;
}

/**
 * The year chips to draw. Folded, the newest {@link YEAR_CHIPS_FOLDED}; the
 * selected year stays in view even when it is older than those, so a choice
 * never disappears behind the fold it was made from.
 */
export function visibleYears(
  years: CitedByFilters['years'],
  selected: number | null,
  expanded: boolean,
): { shown: CitedByFilters['years']; hidden: number } {
  if (expanded || years.length <= YEAR_CHIPS_FOLDED) return { shown: years, hidden: 0 };
  const head = years.slice(0, YEAR_CHIPS_FOLDED);
  const pick = years.find((entry) => entry.year === selected);
  const shown = pick && !head.includes(pick) ? [...head, pick] : head;
  return { shown, hidden: years.length - shown.length };
}

/** The line under the panel's title. */
export function citedBySummary(matches: number, total: number, narrowed: boolean): string {
  if (narrowed) {
    return matches === 1
      ? `1 of ${total} citing cases matches`
      : `${matches} of ${total} citing cases match`;
  }
  return total === 1 ? '1 later judgment cites this case' : `${total} later judgments cite this case`;
}
