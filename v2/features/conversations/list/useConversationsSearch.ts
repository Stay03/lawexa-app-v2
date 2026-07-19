'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * useConversationsSearch — the URL-synced, 300ms-debounced search state for the
 * `/conversations` page, rebuilt LINT-CLEAN (the v1 `ConversationSearchBar`
 * synced local state from props inside an effect — a `set-state-in-effect`
 * React-Compiler ERROR — and this hook removes that class of sync entirely).
 *
 * TWO values, ONE direction of flow:
 *  - `committedSearch` — read from the URL (`?search=`). It is the source of
 *    truth for the QUERY; it changes only after the debounce commits.
 *  - `inputValue` — the immediate text in the box, for a responsive field.
 *
 * EXTERNAL-CHANGE RECONCILE, WITHOUT A SYNC EFFECT (the v1 defect stays dead).
 * The URL can change under this hook while the component instance SURVIVES — an
 * in-app soft nav to bare `/conversations` (the sidebar nav row, the Work/Study
 * "All" links) drops `?search=` without a remount (W5 review finding 1). So the
 * hook tracks what IT last committed (`selfCommitted`): when `committedSearch`
 * diverges from that, the change was EXTERNAL and the box adopts the URL. A
 * self-commit landing mid-typing never resyncs (it always equals what the hook
 * wrote), so no keystroke can be eaten. The adopt runs as a GUARDED render-phase
 * state adjustment (React's sanctioned derived-state-reset pattern) — never a
 * props→state effect, so the React Compiler rules stay satisfied.
 *
 * The debounce timer lives in a ref and is only ever touched from event
 * handlers (`onInputChange` / `onClear`) or the unmount cleanup — never from an
 * effect body that sets state — so the whole hook stays React-Compiler-clean.
 * (A debounce pending across an external adopt fires afterwards and re-commits
 * the typed text — box and URL stay consistent either way, never desynced.)
 */

const DEBOUNCE_MS = 300;

export interface ConversationsSearch {
  /** The active (debounced) search that the list query is filtered by. */
  committedSearch: string;
  /** The immediate value shown in the input. */
  inputValue: string;
  /** Update the field + (re)schedule the debounced URL commit. */
  onInputChange: (value: string) => void;
  /** Clear both the field and the URL immediately (X + empty-state action). */
  onClear: () => void;
}

export function useConversationsSearch(): ConversationsSearch {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const committedSearch = searchParams.get('search') ?? '';

  const [inputValue, setInputValue] = useState(() => committedSearch);
  // What THIS hook last wrote to the URL — the discriminator between its own
  // commits (never resync) and external URL changes (adopt). See docblock.
  const [selfCommitted, setSelfCommitted] = useState(() => committedSearch);

  if (committedSearch !== selfCommitted) {
    // The URL changed under us (bare-/conversations nav row, deep link) —
    // adopt it. Guarded render-phase adjustment, not an effect.
    setSelfCommitted(committedSearch);
    setInputValue(committedSearch);
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Write the value into the URL. `replace` (no history spam) + `scroll: false`
  // (the list must not jump to the top on each keystroke). Other params are
  // preserved so the URL contract stays generic.
  const commit = useCallback(
    (value: string) => {
      // Record the self-commit FIRST so the searchParams update it causes is
      // recognized as our own and never triggers the external-adopt path.
      setSelfCommitted(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set('search', value);
      else params.delete('search');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams],
  );

  const onInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        commit(value);
      }, DEBOUNCE_MS);
    },
    [clearTimer, commit],
  );

  const onClear = useCallback(() => {
    setInputValue('');
    clearTimer();
    commit('');
  }, [clearTimer, commit]);

  // Cancel any pending debounce on unmount — no state set here, so lint-clean.
  useEffect(() => () => clearTimer(), [clearTimer]);

  return { committedSearch, inputValue, onInputChange, onClear };
}
