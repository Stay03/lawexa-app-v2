'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The message box under an open question card, folded away until the reader
 * picks "Type my own answer" (Stay, 14 November 2026, c91086ec: "If the user
 * hasn't selected something else then don't show the text area"). It stays
 * mounted, so the reader's own draft and the box's handle survive: folded it
 * is out of reach (`inert`), and the card makes it reachable before it
 * focuses it, inside the tap, so a phone raises its keyboard. It opens and
 * folds in one frame, with the card's height (no animation to fight).
 */
export function CardBoxFold({ folded, children }: { folded: boolean; children: ReactNode }) {
  return (
    <div
      inert={folded}
      data-card-box-folded={folded ? '' : undefined}
      // No animation: the card gives the box its height in the same frame (the stack lock, card-height.ts),
      // so a fold that grew over 200ms would push the two apart and back (Stay: "jumpy").
      className={cn('grid shrink-0', folded ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100')}
    >
      {/* Clipped only while folded: open, the box's `@` picker floats above it and must not be cut off
          (it was, in every Space chat, from 14 November until this fix). */}
      <div className={cn('min-h-0', folded && 'overflow-hidden')}>{children}</div>
    </div>
  );
}
