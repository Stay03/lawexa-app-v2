'use client';

import { Hand, Loader2, Monitor, Power, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBoxDoneResult } from '@/types/user-box';
import { ChatSidePanel } from '@/v2/features/conversations/conversation/side-panel/ChatSidePanel';
import { YOU_HAVE_THE_MACHINE } from './machine-model';
import { MachineScreen } from './MachineScreen';
import { useMachine } from './use-machine';

/**
 * MachinePanel — "Lawexa's machine" in the chat's side panel (Userbox v1,
 * thread f09347fd; staff, Researcher and above): the live view of the
 * browser Lawexa drives with its box_* tools, who drives it now, and the two
 * buttons that move control.
 *
 *   Lawexa drives    "Take over": the person drives (the server also hands it
 *                    to the person as soon as they act on the view)
 *   the person       "Done": Lawexa drives again; when Lawexa handed over,
 *                    its request shows above the button, and Done continues
 *                    the chat that was waiting ("Waiting for you, press Done").
 *                    A message the person types gives it back too, with no
 *                    Done (card 9bab169f); the broadcast moves the panel.
 *
 * Opening the panel wakes the machine ("Starting…" until it is awake); one
 * that went to sleep offers Wake. With the machines off, or for an account
 * that may not use one, the panel says it is not available and shows nothing
 * else.
 */
export function MachinePanel({ onResumed }: { onResumed: (result: UserBoxDoneResult) => void }) {
  const machine = useMachine({ onResumed });
  const { phase, control } = machine;

  const subtitle =
    phase.kind !== 'live' || !control ? null : control.who === 'lawexa' ? 'Lawexa is using it' : 'You are using it';

  const footer =
    phase.kind === 'live' && control ? (
      control.who === 'lawexa' ? (
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Lawexa is using the machine. You can take over at any time.</p>
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={machine.busy} onClick={machine.takeOver}>
            <Hand aria-hidden className="size-4" />
            Take over
          </Button>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-foreground">
            {control.reason === 'hand_over' ? control.message : YOU_HAVE_THE_MACHINE}
          </p>
          <Button type="button" size="sm" className="shrink-0" disabled={machine.busy} onClick={machine.done}>
            {machine.busy ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : null}
            Done
          </Button>
        </div>
      )
    ) : undefined;

  return (
    <ChatSidePanel
      label="Lawexa’s machine"
      title="Lawexa’s machine"
      subtitle={subtitle}
      icon={<Monitor aria-hidden className="size-4 text-muted-foreground" />}
      footer={footer}
    >
      <div className="p-4 xl:p-5">
        {phase.kind === 'loading' ? (
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
        ) : phase.kind === 'starting' ? (
          <div className="relative">
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
            <span role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
              Starting Lawexa’s machine
            </span>
          </div>
        ) : phase.kind === 'asleep' ? (
          <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted px-6 text-center">
            <p className="text-sm text-muted-foreground">{phase.problem ?? 'Lawexa’s machine is asleep.'}</p>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={machine.wake}>
              <Power aria-hidden className="size-4" />
              Wake
            </Button>
          </div>
        ) : phase.kind === 'error' ? (
          <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted px-6 text-center">
            <p className="text-sm text-muted-foreground">{phase.message}</p>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={machine.reread}>
              <RotateCw aria-hidden className="size-4" />
              Try again
            </Button>
          </div>
        ) : phase.kind === 'hidden' ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Lawexa’s machine is not available.</p>
        ) : machine.viewUrl ? (
          <MachineScreen url={machine.viewUrl} onLost={machine.reread} onMode={machine.noteMode} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Lawexa’s machine is not available.</p>
        )}
      </div>
    </ChatSidePanel>
  );
}
