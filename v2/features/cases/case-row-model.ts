import type { Case } from '@/types/case';
import type { TrendingCaseDetailItem } from '@/types/trending';
import { firstCitation, formatCaseName } from './case-name';

/** A renderable ISO alpha-2 flag code from whichever field carries one. */
export function toAlpha2(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (candidate && candidate.length === 2) return candidate.toUpperCase();
  }
  return null;
}

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
 *
 * NAME AND CITATION ARE SPLIT (owner review, July 29). The old rows fused them
 * into one all-caps wall ("WILSON V. C.O.P, (2026) JELR 115357 (CA); …"), which
 * made the one thing worth scanning — the case name — the hardest thing to
 * find. The row title is now the readable name alone (`formatCaseName`, with
 * the source string kept in `rawTitle` for the hover), and the FIRST citation
 * moves into the quiet meta line where a lawyer's eye expects it.
 */
export interface CaseRowModel {
  id: number;
  slug: string;
  /** The case NAME, mixed-cased — no citation. */
  title: string;
  /** The source heading, verbatim, for the `title` attribute. */
  rawTitle: string;
  /** The first report citation, or null. */
  citation: string | null;
  court: string | null;
  /** ISO alpha-2 code for the flag, or null when the payload has none — the
   *  flag replaced the "NG" text mark (owner, July 29: "why can't I see the
   *  flag in the list"). */
  countryCode: string | null;
  /** The country's display name — the flag's accessible label. */
  countryName: string | null;
  judgmentDate: string | null;
  /** The holding: the one line worth reading before opening the case. */
  holding: string | null;
  tags: string[];
  isBookmarked: boolean;
  /**
   * The case page's own header facts, as far as the list knows them, so the
   * frame a tap paints draws the header the page will (`CaseHeader.tsx`). The
   * citation is the whole field, as the page prints it. A fact the list did
   * not send is null (or false), which the frame reads as "not known here" and
   * leaves out, as the page does when the case has none.
   */
  fullCitation: string | null;
  topic: string | null;
  isVerified: boolean;
  bookmarksCount: number | null;
  hasFullReport: boolean;
  outcome: string | null;
  suitNo: string | null;
}

export function browseRow(item: Case): CaseRowModel {
  const raw = item.display_title || item.title;
  return {
    id: item.id,
    slug: item.slug,
    title: formatCaseName(raw),
    rawTitle: raw,
    citation: firstCitation(item.citation),
    court: item.court?.name ?? null,
    countryCode: toAlpha2(item.country?.code, item.country?.abbreviation),
    countryName: item.country?.name ?? null,
    judgmentDate: item.judgment_date,
    holding: item.principles?.trim() || item.excerpt?.trim() || null,
    tags: item.tags ?? [],
    isBookmarked: item.is_bookmarked,
    fullCitation: item.citation?.trim() || null,
    topic: item.topic?.trim() || null,
    isVerified: item.is_verified === true,
    bookmarksCount: item.bookmarks_count,
    hasFullReport: item.has_full_report === true,
    outcome: item.outcome ?? null,
    suitNo: item.suit_no?.trim() || null,
  };
}

export function trendingRow(item: TrendingCaseDetailItem): CaseRowModel {
  const raw = item.display_title || item.title;
  return {
    id: item.id,
    slug: item.slug,
    title: formatCaseName(raw),
    rawTitle: raw,
    citation: firstCitation(item.citation),
    court: item.court,
    countryCode: toAlpha2(item.country?.code),
    countryName: item.country?.name ?? null,
    judgmentDate: item.judgment_date,
    holding: item.principles?.trim() || null,
    tags: item.tags ?? [],
    isBookmarked: item.is_bookmarked,
    fullCitation: item.citation?.trim() || null,
    topic: item.topic?.trim() || null,
    isVerified: item.is_verified === true,
    bookmarksCount: item.bookmarks_count ?? null,
    hasFullReport: item.has_full_report === true,
    outcome: item.outcome ?? null,
    suitNo: item.suit_no?.trim() || null,
  };
}

/**
 * Deterministic date formatting for a row. `Date.parse` is pure, so it is safe
 * in render (unlike a zero-argument `new Date()`), and an unparseable value
 * yields '' rather than "Invalid Date".
 *
 * FORMATTED IN UTC, always: judgment dates are date-only strings
 * ("2005-12-22"), which `Date.parse` reads as UTC midnight — rendering that
 * instant in viewer-local time would show the PREVIOUS day to any reader west
 * of UTC. A legal date must not depend on the reader's timezone.
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
    timeZone: 'UTC',
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
