'use client';

import { useCallback, useRef } from 'react';

/**
 * use-long-press — the touch half of the row-actions contract: hover actions
 * on pointer-fine, a long-press bottom sheet on touch (design-research
 * DIRECTION 5; standards §4 "message actions = hover toolbar on pointer-fine
 * + long-press bottom sheet on touch"). Phase-5 W2, 2026-08-04.
 *
 * Deliberately narrow: fires ONLY for `pointerType === 'touch'` (a mouse
 * held down is a drag-select, not a request for a sheet), cancels on >10px
 * movement (the user is scrolling), on pointer up/cancel, and on scroll
 * capture. All state lives in refs — no render work, no effects.
 *
 * ── THE ARMED STATE IS A DOM STAMP, NOT REACT STATE (owner round, Aug 4) ───
 * `data-holding` goes straight onto the pressed node, exactly as the feed
 * stamps `data-flash` for a deep-link wash. A `useState` here would re-render a
 * memoised row — and every row above it in the group — for a 450ms tint.
 *
 * ── WHAT THIS FILE CANNOT DO ALONE ────────────────────────────────────────
 * The native iOS selection that used to come up WITH the sheet is not stopped
 * here. iOS decides at the START of the gesture whether the text is selectable,
 * so nothing armed at the 450ms mark can help; the rule is static CSS, in
 * `shell.css`'s `.v2-touch-hold`. This hook only clears a selection that was
 * already on screen when the press fired.
 */

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;
/** A single short tick — the platform "something happened" pulse. Android
 *  only; iOS Safari exposes no Vibration API, hence the optional call. */
const HAPTIC_MS = 10;
/** Marks the pressed row while the hold is armed. Read by the row's own
 *  `data-holding:` variant, never by React. */
const HOLDING_ATTRIBUTE = 'data-holding';

export interface LongPressHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function useLongPress(onLongPress: () => void): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  /** The pressed node. Captured in the handler because React nulls
   *  `currentTarget` the moment the handler returns. */
  const nodeRef = useRef<HTMLElement | null>(null);

  const disarm = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
    nodeRef.current?.removeAttribute(HOLDING_ATTRIBUTE);
    nodeRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'touch') return;
      firedRef.current = false;
      originRef.current = { x: event.clientX, y: event.clientY };
      const node = event.currentTarget;
      nodeRef.current = node;
      node.setAttribute(HOLDING_ATTRIBUTE, '');
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        node.removeAttribute(HOLDING_ATTRIBUTE);
        nodeRef.current = null;
        originRef.current = null;
        // A selection made BEFORE this press (a pointer-fine session on a
        // hybrid device, or an engine that ignored the static rule) would sit
        // highlighted under the sheet. Cleared in the event path rather than an
        // effect: by the time an effect ran the sheet would already be over it.
        window.getSelection()?.removeAllRanges();
        navigator.vibrate?.(HAPTIC_MS);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const origin = originRef.current;
      if (!origin || timerRef.current === null) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) disarm();
    },
    [disarm],
  );

  const onContextMenu = useCallback((event: React.MouseEvent) => {
    // A completed long-press on some Android browsers also synthesises a
    // contextmenu — swallow it so the sheet isn't immediately covered.
    if (firedRef.current) {
      event.preventDefault();
      firedRef.current = false;
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: disarm,
    onPointerCancel: disarm,
    onContextMenu,
  };
}
