'use client';

import { useState } from 'react';
import { Loader2, Maximize2, Monitor, Power, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserBoxDoneResult } from '@/types/user-box';
import { ChatSidePanel } from '@/v2/features/conversations/conversation/side-panel/ChatSidePanel';
import { HeldByNote, MachineControls } from './MachineControls';
import { MachineFullScreen } from './MachineFullScreen';
import { MachineScreen } from './MachineScreen';
import { machineFree } from './machine-model';
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
  const [full, setFull] = useState(false);
  const viewOnly = control?.who === 'lawexa';
  // Lawexa has it, but no chat is using it (a reply ended, or a chat freed it).
  const free = machineFree(machine.box);

  const subtitle =
    phase.kind !== 'live' || !control
      ? null
      : control.who === 'lawexa'
        ? free
          ? 'Not in use'
          : 'Lawexa is using it'
        : 'You are using it';

  const footer = phase.kind === 'live' && control ? <MachineControls machine={machine} /> : undefined;

  return (
    <ChatSidePanel
      label="Lawexa’s machine"
      title="Lawexa’s machine"
      subtitle={subtitle}
      icon={<Monitor aria-hidden className="size-4 text-muted-foreground" />}
      actions={
        phase.kind === 'live' && machine.viewUrl ? (
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Full screen" title="Full screen" onClick={() => setFull(true)}>
            <Maximize2 aria-hidden className="size-4" />
          </Button>
        ) : null
      }
      footer={footer}
    >
      {full && machine.viewUrl ? (
        <MachineFullScreen machine={machine} url={machine.viewUrl} viewOnly={viewOnly} free={free} onClose={() => setFull(false)} />
      ) : null}
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
          <>
            <HeldByNote holder={machine.box?.held_by ?? null} onRelease={machine.release} busy={machine.busy} />
            {/* One live view at a time: while full screen is open, the panel only says so. */}
            {full ? (
              <p className="flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Showing full screen
              </p>
            ) : (
              <MachineScreen url={machine.viewUrl} onLost={machine.reread} onMode={machine.noteMode} viewOnly={viewOnly} free={free} />
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Lawexa’s machine is not available.</p>
        )}
      </div>
    </ChatSidePanel>
  );
}
