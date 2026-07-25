import type { Case } from '@/types/case';
import type { TrendingCaseDetailItem } from '@/types/trending';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';

/**
 * ONE row model, two sources.
 *
 * `/cases` and `/trending/cases` return DIFFERENT shapes for the same thing: the
 * browse list nests `court` and `country` as objects, the trending list flattens
 * `court` to a string and gives `country` only a name and a code. v1 answered
 * that with two card components that looked alike and drifted (different meta
 * order, different truncation, one with a bookmark control and one without).
 *
 * v2 normalises at the edge instead. Both endpoints map into this model, ONE row
 * component renders it, and the two views of the case library are provably the
 * same design — which is the whole reason they can sit behind a pair of tabs.
 */
export interface CaseRowModel {
  id: number;
  slug: string;
  /** The full heading — display title plus its citation, resolved once. */
  title: string;
  court: string | null;
  /** A short country mark (`NG`, `GH`) — the abbreviation, else the code. */
  countryMark: string | null;
  judgmentDate: string | null;
  /** The holding: the one line worth reading before opening the case. */
  holding: string | null;
  tags: string[];
  viewsCount: number;
  isBookmarked: boolean;
}

export function browseRow(item: Case): CaseRowModel {
  return {
    id: item.id,
    slug: item.slug,
    title: getCaseDisplayTitle(item),
    court: item.court?.name ?? null,
    countryMark: item.country?.abbreviation || item.country?.code || null,
    judgmentDate: item.judgment_date,
    holding: item.principles?.trim() || item.excerpt?.trim() || null,
    tags: item.tags ?? [],
    viewsCount: item.views_count,
    isBookmarked: item.is_bookmarked,
  };
}

export function trendingRow(item: TrendingCaseDetailItem): CaseRowModel {
  return {
    id: item.id,
    slug: item.slug,
    title: getCaseDisplayTitle(item),
    court: item.court,
    // The trending payload has no `abbreviation`, only `code` — so the mark is
    // slightly less specific here. That is the API's shape, not a rendering
    // choice, and it is better than showing a full country name in a row that
    // reserves two characters for it.
    countryMark: item.country?.code ?? null,
    judgmentDate: item.judgment_date,
    holding: item.principles?.trim() || null,
    tags: item.tags ?? [],
    viewsCount: item.views_count,
    isBookmarked: item.is_bookmarked,
  };
}

/**
 * Deterministic date formatting for a row. `Date.parse` is pure, so it is safe
 * in render (unlike a zero-argument `new Date()`), and an unparseable value
 * yields '' rather than "Invalid Date".
 */
export function formatCaseDate(
  iso: string | null,
  style: 'short' | 'long' | 'year' = 'short',
): string {
  if (!iso) return '';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  if (style === 'year') return String(date.getUTCFullYear());
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  });
}

/**
 * The case route, carrying the search that led here.
 *
 * `?q=` is analytics: the backend attributes a read to the search that produced
 * it. It is only appended when a search is actually active, so a case opened by
 * browsing produces a clean, shareable URL.
 */
export function caseHref(slug: string, searchQuery?: string): string {
  const q = searchQuery?.trim();
  return q ? `/cases/${slug}?q=${encodeURIComponent(q)}` : `/cases/${slug}`;
}
