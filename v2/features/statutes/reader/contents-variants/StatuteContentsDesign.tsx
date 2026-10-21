'use client';

import { ContentsDesignA } from './ContentsDesignA';
import { ContentsDesignB } from './ContentsDesignB';
import { ContentsDesignC } from './ContentsDesignC';
import type { ContentsVariant } from './contents-model';
import type { ContentsDesignProps } from './shared';

/**
 * The Contents design the address picked (`?contents=a|b|c`), opened by the
 * same bar button as today's sheet, over the same outline, active mark and
 * jump. Finding 10, prototype: Stay films the three and keeps one; the
 * other two are deleted with this folder, and `StatuteDocument` goes back
 * to rendering `StatuteContentsSheet` alone (or the winner in its place).
 *
 *   a  "where you are": a bottom sheet on a phone, a popover under the bar
 *      button on a computer; the current Part open, the rest folded, a
 *      progress line across the top.
 *   b  "jump to": a centred panel with a search field that narrows the
 *      sections by number or title as you type, grouped by Part.
 *   c  "printed contents": a full-height panel on the right edge (a
 *      drop-down from the top on a phone), set like a printed Act's table
 *      of contents: small-capital Part names, dotted leaders, numbers in a
 *      tabular column.
 */
export function StatuteContentsDesign({
  variant,
  ...props
}: ContentsDesignProps & { variant: ContentsVariant }) {
  switch (variant) {
    case 'a':
      return <ContentsDesignA {...props} />;
    case 'b':
      return <ContentsDesignB {...props} />;
    case 'c':
      return <ContentsDesignC {...props} />;
  }
}
