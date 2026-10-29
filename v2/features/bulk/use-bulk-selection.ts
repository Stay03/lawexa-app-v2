'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { extractApiError } from '@/lib/utils/api-error';
import {
  bulkOutcome,
  escapeClearsSelection,
  prunedTo,
  selectAllState,
  selectAllToggled,
  stillSelecting,
  toggled,
  type BulkItemId,
  type BulkResult,
  type BulkVerb,
  type SelectOrigin,
} from './model';

/**
 * A list's ticked rows (bulk select, Arthur, 20 October 2026). The list
 * passes the keys it shows now; the selection is read against them on every
 * render, so a row that left the list (deleted, moved, filtered out) is no
 * longer counted, with no effect and no second render.
 */
export function useBulkSelection<K>(keys: readonly K[]) {
  const [started, setStarted] = useState(false);
  const [origin, setOrigin] = useState<SelectOrigin>('button');
  const [raw, setRaw] = useState<ReadonlySet<K>>(() => new Set());
  const selection = useMemo(() => prunedTo(raw, keys), [raw, keys]);
  // Begun from a tick, it ends with the last tick cleared (`stillSelecting`),
  // read here so no effect and no second render is needed.
  const active = stillSelecting({ active: started, origin, count: selection.size });

  const toggle = useCallback((key: K) => setRaw((current) => toggled(current, key)), []);
  const toggleAll = useCallback(() => setRaw((current) => selectAllToggled(prunedTo(current, keys), keys)), [keys]);
  const keepOnly = useCallback((next: readonly K[]) => setRaw(new Set(next)), []);
  const start = useCallback(() => {
    setRaw(new Set());
    setOrigin('button');
    setStarted(true);
  }, []);
  /** Start selecting with this one row ticked: a row's own tick on a computer. */
  const startWith = useCallback((key: K) => {
    setRaw(new Set([key]));
    setOrigin('tick');
    setStarted(true);
  }, []);
  /** Start selecting with every row ticked: the list head's tick on a computer. */
  const startAll = useCallback(() => {
    setRaw(new Set(keys));
    setOrigin('tick');
    setStarted(true);
  }, [keys]);
  const stop = useCallback(() => {
    setStarted(false);
    setRaw(new Set());
  }, []);

  // Escape clears the ticks while the list is being ticked (Arthur, 29
  // October 2026, 07:05Z, thread 8aa04be0: "the way to untick all is
  // unintuitive"), unless the reader is typing or a dialog or menu is open.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const press = {
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        typing: target !== null && (target.isContentEditable || target.closest('input, textarea, select') !== null),
        layerOpen: document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') !== null,
      };
      if (escapeClearsSelection(press)) stop();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, stop]);

  return {
    /** Selecting: rows show their tick boxes, and a tap ticks instead of opening. */
    active,
    start,
    startWith,
    startAll,
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
