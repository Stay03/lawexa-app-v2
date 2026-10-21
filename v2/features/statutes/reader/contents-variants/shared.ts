'use client';

import { useEffect, useRef, type RefObject } from 'react';

import type { OutlineHandle } from '../StatuteOutline';

/**
 * What every Contents design takes: the outline handle the rail and the sheet
 * already share (`outline`, `activeId`, `onJump`) and the open state the bar
 * button drives (`StatuteDocument` owns it). A design closes itself before it
 * jumps, exactly as `StatuteContentsSheet` does.
 */
export interface ContentsDesignProps extends OutlineHandle {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Centres the ref'd row in its list one frame after mount. A design's body
 * mounts when the panel opens (Radix Presence unmounts it closed), so this
 * runs on every open and starts the reader where they are rather than at
 * Part I. One frame so the surface exists and has height.
 */
export function useCentreOnMount<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return ref;
}

/**
 * Radix focuses the first focusable row on open, which for a long list is
 * Part I with the reader three Parts further on. This puts the focus on the
 * current row instead (or on the surface when there is none), without
 * scrolling: `useCentreOnMount` does the one scroll a frame later. For
 * `onOpenAutoFocus`, whose event is dispatched on the surface itself.
 */
export function focusCurrentOnOpen(event: Event): void {
  const surface = event.currentTarget;
  if (!(surface instanceof HTMLElement)) return;
  event.preventDefault();
  const current = surface.querySelector<HTMLElement>('[aria-current="location"]');
  (current ?? surface).focus({ preventScroll: true });
}

/** Left padding by nesting level (static class names, so Tailwind reads them
 *  from the source): a Chapter's Parts and a Part's lettered sub-divisions sit
 *  under their parent. Two levels is the most any of our Acts nests. */
export const DIVISION_PAD = ['pl-0', 'pl-4', 'pl-8'] as const;

export function nestingLevel(depth: number | undefined): 0 | 1 | 2 {
  const value = depth ?? 0;
  return value >= 2 ? 2 : value === 1 ? 1 : 0;
}
