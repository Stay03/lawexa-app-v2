'use client';

import { createContext } from 'react';

/**
 * The ask dock's resting height, handed from the statute screen to the
 * Contents pill, which stands 1.5rem above the dock.
 *
 * WRITTEN ON THE PILL, NEVER ON A PARENT OF THE TEXT (18 October 2026). The
 * height used to be a custom property on the reading column, and a custom
 * property inherits: every write restyled the whole statute under it. The dock
 * reports its height on every frame while it grows and shrinks, and on the
 * ACJL (1194 parts, WebKit) one write cost about 240 ms, so opening and closing
 * the phone chat froze the page for tens of seconds. Here the one element that
 * reads the height gets it as its own `bottom`, outside React (the dock reports
 * from a ResizeObserver, which must not set state).
 */
export interface DockClearance {
  /** The dock's current height in px (0 with no dock). */
  set: (height: number) => void;
  /** Ref callback for the pill's sticky wrapper. */
  attach: (element: HTMLElement | null) => void;
}

/** The gap the pill keeps above the dock. */
const GAP = '1.5rem';

export function createDockClearance(): DockClearance {
  let height = 0;
  let target: HTMLElement | null = null;
  const paint = () => {
    target?.style.setProperty('bottom', `calc(${height}px + ${GAP})`);
  };
  return {
    set: (next) => {
      if (next === height) return;
      height = next;
      paint();
    },
    attach: (element) => {
      target = element;
      paint();
    },
  };
}

/** Null outside the statute screen: the pill then keeps the bare gap (`bottom-6`). */
export const DockClearanceContext = createContext<DockClearance | null>(null);
