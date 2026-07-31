import type { Statute, StatuteCountriesData, StatuteStatus } from '@/types/statute';

/**
 * The statute list's row model + the small pure helpers every statute surface
 * shares (status tokens, dates, country resolution). Mirrors
 * `v2/features/cases/case-row-model.ts`: normalise at the edge, render through
 * ONE row component.
 *
 * WHAT CHANGED FROM v1's `StatuteCard` (the keep/drop study, A0):
 *  - the 20px title + 16px chip wall becomes the cases-row grammar — name at
 *    full weight, ONE quiet meta line;
 *  - the double truncation (200-char JS slice + 2-line clamp) becomes one CSS
 *    clamp, so `preview` here is the raw text;
 *  - the country mark becomes the shared flag artwork, not a "GH" text chip.
 */

export interface StatuteRowModel {
  id: number;
  slug: string;
  title: string;
  /** The statute's short designation ("Act 459", "Cap C23") — meta material. */
  shortTitle: string | null;
  /** ISO alpha-2 code for the flag, or null. */
  countryCode: string | null;
  /** The country's display name — the flag's accessible label. */
  countryName: string | null;
  year: number;
  status: StatuteStatus;
  statusLabel: string;
  /** One line a lawyer reads before opening: what the Act is for. */
  preview: string | null;
  isBookmarked: boolean;
}

export function statuteRow(item: Statute): StatuteRowModel {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    shortTitle:
      item.short_title && item.short_title !== item.title ? item.short_title : null,
    countryCode: toAlpha2(item.country?.code, item.country?.abbreviation),
    countryName: item.country?.name ?? null,
    year: item.year,
    status: item.status,
    statusLabel: item.status_label || statusFallbackLabel(item.status),
    preview:
      item.description?.trim() ||
      item.long_title?.trim() ||
      item.preamble?.trim() ||
      null,
    isBookmarked: item.is_bookmarked,
  };
}

/** A renderable ISO alpha-2 flag code from whichever field carries one. */
export function toAlpha2(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (candidate && candidate.length === 2) return candidate.toUpperCase();
  }
  return null;
}

/* ── Status ──────────────────────────────────────────────────────────────── */

/**
 * The status mark's tone. NEVER colour-only: every rendering pairs the tone
 * with the label (dot + word in a row, tinted badge with the word on the
 * reader). `active` is the unremarkable default and stays muted; `amended`
 * and `repealed` are the states a lawyer must not miss.
 */
export type StatuteStatusTone = 'neutral' | 'caution' | 'negative';

export function statuteStatusTone(status: StatuteStatus): StatuteStatusTone {
  switch (status) {
    case 'repealed':
      return 'negative';
    case 'amended':
      return 'caution';
    default:
      return 'neutral';
  }
}

function statusFallbackLabel(status: StatuteStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/* ── Dates ───────────────────────────────────────────────────────────────── */

/**
 * Deterministic date formatting. `Date.parse` is pure, so it is safe in render
 * (unlike a zero-argument `new Date()`), and an unparseable value yields ''
 * rather than "Invalid Date".
 *
 * `timeZone: 'UTC'` is LOAD-BEARING: the API ships date-only strings
 * ("1993-07-06"), which `Date.parse` reads as UTC midnight — formatting that
 * instant in viewer-local time shifts the LEGAL date a day west of UTC
 * (New York would print "5 July 1993"). Formatting in UTC renders the date
 * the statute actually carries, everywhere on Earth.
 */
export function formatStatuteDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/* ── Routes ──────────────────────────────────────────────────────────────── */

/**
 * The statute route. DELIBERATELY without the cases list's `?q=` attribution
 * parameter: `GET /statutes/{slug}` takes no search-attribution query (v1
 * appended `?q=` to the URL and then discarded it unread), and a parameter
 * nothing consumes is noise on a shareable link.
 */
export function statuteHref(slug: string): string {
  return `/statutes/${slug}`;
}

/* ── Country tabs ────────────────────────────────────────────────────────── */

/**
 * Resolve the URL's country SLUG to the numeric id the API filters by.
 *
 * The slug is what belongs in a shareable URL (`?country=ghana`, not
 * `?country=2` — the study's call), but `GET /statutes` takes the numeric id,
 * so both the client browser and the RSC prefetch resolve through this ONE
 * function against the same facets source chain (live endpoint → seed). An
 * unknown slug resolves to `undefined`, which both sides treat as "All".
 */
export function resolveCountryId(
  facets: StatuteCountriesData | undefined,
  countrySlug: string,
): number | undefined {
  if (!countrySlug || !facets) return undefined;
  return facets.countries.find((facet) => facet.country.slug === countrySlug)
    ?.country.id;
}
