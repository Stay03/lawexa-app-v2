'use client';

import { createContext, type RefObject } from 'react';

/**
 * What MessageList tells the answers it draws, so an answer may defer its
 * first blocks on an open and keep the reader's place when they swap
 * (defer-plan.ts, scroll-keep.ts). Outside MessageList there is no provider,
 * and an answer then parses whole.
 */
export interface ScrollKeep {
  /** The transcript's scroller. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Whether the reader is at the bottom now (the scroll handler keeps it). */
  atBottomRef: RefObject<boolean>;
  /** The browser holds the reader's place by itself (useScrollAnchoring). */
  anchoring: boolean;
  /** A row mounting now lands at the bottom of an open (openDefersBlocks). */
  landsAtBottom: boolean;
  /** Applies a scrollCorrection result to the scroller, which MessageList owns. */
  keepPlace: (fix: number | 'bottom') => void;
}

export const ScrollKeepContext = createContext<ScrollKeep | null>(null);
