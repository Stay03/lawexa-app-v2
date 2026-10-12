'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a search waits after the last keystroke before it asks. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * A search box whose list is filtered by the SERVER: what the box shows now
 * (`value`), and the term the list asks for (`term`), committed 300ms after
 * the last keystroke from the change handler itself, the cited-by panel's
 * idiom (no effect, so no state is set in one). Clearing applies at once: no
 * wait to see everything again.
 *
 * Shared by a space's content tabs and the Move to space picker (design round
 * 1), so the two searches wait and clear the same way.
 */
export function useServerSearch() {
  const [value, setValueState] = useState('');
  const [term, setTerm] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = timerRef;
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const setValue = useCallback((next: string) => {
    setValueState(next);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (next.trim() === '') {
      setTerm('');
      return;
    }
    timerRef.current = setTimeout(() => setTerm(next.trim()), SEARCH_DEBOUNCE_MS);
  }, []);
  const clear = useCallback(() => setValue(''), [setValue]);

  return { value, setValue, term, clear };
}

export type ServerSearch = ReturnType<typeof useServerSearch>;
