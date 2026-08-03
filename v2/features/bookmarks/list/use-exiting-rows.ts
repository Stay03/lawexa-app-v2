'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * useExitingRows — the PRESENCE HOLDOVER for a list whose rows are removed
 * optimistically.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────
 * An optimistic removal writes the cache in the same tick as the press, so the
 * row is gone from `rows` before it has drawn a single frame of leaving. Rows
 * animate IN and then SNAP OUT — the asymmetric motion the house rules forbid
 * ("every show/hide gets a deliberate transition that animates BOTH
 * directions").
 *
 * ── THE SHAPE ───────────────────────────────────────────────────────────────
 * The press calls `beginExit(row, index)`, which HOLDS that row (with the
 * position it occupied) for {@link ROW_EXIT_MS} and re-splices it into the
 * rendered list marked `exiting`. The caller styles that row's collapse; when
 * the hold expires the row unmounts for real.
 *
 * A TIMER, NOT AN EFFECT — the pattern `ConversationComposer` already uses for
 * its attachment chips. Two reasons: the commit then also fires under
 * `prefers-reduced-motion`, where the visual exit is suppressed but the row
 * must still leave; and a `setState` scheduled from an event handler never goes
 * near `react-hooks/set-state-in-effect`.
 *
 * ── IT COMPOSES WITH AN OPTIMISTIC ROLLBACK ────────────────────────────────
 * A held row whose key REAPPEARS in `rows` (the request failed fast and the
 * cache re-inserted it) is not spliced in a second time — it is simply rendered
 * as the live row it now is, and `exiting` flips back to `false`. Because the
 * element never unmounted, its collapse transition REVERSES: the row opens back
 * up instead of replaying an entrance. A rollback that lands after the hold has
 * already expired remounts the row normally, which is the honest "it came back"
 * signal.
 *
 * The hook is generic and holds no bookmark knowledge, so any v2 list that
 * removes rows optimistically can adopt it unchanged.
 */

/**
 * The exit duration, shared by the hook (when the row is committed) and the row
 * (how long its collapse runs). ~150ms is the house `--duration-fast`/`base`
 * band for a leaving list row: long enough to read as motion, short enough that
 * a burst of removals never queues up.
 */
export const ROW_EXIT_MS = 150;

/** One row as the list should render it. */
export interface PresentedRow<T> {
  row: T;
  /** `true` while it is playing its exit and awaiting unmount. */
  exiting: boolean;
}

/** A row being held past its removal, with where it was. */
interface HeldRow<T> {
  readonly row: T;
  readonly index: number;
}

/** Frozen empty map, so "nothing exiting" is one stable reference. */
const NO_HELD: ReadonlyMap<string, HeldRow<never>> = new Map();

export function useExitingRows<T>(
  rows: readonly T[],
  /** Stable identity of a row. MUST be referentially stable across renders. */
  getKey: (row: T) => string,
): {
  presented: readonly PresentedRow<T>[];
  /** Hold `row` (last seen at `index`) through its exit, then drop it. */
  beginExit: (row: T, index: number) => void;
} {
  const [held, setHeld] = useState<ReadonlyMap<string, HeldRow<T>>>(NO_HELD);

  const beginExit = useCallback(
    (row: T, index: number) => {
      const key = getKey(row);
      setHeld((previous) => {
        if (previous.has(key)) return previous;
        const next = new Map(previous);
        next.set(key, { row, index });
        return next;
      });
      window.setTimeout(() => {
        setHeld((previous) => {
          if (!previous.has(key)) return previous;
          const next = new Map(previous);
          next.delete(key);
          return next.size === 0 ? NO_HELD : next;
        });
      }, ROW_EXIT_MS);
    },
    [getKey],
  );

  const presented = useMemo<readonly PresentedRow<T>[]>(() => {
    const live = rows.map((row) => ({ row, exiting: false }));
    if (held.size === 0) return live;

    const liveKeys = new Set(rows.map(getKey));
    const departed = [...held.values()]
      // A held row that is back in `rows` (a fast rollback) is rendered as the
      // live row it is — never twice.
      .filter((entry) => !liveKeys.has(getKey(entry.row)))
      // Ascending, so each splice lands before the next one shifts the array.
      .sort((a, b) => a.index - b.index);
    if (departed.length === 0) return live;

    for (const entry of departed) {
      live.splice(Math.min(entry.index, live.length), 0, {
        row: entry.row,
        exiting: true,
      });
    }
    return live;
  }, [rows, held, getKey]);

  return { presented, beginExit };
}
