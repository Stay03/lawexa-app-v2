'use client';

import { useState } from 'react';
import { History } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/v2/shell/designs/modules';

/**
 * RestoreDraftBar — the ONE place a device-held draft is ever offered.
 *
 * ── AN OFFER, IN LINE, NOT A MODAL ──────────────────────────────────────────
 * A modal would block the note behind it and force a decision before the reader
 * can even see what they are choosing between. This sits above the title, shows
 * WHEN the local copy was written, and leaves the server's version on screen and
 * fully editable underneath — so "Restore" and "Discard" are a comparison, not a
 * guess. Nothing is applied until one of them is pressed; that is the whole
 * contract of the mirror (`draft-mirror.ts`).
 *
 * The timestamp is not decoration: it is what tells someone whether the local
 * copy is the sentence they lost a minute ago or a version from last week.
 */
export function RestoreDraftBar({
  savedAt,
  onRestore,
  onDiscard,
}: {
  /** ISO time the device copy was written. */
  savedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  // Lazy initializer: `Date.now()` must never run in a render body (React
  // Compiler lint). One reading is right — this bar is dismissed in seconds.
  const [now] = useState(() => Date.now());
  const relative = formatRelativeTime(savedAt, now);
  const when = relative === '' || relative === 'now' ? 'a moment ago' : `${relative} ago`;

  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300',
      )}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <History className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-foreground">
        Unsaved changes from {when} are still on this device.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={onRestore}>
          Restore
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  );
}
