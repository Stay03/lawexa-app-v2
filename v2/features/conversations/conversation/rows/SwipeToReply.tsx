'use client';

import { CornerUpLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLongPress } from '@/v2/features/channels/feed/use-long-press';
import { useSwipeReply } from './use-swipe-reply';

const NO_PRESS = () => {};

/**
 * SwipeToReply — the touch gestures of a message in a space chat: drag it to
 * the right to reply (use-swipe-reply.ts), and, where `onLongPress` is given,
 * hold it for the actions sheet (the channel feed's use-long-press.ts, so the
 * two surfaces hold the same way). A mouse gets neither; it has the hover
 * Reply instead.
 *
 * With no `onReply` (a personal chat, a reader who may not send, a row not
 * saved yet) it renders its children and nothing else.
 */
export function SwipeToReply({
  onReply,
  onLongPress,
  children,
}: {
  onReply: (() => void) | null;
  onLongPress?: () => void;
  children: React.ReactNode;
}) {
  const { handlers: s, moverRef, glyphRef } = useSwipeReply(onReply);
  const press = useLongPress(onLongPress ?? NO_PRESS);

  if (!onReply) return <>{children}</>;

  const holds = onLongPress !== undefined;
  return (
    <div
      className={cn(
        'relative touch-pan-y',
        // The hold suppresses the iOS callout and selection (shell.css), as on a
        // channel message; the sheet's Copy text gives the words back.
        holds && 'v2-touch-hold rounded-2xl transition-colors duration-150 data-holding:bg-muted/60',
      )}
      onPointerDown={(event) => {
        s.onPointerDown(event);
        if (holds) press.onPointerDown(event);
      }}
      onPointerMove={(event) => {
        s.onPointerMove(event);
        if (holds) press.onPointerMove(event);
      }}
      onPointerUp={() => {
        s.onPointerUp();
        if (holds) press.onPointerUp();
      }}
      onPointerCancel={() => {
        s.onPointerCancel();
        if (holds) press.onPointerCancel();
      }}
      onClickCapture={(event) => {
        s.onClickCapture(event);
        if (holds) press.onClickCapture(event);
      }}
      onContextMenu={holds ? press.onContextMenu : undefined}
    >
      <span
        ref={glyphRef}
        aria-hidden
        className="bg-muted text-muted-foreground pointer-events-none absolute top-1/2 left-0 -mt-4 flex size-8 items-center justify-center rounded-full opacity-0"
        style={{ transform: 'scale(0.6)' }}
      >
        <CornerUpLeft className="size-4" />
      </span>
      <div ref={moverRef}>{children}</div>
    </div>
  );
}
