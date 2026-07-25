'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * useNewRows — the headless half of the "N new rows" pattern (owner ask: "that
 * initial list should cache and when i go back again it should load the same list
 * before running the request and then if there are new rows it should show a pill
 * at the top"). Feature-agnostic on purpose: it knows nothing about
 * conversations, TanStack, the DOM, or the shell. Pair it with
 * `v2/shell/NewRowsPill.tsx` for the UI. Phase-4 lists (cases, statutes, notes)
 * reuse both unchanged.
 *
 * ── THE PROBLEM ───────────────────────────────────────────────────────────────
 * A retained list (`GC_TIMES.list`) paints its cached rows instantly on return,
 * and its staleTime then fires a background refetch. When that refetch lands, any
 * row that arrived ABOVE the user's position is spliced in under their eyes —
 * the list jumps, and whatever they were reading moves. That jump is the cost of
 * caching well, and it is what this hook removes.
 *
 * ── THE SHAPE ─────────────────────────────────────────────────────────────────
 * There is NO second cache and NO snapshot copy of the rows. The live query cache
 * stays the single source of truth (v2's optimistic list writers depend on its
 * referential no-op stability and structural sharing — a shadow copy would break
 * that contract, and a TanStack `select` would hide rows from every OTHER
 * consumer of the same key, including those writers' own view). What this hook
 * produces is a filtered PROJECTION of the live rows: rows that appeared above a
 * watermark are WITHHELD from `visibleRows` and COUNTED into `newCount` instead.
 *
 * A row is withheld only when ALL of these hold:
 *   1. its id was not in the set captured at the last accept (so a row you
 *      already have is never announced as new), AND
 *   2. its sort key is strictly newer than the watermark captured at the last
 *      accept (so later PAGES — which are always older — append normally and are
 *      never announced), AND
 *   3. `isSelfAuthored` does not claim it (a row the user just created must
 *      appear instantly, never as someone else's news).
 *
 * Everything else therefore applies IMMEDIATELY and by design: a title patch (id
 * already known), a delete (the row simply leaves `rows`), and a reorder of a row
 * that is already known. Holding a reorder would mean rendering rows in an order
 * the cache no longer has, which would fight the optimistic "bump to top" writers
 * — and a row you already have is not news whatever position it moves to. Only
 * genuine insertion above the watermark is held.
 *
 * ── WHY NOT A `dataUpdatedAt` / TIMESTAMP CHECK ───────────────────────────────
 * Because the v2 list writers fan out across EVERY list key, reading a query's
 * `dataUpdatedAt` would break the tracked-props optimisation and re-render every
 * consumer on every write (see the invariant documented in
 * `features/conversations/cache.ts`). Newness here is derived purely from the ROW
 * data the caller hands in, so this hook can never touch that invariant.
 */

/** Newness bookkeeping captured at the last accept (or at first data). */
interface Baseline {
  /** Every id the user has already been shown. */
  readonly ids: ReadonlySet<string>;
  /** The newest sort key the user has already been shown. */
  readonly watermark: number;
}

/** The single state atom, so every transition below is one atomic update. */
interface Watch {
  /** The `resetKey` this baseline belongs to (`''` when the caller passes none). */
  readonly scope: string;
  /** `null` until the first rows that genuinely belong to `scope` arrive. */
  readonly baseline: Baseline | null;
}

export interface UseNewRowsOptions<T> {
  /**
   * The live rows, newest first. Derive it with `useMemo` from the query's `data`
   * so its identity only changes when the data really does — the projection below
   * is memoised on it.
   */
  rows: readonly T[];
  /** Stable identity of a row. Must be referentially stable across renders. */
  getId: (row: T) => string;
  /**
   * The row's position on the list's sort axis as a NUMBER, ascending (newest =
   * greatest) — e.g. `Date.parse(row.updated_at)`. A number rather than a raw
   * string so no timezone/format assumption can silently invert the comparison.
   * `NaN` (an unparseable timestamp) fails CLOSED: such a row is never withheld
   * and never raises the watermark. Must be referentially stable.
   */
  getSortKey: (row: T) => number;
  /**
   * Identity of the data set. Change it and the baseline is dropped and re-seeded
   * from the first rows of the new set — e.g. the trimmed search string, so an
   * unfiltered watermark can never leak into a filtered list and announce every
   * result as new. No pill is ever shown across such a transition.
   */
  resetKey?: string;
  /**
   * `true` while `rows` do NOT belong to the current `resetKey` yet — they are a
   * stand-in carried over from the previous data set (TanStack's
   * `isPlaceholderData` under `keepPreviousData`). While it is true the hook stays
   * DISARMED: it shows every row, announces nothing, and — critically — refuses to
   * seed a baseline, because seeding from the outgoing set's rows is exactly what
   * would make every row of the incoming set look new. Defaults to `false`.
   *
   * This is an exact signal, deliberately taken from the caller rather than
   * guessed from row identity: when a `resetKey` change lands on data that is
   * ALREADY cached (clearing a search back to a warm list) the rows are correct
   * immediately, and the hook must arm in that same render rather than sit
   * disarmed waiting for a change that may never come.
   */
  rowsArePlaceholder?: boolean;
  /**
   * Rows the CURRENT user just created themselves. They are shown immediately and
   * never counted. Optional because a surface where no create can originate (the
   * `/conversations` page has no composer, and is unmounted while the home screen
   * creates) does not need it — but the seam is typed here so an always-mounted
   * surface (the sidebar recents) can adopt the pill without the hook changing.
   */
  isSelfAuthored?: (row: T) => boolean;
  /**
   * Escape hatch for surfaces where an insertion genuinely cannot disturb the
   * user: while `true`, arriving rows are absorbed SILENTLY (no pill) instead of
   * being withheld. Defaults to `false`.
   *
   * DELIBERATELY NOT WIRED TO "the scroll region is at the top" on a list page,
   * even though that reads like the obvious source. Two independent reasons,
   * both verified against the installed next@16.2.10:
   *
   *  1. A RETURNING USER IS OFTEN *NOT* AT THE TOP. Browser Back/Forward does not
   *     scroll at all — `router-reducer/ppr-navigations.js` `accumulateScrollRef()`
   *     skips history traversal (`FreshnessPolicy.HistoryTraversal`), and
   *     `segment-cache/navigation.js` reuses an already-consumed scroll ref — while
   *     `.v2-shell__content` is layout-owned, so its `scrollTop` survives from the
   *     outgoing route. Back is the dominant return gesture, so the user lands at an
   *     ARBITRARY offset: exactly when an insertion above them is most disruptive
   *     and the pill is most valuable.
   *  2. AT THE TOP THE PILL IS STILL RIGHT. Auto-accepting there would silently
   *     swallow the case the pill exists for ("go back, then show me what's new"),
   *     and at `scrollTop 0` browsers disable scroll anchoring, so rows spliced
   *     above row 1 push the row the user IS reading down the page.
   *
   * Reach for this only where "the user is provably not reading the insertion
   * point" is true independently of navigation — e.g. a transcript pinned to its
   * bottom edge, where new content arrives away from the anchor.
   */
  isAtTop?: boolean;
}

export interface NewRows<T> {
  /**
   * The rows to render. Referentially IDENTICAL to `rows` whenever nothing is
   * withheld, which is the overwhelmingly common case.
   */
  visibleRows: readonly T[];
  /** How many rows are being withheld. `0` ⇒ render no pill. */
  newCount: number;
  /** Reveal the withheld rows and re-arm the watermark. Stable per data change. */
  accept: () => void;
}

function makeBaseline<T>(
  rows: readonly T[],
  getId: (row: T) => string,
  getSortKey: (row: T) => number,
): Baseline {
  const ids = new Set<string>();
  let watermark = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    ids.add(getId(row));
    const key = getSortKey(row);
    // `NaN > x` is false, so an unparseable key can never raise the watermark.
    if (key > watermark) watermark = key;
  }
  return { ids, watermark };
}

interface Projection<T> {
  readonly visibleRows: readonly T[];
  /** The withheld ids, or `null` when nothing is withheld. */
  readonly withheld: ReadonlySet<string> | null;
}

export function useNewRows<T>({
  rows,
  getId,
  getSortKey,
  resetKey,
  rowsArePlaceholder = false,
  isSelfAuthored,
  isAtTop = false,
}: UseNewRowsOptions<T>): NewRows<T> {
  const scope = resetKey ?? '';

  const [watch, setWatch] = useState<Watch>(() => ({ scope, baseline: null }));

  // ── State adjusted DURING RENDER (React's sanctioned guarded form — the same
  // shape `list/useConversationsSearch.ts` uses; the equivalent effect would trip
  // `react-hooks/set-state-in-effect`). Both steps are pure functions of the
  // incoming props, they run in sequence so a reset can re-arm in the SAME render
  // when the new set's rows are already correct, and they converge immediately. ──
  let current = watch;
  if (current.scope !== scope) {
    // The data set changed identity (a new search). Disarm.
    current = { scope, baseline: null };
  }
  if (current.baseline === null && !rowsArePlaceholder && rows.length > 0) {
    // First rows that genuinely belong to this scope: everything on screen right
    // now counts as "already seen". Nothing is ever announced on a first paint.
    current = { scope, baseline: makeBaseline(rows, getId, getSortKey) };
  }
  if (current !== watch) setWatch(current);

  const baseline = current.baseline;

  const projection = useMemo<Projection<T>>(() => {
    if (baseline === null) return { visibleRows: rows, withheld: null };

    let withheld: Set<string> | null = null;
    for (const row of rows) {
      const id = getId(row);
      if (baseline.ids.has(id)) continue;
      // Written as `!(key > watermark)` so `NaN` (unparseable) also skips.
      if (!(getSortKey(row) > baseline.watermark)) continue;
      if (isSelfAuthored?.(row)) continue;
      (withheld ??= new Set<string>()).add(id);
    }

    // Referential no-op: nothing withheld ⇒ hand back the caller's own array.
    if (withheld === null) return { visibleRows: rows, withheld: null };

    // FLOOR (review F1): never withhold EVERYTHING. Withholding exists to protect
    // the reading position; if nothing would survive, there is no reading position
    // to protect — and the caller would render a pill above a blank column while
    // its own state guards (which read the true loaded set) correctly report
    // "not empty". Reachable when a whole page of genuinely-new rows arrives, or
    // when the rows empty and repopulate wholly-new while mounted. Show them.
    if (withheld.size === rows.length) return { visibleRows: rows, withheld: null };

    const hidden = withheld;
    return {
      visibleRows: rows.filter((row) => !hidden.has(getId(row))),
      withheld: hidden,
    };
  }, [rows, baseline, getId, getSortKey, isSelfAuthored]);

  // AUTO-ACCEPT AT THE TOP. Re-arm silently rather than announce. Terminating:
  // the re-seeded baseline contains every current id, so the next render withholds
  // nothing and this branch cannot fire again for the same rows.
  const silentAccept = projection.withheld !== null && isAtTop;
  if (silentAccept) {
    setWatch({ scope, baseline: makeBaseline(rows, getId, getSortKey) });
  }

  const accept = useCallback(() => {
    setWatch({ scope, baseline: makeBaseline(rows, getId, getSortKey) });
  }, [scope, rows, getId, getSortKey]);

  return {
    visibleRows: silentAccept ? rows : projection.visibleRows,
    newCount: silentAccept ? 0 : (projection.withheld?.size ?? 0),
    accept,
  };
}
