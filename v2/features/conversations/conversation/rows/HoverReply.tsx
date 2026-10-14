'use client';

import { CornerUpLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * HoverReply — Reply on a question in a space chat, for a mouse or trackpad:
 * it rests hidden in the turn's name or time line and shows while the pointer
 * is over the turn, or while it has keyboard focus. On a touch screen it is
 * not drawn (the message is swiped or held instead, SwipeToReply) but stays in
 * the page, so VoiceOver and TalkBack still reach it, and it shows when focused.
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
        'v2-interactive text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs',
        'opacity-0 transition-opacity duration-150 group-hover/turn:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none',
        // Touch: out of the layout, still in the accessibility tree; back when focused.
        'pointer-coarse:not-focus-visible:sr-only',
        FOCUS_RING,
      )}
    >
      <CornerUpLeft aria-hidden className="size-3.5" />
      Reply
    </button>
  );
}
