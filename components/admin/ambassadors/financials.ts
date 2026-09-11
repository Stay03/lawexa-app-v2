import type {
  AmbassadorApplication,
  AmbassadorFinancialRow,
  MoneyByCurrency,
} from '@/types/ambassador';

/**
 * The list behind the ambassador financials table: joining, searching,
 * filtering and sorting.
 *
 * ── ALL OF IT HAPPENS IN THE BROWSER, AND THAT IS NOT A SHORTCUT ───────────
 * `/admin/ambassadors/financials` takes NO parameters and answers with every
 * ambassador and the totals in one response — no page, no `search`, no `sort`
 * (measured 2026-09-09: 113 rows). So each control narrows the array that is
 * already in memory and none of them refetches. There is nothing here to move
 * to the server later without the server growing parameters first.
 *
 * ── AND NOTHING HERE ADDS UP MONEY ─────────────────────────────────────────
 * `revenue` is a currency map. Sorting by it sorts WITHIN one named currency
 * and never across two — see `compareAmounts` below.
 *
 * ── THE SEARCH, FACET AND DATE-WINDOW PIECES ARE SHARED ────────────────────
 * The applications list (`./applications`) filters with `haystackOf`,
 * `searchTerms`, `windowCutoff` and `countFacet` from this file, so the two
 * ambassador lists search and count the same way. Anything that knows about
 * money or referrals stays typed to `FinancialsRow`.
 */

/**
 * A financials row with the three facts the financials endpoint does not carry.
 *
 * University, level and country live on the APPLICATION, joined on
 * `application_uuid` → application `uuid`. Measured 2026-09-09: all 113 rows
 * match an application and all three fields are set on every one. They are
 * still typed nullable because the API types them nullable and because
 * `application_uuid` itself can be null once an application is removed — a row
 * that loses its application must still appear, with nothing filled in.
 */
export interface FinancialsRow extends AmbassadorFinancialRow {
  university: string | null;
  level: string | null;
  country: string | null;
  /** Everything the search box matches, lowercased once at join time so a
   *  keystroke does not re-lowercase 113 rows × 6 fields. */
  haystack: string;
}

export function joinApplications(
  rows: AmbassadorFinancialRow[],
  applications: AmbassadorApplication[]
): FinancialsRow[] {
  const byUuid = new Map(applications.map((application) => [application.uuid, application]));

  return rows.map((row) => {
    const application = row.application_uuid ? byUuid.get(row.application_uuid) : undefined;
    const university = application?.university ?? null;
    const level = application?.level ?? null;
    const country = application?.country ?? null;

    return {
      ...row,
      university,
      level,
      country,
      haystack: haystackOf([row.name, row.email, row.code, university, level, country]),
    };
  });
}

/**
 * The searchable fields of a row as one lowercased string, empty fields left
 * out. Built once when the rows load, so a keystroke only runs `includes` over
 * it. Shared with the applications list.
 */
export function haystackOf(parts: (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}

/* ── Filters ──────────────────────────────────────────────────────────────── */

export const DATE_WINDOWS = ['all', '7d', '30d'] as const;
export type DateWindow = (typeof DATE_WINDOWS)[number];

/**
 * What the date filter is allowed to say.
 *
 * A row carries `last_referral_at` and nothing else dated — there is no
 * per-day history on it and no endpoint parameter that would narrow the counts
 * or the money to a period. So the option names the ONE thing it can actually
 * test. "Signed up in the last 7 days" would be a different question and this
 * screen cannot answer it.
 */
export const DATE_WINDOW_LABELS: Record<DateWindow, string> = {
  all: 'All time',
  '7d': 'Last referral in the last 7 days',
  '30d': 'Last referral in the last 30 days',
};

const DATE_WINDOW_DAYS: Record<DateWindow, number | null> = {
  all: null,
  '7d': 7,
  '30d': 30,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * The earliest moment a date window lets through, or `null` for all time.
 *
 * `now` is passed in rather than read here: React Compiler rejects a clock read
 * during render, and a cutoff that moves on every frame would make the memo
 * around the caller impossible to reuse.
 */
export function windowCutoff(dateWindow: DateWindow, now: number): number | null {
  const days = DATE_WINDOW_DAYS[dateWindow];
  return days === null ? null : now - days * DAY_IN_MS;
}

/** The search box's text as lowercase terms. A row matches when its haystack
 *  holds every term, in any order. */
export function searchTerms(search: string): string[] {
  return search.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** The five controls both ambassador lists have: a search, three facets and a
 *  date window. The applications list adds a status to them. */
export interface AmbassadorListFilters {
  search: string;
  university: string | null;
  level: string | null;
  country: string | null;
  window: DateWindow;
}

export type FinancialsFilters = AmbassadorListFilters;

/** Nothing selected, which shows every ambassador — including the ones who
 *  referred nobody. */
export const NO_FILTERS: FinancialsFilters = {
  search: '',
  university: null,
  level: null,
  country: null,
  window: 'all',
};

export function isFiltered(filters: AmbassadorListFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.university !== null ||
    filters.level !== null ||
    filters.country !== null ||
    filters.window !== 'all'
  );
}

export const FACET_KEYS = ['university', 'level', 'country'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/**
 * Rows that pass every filter.
 *
 * `now` is passed in rather than read here, for the reason `windowCutoff`
 * gives.
 *
 * `skip` leaves one facet out, which is what makes the facet lists show what is
 * still reachable rather than what would empty the table.
 */
export function filterRows(
  rows: FinancialsRow[],
  filters: FinancialsFilters,
  now: number,
  skip?: FacetKey
): FinancialsRow[] {
  const terms = searchTerms(filters.search);
  const cutoff = windowCutoff(filters.window, now);

  return rows.filter((row) => {
    for (const key of FACET_KEYS) {
      if (key === skip) continue;
      const wanted = filters[key];
      if (wanted !== null && row[key] !== wanted) return false;
    }

    if (cutoff !== null) {
      // No last referral is not "outside the window", it is no date at all —
      // but the ambassador cannot have referred somebody inside it either.
      if (!row.last_referral_at) return false;
      const at = Date.parse(row.last_referral_at);
      if (Number.isNaN(at) || at < cutoff) return false;
    }

    return terms.every((term) => row.haystack.includes(term));
  });
}

export interface FacetOption {
  value: string;
  count: number;
}

/**
 * One facet's choices, counted over rows the caller has already narrowed by
 * the OTHER filters. Shared with the applications list.
 *
 * A value that no longer matches anything drops out, so picking a country and
 * then a university cannot land on an empty table. The value that is currently
 * selected always stays in the list, even at zero, because a filter you cannot
 * see is a filter you cannot undo.
 */
export function countFacet<Row>(
  rows: Row[],
  valueOf: (row: Row) => string | null,
  selected: string | null
): FacetOption[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = valueOf(row);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  if (selected !== null && !counts.has(selected)) counts.set(selected, 0);

  return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) =>
    a.value.localeCompare(b.value, undefined, { numeric: true })
  );
}

/** The choices for one financials facet, counted over the rows the OTHER
 *  filters leave. */
export function facetOptions(
  rows: FinancialsRow[],
  filters: FinancialsFilters,
  key: FacetKey,
  now: number
): FacetOption[] {
  return countFacet(filterRows(rows, filters, now, key), (row) => row[key], filters[key]);
}

/* ── Sorting ──────────────────────────────────────────────────────────────── */

export type SortColumn = 'referred_count' | 'paid_count' | 'gifted_messages' | 'revenue';

export interface SortState {
  column: SortColumn;
  /** The currency being ranked, and only for `revenue`. Two currencies are two
   *  separate orders; there is no order over both of them. */
  currency: string | null;
  direction: 'asc' | 'desc';
}

/**
 * Ranks two decimal amount strings WITHOUT parsing either into a number.
 *
 * `money.ts` keeps amounts as the exact strings the server summed, and float
 * parsing would throw that exactness away for a comparison that does not need
 * it: the whole parts are compared by length and then character by character,
 * the fractions are padded to the same width and compared the same way. No
 * value produced here is ever displayed.
 *
 * A negative amount was not seen in the 113 rows on 2026-09-09, so the sign is
 * handled rather than assumed away.
 */
export function compareAmounts(a: string, b: string): number {
  const aNegative = a.startsWith('-');
  const bNegative = b.startsWith('-');
  if (aNegative !== bNegative) return aNegative ? -1 : 1;

  const sign = aNegative ? -1 : 1;
  const [aWhole = '', aFraction = ''] = (aNegative ? a.slice(1) : a).split('.');
  const [bWhole = '', bFraction = ''] = (bNegative ? b.slice(1) : b).split('.');

  const aDigits = aWhole.replace(/^0+(?=\d)/, '');
  const bDigits = bWhole.replace(/^0+(?=\d)/, '');
  if (aDigits.length !== bDigits.length) return sign * (aDigits.length - bDigits.length);
  if (aDigits !== bDigits) return sign * (aDigits < bDigits ? -1 : 1);

  const width = Math.max(aFraction.length, bFraction.length);
  const aPadded = aFraction.padEnd(width, '0');
  const bPadded = bFraction.padEnd(width, '0');
  if (aPadded === bPadded) return 0;
  return sign * (aPadded < bPadded ? -1 : 1);
}

/** Every currency anywhere in the loaded rows, in the order `moneyLines` prints
 *  them: naira first, then the rest alphabetically. */
export function currenciesIn(rows: { revenue: MoneyByCurrency }[]): string[] {
  const codes = new Set<string>();
  for (const row of rows) {
    for (const code of Object.keys(row.revenue)) codes.add(code);
  }
  return Array.from(codes).sort((a, b) =>
    a === 'NGN' ? -1 : b === 'NGN' ? 1 : a.localeCompare(b)
  );
}

/**
 * Sorted rows, or the order they arrived in when nothing is selected.
 *
 * `unusual_activity` is not a sort key here and must not become one. It flags
 * more than 20 signups in a day, which a lecture-hall demo trips exactly as
 * somebody farming would, so ranking the table by it would be an accusation
 * with extra steps.
 *
 * Sorting by `revenue` ranks one named currency. A row holding no amount in
 * that currency sorts as the bottom of it — that is the absence of money in
 * that currency, not a converted zero, and nothing about the row's other
 * currencies is touched.
 */
export function sortRows(rows: FinancialsRow[], sort: SortState | null): FinancialsRow[] {
  if (sort === null) return rows;

  const factor = sort.direction === 'asc' ? 1 : -1;
  const currency = sort.currency;

  return [...rows].sort((a, b) => {
    if (sort.column === 'revenue' && currency !== null) {
      const aAmount = a.revenue?.[currency];
      const bAmount = b.revenue?.[currency];
      if (aAmount === undefined && bAmount === undefined) return 0;
      // Absent is the bottom of THIS currency's order, so it sinks under a
      // descending sort and leads an ascending one. `factor` is applied to it
      // exactly as it is to a comparison, which is what keeps the two
      // directions each other's reverse.
      if (aAmount === undefined) return -factor;
      if (bAmount === undefined) return factor;
      return factor * compareAmounts(aAmount, bAmount);
    }

    if (sort.column === 'revenue') return 0;
    return factor * (a[sort.column] - b[sort.column]);
  });
}
