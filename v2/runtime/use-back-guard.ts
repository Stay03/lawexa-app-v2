'use client';

import { useCallback, useEffect, useRef } from 'react';

import { quietPushStampedCopy, readHistoryStamp } from './url-params';

/** History-state key on the extra entry a guard adds. */
const GUARD_KEY = '__v2BackGuard';

/**
 * The device's Back, asked first (Stay, 23 October 2026: a filled-in New quiz
 * form asks "Discard changes?").
 *
 * WHY AN EXTRA ENTRY, NOT A REOPEN. The first build let Back close the form and
 * pushed its address again from the popstate to reopen it. Next's router
 * restores the popped entry after every listener has run and rewrites the top
 * entry to that address, so the push was undone and the form closed with what
 * was typed. Here, while `armed`, the page carries one extra entry with the
 * same address: Back takes only that step, nothing on the page moves, and
 * `onBack` asks. `rearm` adds the step again after "Keep editing".
 *
 * EVERY CLOSE GOES THROUGH `release`. With the step on top, a close that walks
 * back (the overlay's own entry) would take only the extra step and land on the
 * open form again; `release` takes that step first, then closes.
 */
export function useBackGuard(armed: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });
  /** A `release` walking off the extra step: that Back is not the reader's. */
  const releasingRef = useRef(false);

  const rearm = useCallback(() => {
    if (readHistoryStamp(GUARD_KEY) === null) quietPushStampedCopy({ [GUARD_KEY]: 'on' });
  }, []);

  useEffect(() => {
    if (!armed) return;
    rearm();
    const onPopState = () => {
      // Forward onto the step again, or our own release: not the reader leaving.
      if (releasingRef.current || readHistoryStamp(GUARD_KEY) !== null) return;
      onBackRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [armed, rearm]);

  const release = useCallback((then: () => void) => {
    if (readHistoryStamp(GUARD_KEY) === null) {
      then();
      return;
    }
    releasingRef.current = true;
    const onPopState = () => {
      window.removeEventListener('popstate', onPopState);
      releasingRef.current = false;
      then();
    };
    window.addEventListener('popstate', onPopState);
    window.history.back();
  }, []);

  return { rearm, release };
}
