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
 */

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

export interface LongPressHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function useLongPress(onLongPress: () => void): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      firedRef.current = false;
      originRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const origin = originRef.current;
      if (!origin || timerRef.current === null) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
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
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu,
  };
}
