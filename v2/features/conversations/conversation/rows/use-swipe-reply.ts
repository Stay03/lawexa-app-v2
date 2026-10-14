'use client';

import { useCallback, useRef } from 'react';

/**
 * use-swipe-reply — WhatsApp's swipe-to-reply on a touch screen (Stay, 14
 * October 2026). A finger drags a message to the right; the message follows it
 * and a reply arrow fades in behind; let go past {@link SWIPE_REPLY_PX} and the
 * message becomes the reply target (with a short buzz where the phone has one),
 * and it springs back either way.
 *
 * Touch only: a mouse drag is a text selection. The row carries
 * `touch-action: pan-y`, so the browser keeps the vertical scroll and hands the
 * horizontal drag to these handlers; a drag that turns vertical first is a
 * scroll, and the browser cancels the pointer. A drag that starts at the left
 * edge of the screen is left alone: on an iPhone that is the swipe back.
 *
 * Like `use-long-press.ts` (the channel feed's, which this coexists with) the
 * moving state is written straight onto the DOM, never into React state, so a
 * memoised row does not re-render on every frame of the drag.
 */

/** How far the drag goes before letting go means "reply". */
export const SWIPE_REPLY_PX = 56;
/** A drag that moves this far vertically before it moves sideways is a scroll. */
const VERTICAL_SLOP_PX = 10;
/** Sideways movement before the message starts to follow. */
const HORIZONTAL_SLOP_PX = 8;
/** iOS's back swipe starts here; a drag from inside it is not ours. */
const EDGE_GUARD_PX = 24;
/** The furthest the message moves, with the drag past the threshold damped. */
const MAX_SHIFT_PX = 88;
const HAPTIC_MS = 10;

/** How far the message moves for a drag of `dx`: one to one up to the threshold, then damped. */
export function swipeShift(dx: number): number {
  if (dx <= 0) return 0;
  if (dx <= SWIPE_REPLY_PX) return dx;
  return Math.min(MAX_SHIFT_PX, SWIPE_REPLY_PX + (dx - SWIPE_REPLY_PX) * 0.35);
}

export interface SwipeReplyBindings {
  /** Spread on the row that is dragged. */
  handlers: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onClickCapture: (event: React.MouseEvent) => void;
  };
  /** The part that follows the finger. */
  moverRef: React.RefObject<HTMLDivElement | null>;
  /** The reply arrow behind it. */
  glyphRef: React.RefObject<HTMLSpanElement | null>;
}

export function useSwipeReply(onReply: (() => void) | null): SwipeReplyBindings {
  const moverRef = useRef<HTMLDivElement | null>(null);
  const glyphRef = useRef<HTMLSpanElement | null>(null);
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const engagedRef = useRef(false);
  const armedRef = useRef(false);
  /** One click to eat: the one that can follow a finished drag. */
  const swallowRef = useRef(false);

  const settle = useCallback(() => {
    startRef.current = null;
    engagedRef.current = false;
    armedRef.current = false;
    const mover = moverRef.current;
    if (mover) {
      mover.style.transition = 'transform 200ms ease-out';
      mover.style.transform = '';
    }
    const glyph = glyphRef.current;
    if (glyph) {
      glyph.style.opacity = '0';
      glyph.style.transform = 'scale(0.6)';
    }
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      swallowRef.current = false;
      if (!onReply || event.pointerType !== 'touch' || event.clientX < EDGE_GUARD_PX) return;
      startRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
      engagedRef.current = false;
      armedRef.current = false;
    },
    [onReply],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!engagedRef.current) {
        if (Math.abs(dy) > VERTICAL_SLOP_PX) {
          startRef.current = null;
          return;
        }
        if (dx < HORIZONTAL_SLOP_PX) return;
        engagedRef.current = true;
        if (moverRef.current) moverRef.current.style.transition = 'none';
      }
      const mover = moverRef.current;
      if (mover) mover.style.transform = `translateX(${swipeShift(dx)}px)`;
      const glyph = glyphRef.current;
      if (glyph) {
        const progress = Math.max(0, Math.min(1, dx / SWIPE_REPLY_PX));
        glyph.style.opacity = String(progress);
        glyph.style.transform = `scale(${0.6 + 0.4 * progress})`;
      }
      if (!armedRef.current && dx >= SWIPE_REPLY_PX) {
        armedRef.current = true;
        // Android only; iOS Safari has no Vibration API.
        navigator.vibrate?.(HAPTIC_MS);
      } else if (armedRef.current && dx < SWIPE_REPLY_PX) {
        armedRef.current = false;
      }
    },
    [],
  );

  const onPointerUp = useCallback(() => {
    if (engagedRef.current) swallowRef.current = true;
    if (engagedRef.current && armedRef.current) onReply?.();
    settle();
  }, [onReply, settle]);

  const onPointerCancel = useCallback(() => settle(), [settle]);

  const onClickCapture = useCallback((event: React.MouseEvent) => {
    if (!swallowRef.current) return;
    swallowRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
    moverRef,
    glyphRef,
  };
}
