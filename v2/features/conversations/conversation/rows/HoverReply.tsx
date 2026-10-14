'use client';

import { CornerUpLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * HoverReply — Reply on a question in a space chat, for a mouse or trackpad:
 * it rests hidden in the turn's name or time line and shows while the pointer
 * is over the turn, or while it has keyboard focus. A touch screen never shows
 * it; there the message is swiped or held instead (SwipeToReply).
 */
export function HoverReply({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'v2-interactive text-muted-foreground hover:text-foreground hidden items-center gap-1 rounded-md px-1.5 py-0.5 text-xs',
        'opacity-0 transition-opacity duration-150 group-hover/turn:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none',
        'pointer-fine:inline-flex',
        FOCUS_RING,
      )}
    >
      <CornerUpLeft aria-hidden className="size-3.5" />
      Reply
    </button>
  );
}
