'use client';

import Link from 'next/link';
import { Hourglass } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { IBlockedReason } from '@/types/message-pack';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { outOfMessagesView } from './out-of-messages';

/**
 * OutOfMessagesStrip — the out-of-messages notice on the Home's message box,
 * as a thin strip joined to the top of the box (C4; Stay picked it 19 October
 * 2026, 20:12Z, over a notice card above the box). The question stays in the
 * box below it and Send waits, so the reader sees what they asked and the two
 * ways on in one place:
 *
 *   free used up     "Free messages used"       Buy pack · Upgrade
 *   plan used up     "Messages used for now"    Buy pack · Upgrade
 *                    "Back on 14 Nov 2026, 01:00" under it, when known
 *   plan ended       "Plan access ended"        Buy pack · Reactivate
 *   hard limit       "Usage limit reached"      the reset line only
 *
 * The words and doors are the shared notice's (`out-of-messages.ts`), in
 * their short form; a chat, Usage and New radar keep the full notice.
 *
 * The strip bleeds to the card's edges with the card's own padding
 * (`-mx-2.5 -mt-2.5`): every host of the Home box passes `p-2.5`.
 */
export function OutOfMessagesStrip({ blocked }: { blocked: IBlockedReason }) {
  const view = outOfMessagesView({ blocked });
  // The filled door reads last, at the strip's end, as in the picked mockup.
  const doors = [...view.actions].reverse();

  return (
    <div
      role="status"
      onClick={(event) => event.stopPropagation()}
      className="-mx-2.5 -mt-2.5 mb-2 flex items-center justify-between gap-3 rounded-t-3xl border-b border-border bg-secondary/50 px-4 py-2.5 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <span className="flex min-w-0 items-start gap-2 text-foreground">
        <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate">{view.short}</span>
          {view.resetShort ? (
            <span className="block truncate text-xs text-muted-foreground tabular-nums">
              {view.resetShort}
            </span>
          ) : null}
        </span>
      </span>
      {doors.length > 0 ? (
        <span className="flex shrink-0 items-center gap-3">
          {doors.map((door) => (
            <Link
              key={door.label}
              href={door.href}
              className={cn(
                'whitespace-nowrap rounded-sm',
                door.primary
                  ? 'font-semibold text-primary hover:underline underline-offset-4'
                  : 'text-muted-foreground hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {door.shortLabel}
            </Link>
          ))}
        </span>
      ) : null}
    </div>
  );
}
