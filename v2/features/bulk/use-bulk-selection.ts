'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { extractApiError } from '@/lib/utils/api-error';
import {
  bulkOutcome,
  prunedTo,
  selectAllState,
  selectAllToggled,
  toggled,
  type BulkItemId,
  type BulkResult,
  type BulkVerb,
} from './model';

/**
 * A list's ticked rows (bulk select, Arthur, 20 October 2026). The list
 * passes the keys it shows now; the selection is read against them on every
 * render, so a row that left the list (deleted, moved, filtered out) is no
 * longer counted, with no effect and no second render.
 */
export function useBulkSelection<K>(keys: readonly K[]) {
  const [active, setActive] = useState(false);
  const [raw, setRaw] = useState<ReadonlySet<K>>(() => new Set());
  const selection = useMemo(() => prunedTo(raw, keys), [raw, keys]);

  const toggle = useCallback((key: K) => setRaw((current) => toggled(current, key)), []);
  const toggleAll = useCallback(() => setRaw((current) => selectAllToggled(prunedTo(current, keys), keys)), [keys]);
  const keepOnly = useCallback((next: readonly K[]) => setRaw(new Set(next)), []);
  const start = useCallback(() => setActive(true), []);
  const stop = useCallback(() => {
    setActive(false);
    setRaw(new Set());
  }, []);

  return {
    /** Selecting: rows show their tick boxes, and a tap ticks instead of opening. */
    active,
    start,
    stop,
    selection,
    count: selection.size,
    isSelected: (key: K) => selection.has(key),
    toggle,
    /** The select-all box. */
    toggleAll,
    allState: selectAllState(selection, keys),
    /** After an action: keep the rows that failed ticked, so the reader sees which. */
    keepOnly,
  };
}

/**
 * One bulk action: runs it, tells the reader the outcome in one sentence
 * (`bulkOutcome`), refreshes the lists it touched, and leaves only the
 * failed rows ticked. A request that fails outright (offline, a 500) says so
 * and leaves the selection as it was.
 */
export function useBulkAction({
  verb,
  noun,
  onSettled,
  keepFailed,
}: {
  verb: BulkVerb;
  noun: { one: string; many: string };
  /** Refresh the lists the action touched (the screen's query keys). */
  onSettled: () => void;
  /** The ticked rows that failed, for the selection to keep. */
  keepFailed: (failedIds: ReadonlyArray<BulkItemId>) => void;
}) {
  return useMutation({
    mutationFn: (run: () => Promise<BulkResult>) => run(),
    meta: { silentError: true },
    onSuccess: (result) => {
      const message = bulkOutcome(result, verb, noun);
      if (result.failed === 0) toast.success(message);
      else if (result.done === 0) toast.error(message);
      else toast.warning(message);
      keepFailed(result.results.filter((item) => !item.ok).map((item) => item.id));
    },
    onError: (error) => toast.error(extractApiError(error).message),
    onSettled,
  });
}

export type BulkSelection<K> = ReturnType<typeof useBulkSelection<K>>;
