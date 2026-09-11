import type { AdminConversationsPagination } from '@/types/admin';
import type { AmbassadorApplication, AmbassadorStatus } from '@/types/ambassador';
import type { SortDirection } from './SortButton';
import {
  countFacet,
  DATE_WINDOWS,
  FACET_KEYS,
  haystackOf,
  isFiltered,
  searchTerms,
  windowCutoff,
  type AmbassadorListFilters,
  type DateWindow,
  type FacetKey,
  type FacetOption,
} from './financials';

/**
 * The list behind the ambassador applications table: the view read from the
 * URL, then the search, filters, sort and paging applied to the rows.
 *
 * All of it runs on rows already in the browser. The list endpoint filters on
 * `status` and on nothing else, so the page loads every application once; the
 * page's docblock has the measurements. Searching, facet counting and the date
 * window come from `./financials`, so the two ambassador lists search and
 * count the same way.
 */

/* ── Rows ─────────────────────────────────────────────────────────────────── */

export interface ApplicationRow extends AmbassadorApplication {
  /** The nine fields the search box matches, lowercased once when the rows
   *  load rather than on every keystroke. */
  haystack: string;
}

export function toApplicationRows(applications: AmbassadorApplication[]): ApplicationRow[] {
  return applications.map((application) => ({
    ...application,
    haystack: haystackOf([
      application.name,
      application.email,
      application.phone,
      application.university,
      application.law_school,
      application.faculty,
      application.country,
      application.level,
      application.social_handle,
    ]),
  }));
}

/* ── Filters ──────────────────────────────────────────────────────────────── */

export const APPLICATION_STATUSES: readonly AmbassadorStatus[] = [
  'pending',
  'approved',
  'rejected',
];

export const STATUS_LABELS: Record<AmbassadorStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * What the date filter says on this screen.
 *
 * Every application carries `created_at`, so the window is a real filter on
 * when it was submitted, and each option names that date. The financials
 * screen's window tests the last referral instead and has its own words
 * (`DATE_WINDOW_LABELS` in `./financials`).
 */
export const SUBMITTED_WINDOW_LABELS: Record<DateWindow, string> = {
  all: 'All time',
  '7d': 'Submitted in the last 7 days',
  '30d': 'Submitted in the last 30 days',
};

export interface ApplicationsFilters extends AmbassadorListFilters {
  status: AmbassadorStatus | null;
}

export function isApplicationsFiltered(filters: ApplicationsFilters): boolean {
  return filters.status !== null || isFiltered(filters);
}

/** A filter that shows counts beside its options, and so is left out of the
 *  pass that counts them. */
type CountedFilter = FacetKey | 'status';

/**
 * Rows that pass every filter.
 *
 * `now` is when the screen opened, passed in for the reason `windowCutoff`
 * gives. `skip` leaves one filter out, which is how each count shows what
 * picking that option would leave rather than what the current pick hides.
 */
export function filterApplications(
  rows: ApplicationRow[],
  filters: ApplicationsFilters,
  now: number,
  skip?: CountedFilter
): ApplicationRow[] {
  const terms = searchTerms(filters.search);
  const cutoff = windowCutoff(filters.window, now);

  return rows.filter((row) => {
    if (skip !== 'status' && filters.status !== null && row.status !== filters.status) {
      return false;
    }

    for (const key of FACET_KEYS) {
      if (key === skip) continue;
      const wanted = filters[key];
      if (wanted !== null && row[key] !== wanted) return false;
    }

    if (cutoff !== null) {
      const at = Date.parse(row.created_at);
      if (Number.isNaN(at) || at < cutoff) return false;
    }

    return terms.every((term) => row.haystack.includes(term));
  });
}

/** University, level and country choices, each counted over the rows the
 *  other filters leave. */
export function applicationFacets(
  rows: ApplicationRow[],
  filters: ApplicationsFilters,
  now: number
): Record<FacetKey, FacetOption[]> {
  return {
    university: countFacet(
      filterApplications(rows, filters, now, 'university'),
      (row) => row.university,
      filters.university
    ),
    level: countFacet(
      filterApplications(rows, filters, now, 'level'),
      (row) => row.level,
      filters.level
    ),
    country: countFacet(
      filterApplications(rows, filters, now, 'country'),
      (row) => row.country,
      filters.country
    ),
  };
}

export type StatusCounts = Record<AmbassadorStatus | 'all', number>;

/**
 * How many applications each status holds once every OTHER filter is applied,
 * the rule the facet counts follow. Every status is counted, zeros included:
 * the statuses are a fixed set, and "Rejected 0" is an answer.
 */
export function statusCounts(
  rows: ApplicationRow[],
  filters: ApplicationsFilters,
  now: number
): StatusCounts {
  const counts: StatusCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of filterApplications(rows, filters, now, 'status')) {
    counts.all += 1;
    if (APPLICATION_STATUSES.includes(row.status)) counts[row.status] += 1;
  }
  return counts;
}

/* ── Sorting ──────────────────────────────────────────────────────────────── */

export const SORT_COLUMNS = ['submitted', 'name', 'status', 'reviewed'] as const;
export type ApplicationSortColumn = (typeof SORT_COLUMNS)[number];

export interface ApplicationsSort {
  column: ApplicationSortColumn;
  direction: SortDirection;
}

/**
 * The direction a column takes when it is first picked: dates newest first,
 * names A to Z, and status with pending on top, because pending is the queue
 * this screen is for.
 */
export const FIRST_DIRECTION: Record<ApplicationSortColumn, SortDirection> = {
  submitted: 'desc',
  name: 'asc',
  status: 'asc',
  reviewed: 'desc',
};

/** Newest submission first: the order the screen opens in. */
export const DEFAULT_SORT: ApplicationsSort = { column: 'submitted', direction: 'desc' };

/** The ascending order of a status sort. A status outside this set counts as
 *  later than all three. */
const STATUS_ORDER: Record<AmbassadorStatus, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
};

function timeOf(iso: string | null): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : at;
}

function newestFirst(a: ApplicationRow, b: ApplicationRow): number {
  return (timeOf(b.created_at) ?? 0) - (timeOf(a.created_at) ?? 0);
}

/**
 * Sorted rows, as a new array.
 *
 * Ties fall back to newest submission first in either direction, so a status
 * sort shows the latest pending application at the top of its group.
 *
 * An application nobody has reviewed has no `reviewed_at`. Under the Reviewed
 * sort those rows go to the bottom in BOTH directions: "not reviewed yet" is
 * neither an early date nor a late one, and flipping the direction should
 * reorder the reviewed rows without lifting every unreviewed row above them.
 */
export function sortApplications(
  rows: ApplicationRow[],
  sort: ApplicationsSort
): ApplicationRow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sort.column === 'name') {
      const order = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return order !== 0 ? factor * order : newestFirst(a, b);
    }

    if (sort.column === 'status') {
      const unknown = APPLICATION_STATUSES.length;
      const order = (STATUS_ORDER[a.status] ?? unknown) - (STATUS_ORDER[b.status] ?? unknown);
      return order !== 0 ? factor * order : newestFirst(a, b);
    }

    if (sort.column === 'reviewed') {
      const aAt = timeOf(a.reviewed_at);
      const bAt = timeOf(b.reviewed_at);
      if (aAt === null || bAt === null) {
        if (aAt === bAt) return newestFirst(a, b);
        return aAt === null ? 1 : -1;
      }
      return aAt !== bAt ? factor * (aAt - bAt) : newestFirst(a, b);
    }

    return factor * ((timeOf(a.created_at) ?? 0) - (timeOf(b.created_at) ?? 0));
  });
}

/* ── Paging ───────────────────────────────────────────────────────────────── */

/** The page size the screen had when the server paged it. */
export const PAGE_SIZE = 15;

/**
 * One page of rows, and the pagination block `AdminPagination` reads, computed
 * here instead of by the server.
 *
 * A page past the end shows the last page. A copied link can outlive the rows
 * that filled its page, and an empty table there would read as "no results".
 */
export function paginate<Row>(
  rows: Row[],
  requested: number
): { rows: Row[]; pagination: AdminConversationsPagination } {
  const total = rows.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, requested), lastPage);
  const start = (page - 1) * PAGE_SIZE;

  return {
    rows: rows.slice(start, start + PAGE_SIZE),
    pagination: {
      current_page: page,
      per_page: PAGE_SIZE,
      total,
      last_page: lastPage,
      from: total === 0 ? null : start + 1,
      to: total === 0 ? null : Math.min(start + PAGE_SIZE, total),
    },
  };
}

/* ── The URL ──────────────────────────────────────────────────────────────── */

/**
 * Everything a copied link has to reopen. One query-string key per control:
 * `status`, `search`, `university`, `level`, `country`, `submitted` (`7d` or
 * `30d`), `sort` (`name`, `status` or `reviewed`), `direction` (`asc` or
 * `desc`) and `page`. A default is left out rather than written, so the bare
 * path is the unfiltered screen in its opening order.
 */
export interface ApplicationsView {
  filters: ApplicationsFilters;
  sort: ApplicationsSort;
  page: number;
}

function oneOf<T extends string>(options: readonly T[], value: string | null): T | null {
  return options.find((option) => option === value) ?? null;
}

/** The view a query string describes. A value this screen does not know falls
 *  back to the default for its control. */
export function readView(params: { get(name: string): string | null }): ApplicationsView {
  const column = oneOf(SORT_COLUMNS, params.get('sort')) ?? DEFAULT_SORT.column;
  const page = Number(params.get('page'));

  return {
    filters: {
      status: oneOf(APPLICATION_STATUSES, params.get('status')),
      search: params.get('search') ?? '',
      university: params.get('university') || null,
      level: params.get('level') || null,
      country: params.get('country') || null,
      window: oneOf(DATE_WINDOWS, params.get('submitted')) ?? 'all',
    },
    sort: {
      column,
      direction:
        oneOf(['asc', 'desc'] as const, params.get('direction')) ?? FIRST_DIRECTION[column],
    },
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** A write for `replaceUrlParams`. `null` deletes the key. Every filter and
 *  sort write deletes `page`, so a changed result opens on its first page. */
export type UrlUpdates = Record<string, string | null>;

/** What a newly committed search deletes, handed to `useUrlSearch`. */
export const SEARCH_RESETS: readonly string[] = ['page'];

export function statusUpdate(status: AmbassadorStatus | null): UrlUpdates {
  return { status, page: null };
}

export function facetUpdate(patch: Partial<Record<FacetKey, string | null>>): UrlUpdates {
  const updates: UrlUpdates = { page: null };
  for (const key of FACET_KEYS) {
    const value = patch[key];
    if (value !== undefined) updates[key] = value;
  }
  return updates;
}

export function windowUpdate(dateWindow: DateWindow): UrlUpdates {
  return { submitted: dateWindow === 'all' ? null : dateWindow, page: null };
}

/**
 * The write for a click on a sortable header. The column already sorting the
 * table flips direction; any other column starts in its `FIRST_DIRECTION`.
 * There is no third, unsorted state: the opening order is one click on
 * Submitted away.
 */
export function sortUpdate(column: ApplicationSortColumn, current: ApplicationsSort): UrlUpdates {
  let direction: SortDirection = FIRST_DIRECTION[column];
  if (column === current.column) direction = current.direction === 'asc' ? 'desc' : 'asc';

  return {
    sort: column === DEFAULT_SORT.column ? null : column,
    direction: direction === FIRST_DIRECTION[column] ? null : direction,
    page: null,
  };
}

export function pageUpdate(page: number): UrlUpdates {
  return { page: page > 1 ? String(page) : null };
}

/** Clear: every filter off and back to the first page. The sort stays, as it
 *  does on financials. The search box clears itself through `useUrlSearch`. */
export const CLEAR_FILTER_UPDATES: UrlUpdates = {
  status: null,
  university: null,
  level: null,
  country: null,
  submitted: null,
  page: null,
};
