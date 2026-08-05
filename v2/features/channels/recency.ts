/**
 * recency — the Today / This week / Earlier bucketing two channel surfaces
 * both speak: the `/channels` index groups rows by last activity, and the
 * Files tab groups its library by upload date. One module so the two can never
 * disagree about where the week ends.
 *
 * ── IT NEVER RE-ORDERS ─────────────────────────────────────────────────────
 * The caller's order is preserved INSIDE each bucket and the buckets come out
 * in fixed order, so grouping is a lens over a list somebody else ranked. That
 * matters on `/channels`, where the server sorts by newest activity and a
 * client re-sort would be the screen arguing with the contract.
 *
 * ── `now` IS THREADED IN ───────────────────────────────────────────────────
 * Pure, like `formatRelativeTime`: the clock comes from a lazy `useState` at
 * the call site so no `Date.now()` runs in render (React Compiler lint), and
 * the label a row carries cannot change between two renders of one paint.
 *
 * ── A MISSING DATE IS `earlier`, NOT ITS OWN GROUP ─────────────────────────
 * A channel with no messages and a file with an unparseable stamp both sort
 * to the bottom of the lists that feed this, so they land in the bucket that
 * is already at the bottom. A fourth "never" group would be a heading for the
 * quietest rows in the product — more chrome than the fact deserves.
 */

export type RecencyBucket = 'today' | 'week' | 'earlier';

/** The section headings, in display order. Module-private: `groupByRecency` is
 *  the only supported way in, so a caller cannot bucket rows by one rule and
 *  label them by another. */
const RECENCY_BUCKETS: readonly RecencyBucket[] = ['today', 'week', 'earlier'];

const RECENCY_LABEL: Record<RecencyBucket, string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which bucket an ISO timestamp falls in.
 *
 * `today` is the CALENDAR day, not "the last 24 hours" — a message from
 * 11pm yesterday reading as "Today" at 9am would be wrong in the only way a
 * date heading can be. `week` then covers the six calendar days before it.
 */
function recencyBucket(iso: string | null | undefined, now: number): RecencyBucket {
  if (!iso) return 'earlier';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'earlier';
  // `setHours` on a fresh Date returns the epoch value — no clock read, and
  // the local midnight is the one the reader's own calendar agrees with.
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (then >= startOfToday) return 'today';
  if (then >= startOfToday - 6 * DAY_MS) return 'week';
  return 'earlier';
}

/** One rendered section: the bucket, its heading, and the rows in it. */
export interface RecencySection<Row> {
  bucket: RecencyBucket;
  label: string;
  rows: Row[];
}

/**
 * Bucket `rows` by the timestamp `at` reads off each one. Empty buckets are
 * dropped, so a list whose rows are all from today renders one heading rather
 * than three — a heading for nothing is noise.
 */
export function groupByRecency<Row>(
  rows: readonly Row[],
  now: number,
  at: (row: Row) => string | null | undefined,
): RecencySection<Row>[] {
  const byBucket = new Map<RecencyBucket, Row[]>();
  for (const row of rows) {
    const bucket = recencyBucket(at(row), now);
    const existing = byBucket.get(bucket);
    if (existing) existing.push(row);
    else byBucket.set(bucket, [row]);
  }
  const sections: RecencySection<Row>[] = [];
  for (const bucket of RECENCY_BUCKETS) {
    const bucketRows = byBucket.get(bucket);
    if (bucketRows && bucketRows.length > 0) {
      sections.push({ bucket, label: RECENCY_LABEL[bucket], rows: bucketRows });
    }
  }
  return sections;
}
