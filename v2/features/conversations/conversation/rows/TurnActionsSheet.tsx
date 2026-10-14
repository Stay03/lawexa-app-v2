'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, CornerUpLeft } from 'lucide-react';
import type { MessageReplyTo } from '@/types/chat';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/** The message a long press opened the sheet for. */
export interface HeldTurn {
  /** What a reply to it quotes. */
  target: MessageReplyTo;
  /** Its full text, for Copy text. */
  content: string;
  /** Whose it is, for the sheet's title ("You", a name, "Lawexa"). */
  label: string;
}

/** How long "Copied" shows before the sheet closes itself. */
const COPIED_HOLD_MS = 700;

/**
 * TurnActionsSheet — the touch half of a space chat message's actions: one
 * bottom sheet per transcript, opened by a long press on a question (Reply,
 * Copy text). Ported from the channel feed's MessageActionsSheet, with only the
 * verbs a chat message has. A long press suppresses the platform's selection
 * on the row (`v2-touch-hold`), so Copy text gives the words back whole.
 */
export function TurnActionsSheet({
  held,
  onReply,
  onClose,
}: {
  held: HeldTurn | null;
  onReply: (target: MessageReplyTo) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={held !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="v2-safe-bottom rounded-t-2xl">
        <SheetHeader className="pb-0">
          <SheetTitle className="text-muted-foreground truncate text-sm">{held?.label ?? ''}</SheetTitle>
        </SheetHeader>
        {held && (
          <div className="flex flex-col px-2 pb-2">
            <SheetAction
              label="Reply"
              onClick={() => {
                onClose();
                onReply(held.target);
              }}
            >
              <CornerUpLeft aria-hidden className="size-4" />
            </SheetAction>
            <CopyTextAction key={held.target.id} content={held.content} onDone={onClose} />
            <Button type="button" variant="outline" className="mt-2 min-h-11 w-full" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CopyTextAction({ content, onDone }: { content: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Clipboard refused: close without claiming a copy that did not happen.
      onDone();
      return;
    }
    setCopied(true);
    timerRef.current = setTimeout(onDone, COPIED_HOLD_MS);
  };

  return (
    <SheetAction
      label={copied ? 'Copied' : 'Copy text'}
      onClick={() => {
        if (!copied) void copy();
      }}
    >
      {copied ? <Check aria-hidden className="text-primary size-4" /> : <Copy aria-hidden className="size-4" />}
    </SheetAction>
  );
}

function SheetAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'v2-interactive text-foreground flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm font-medium',
        'transition-colors duration-150 motion-reduce:transition-none',
        FOCUS_RING,
      )}
    >
      {children}
      {label}
    </button>
  );
}
