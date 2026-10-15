'use client';

import { cn } from '@/lib/utils';
import { memberStyle } from '../member-colour';
import type { QuoteTone } from '../reply-target';

/**
 * QuoteFrame — the shape of a quoted message, as WhatsApp draws it (Stay, 15
 * October 2026, on the old thick grey edge that curved round the corner: "I
 * don't like it. It looks weird fix it"): a rounded box that clips, and inside
 * it a straight 4 px bar flush on its left edge, full height, in the quoted
 * person's colour, with their name in the same colour. Lawexa's is gold; a
 * withheld writer ("Someone") plain grey. The bubble's quote and the composer's
 * quote bar both draw through it, so the two always match.
 */

/** The bar and the name, per tone. */
const BAR = {
  member: 'bg-[var(--member-ink)] dark:bg-[var(--member-ink-dark)]',
  lawexa: 'bg-primary',
  plain: 'bg-foreground/30',
} as const;
const NAME = {
  member: 'text-[var(--member-ink)] dark:text-[var(--member-ink-dark)]',
  lawexa: 'text-primary',
  plain: 'text-foreground',
} as const;

function toneKind(tone: QuoteTone): keyof typeof BAR {
  return typeof tone === 'number' ? 'member' : tone;
}

export function QuoteFrame({
  tone,
  name,
  children,
  className,
}: {
  tone: QuoteTone;
  /** Who wrote the quoted message, in the tone's colour. */
  name: React.ReactNode;
  /** The quoted words (or "Message unavailable"). */
  children: React.ReactNode;
  className?: string;
}) {
  const kind = toneKind(tone);
  return (
    <span
      className={cn('flex w-full min-w-0 overflow-hidden rounded-xl text-left text-xs', className)}
      // The quoted person's colour, set on the quote alone: the bubble around it keeps its own.
      style={typeof tone === 'number' ? memberStyle(tone) : undefined}
    >
      <span aria-hidden data-quote-bar="" className={cn('w-1 shrink-0 self-stretch', BAR[kind])} />
      <span className="flex min-w-0 flex-1 flex-col px-3 py-1.5">
        <span className={cn('truncate font-semibold', NAME[kind])}>{name}</span>
        {children}
      </span>
    </span>
  );
}
