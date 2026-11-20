'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Clock, Hand, Loader2, MessagesSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UserBoxHolder } from '@/types/user-box';
import { useMinuteNow } from '@/v2/features/channels/use-minute-now';
import { inUseLine, waitingLine, YOU_HAVE_THE_MACHINE } from './machine-model';
import type { useMachine } from './use-machine';

type Machine = ReturnType<typeof useMachine>;

/**
 * Who drives Lawexa's machine, and the one button that moves it (thread
 * 38ad195b): "Take over" while Lawexa works (the screen is view-only then,
 * Arthur's 1a), and Done while the person has it. After a hand-over, how long
 * Lawexa waits (Arthur's 3: a reminder at 10 minutes, it stops at 30). Shared
 * by the side panel's footer and the full-screen view's bar.
 */
export function MachineControls({ machine, compact = false }: { machine: Machine; compact?: boolean }) {
  const now = useMinuteNow();
  const { control } = machine;
  if (!control) return null;

  if (control.who === 'lawexa') {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <p className={cn('min-w-0 text-xs text-muted-foreground', compact && 'max-sm:sr-only')}>
          Lawexa is using the machine. The screen is view-only until you take over.
        </p>
        <Button type="button" size="sm" className="shrink-0 gap-1.5" disabled={machine.busy} onClick={machine.takeOver}>
          <Hand aria-hidden className="size-4" />
          Take over
        </Button>
      </div>
    );
  }

  const wait = control.reason === 'hand_over' && now > 0 ? waitingLine(machine.box?.waiting, now) : null;
  return (
    <div className="flex w-full flex-col gap-2">
      {wait ? (
        <p
          role={wait.tone === 'reminded' ? 'status' : undefined}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
            wait.tone === 'reminded'
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200'
              : 'text-muted-foreground',
          )}
        >
          <Clock aria-hidden className="size-3.5 shrink-0" />
          {wait.text}
        </p>
      ) : null}
      <div className="flex w-full items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-foreground">{control.reason === 'hand_over' ? control.message : YOU_HAVE_THE_MACHINE}</p>
        <Button type="button" size="sm" className="shrink-0" disabled={machine.busy} onClick={machine.done}>
          {machine.busy ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : null}
          Done
        </Button>
      </div>
    </div>
  );
}

/**
 * Over the screen, when another chat holds the machine (Arthur's 5: one chat
 * at a time): which chat, a way there, and "Free it" to use it here.
 */
export function HeldByNote({ holder, onRelease, busy }: { holder: UserBoxHolder | null; onRelease: () => void; busy: boolean }) {
  const params = useParams<{ conversationId?: string }>();
  // The chat that holds the machine sees no note about itself.
  if (!holder || holder.conversation_uuid === params?.conversationId) return null;
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100">
      <p>{inUseLine(holder.title)}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="gap-1.5 bg-background">
          <Link href={`/c/${holder.conversation_uuid}`}>
            <MessagesSquare aria-hidden className="size-4" />
            Open that chat
          </Link>
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onRelease}>
          Free it and use it here
        </Button>
      </div>
    </div>
  );
}
