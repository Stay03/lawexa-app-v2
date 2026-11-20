'use client';

import { Minimize2, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MachineControls } from './MachineControls';
import { MachineScreen } from './MachineScreen';
import type { useMachine } from './use-machine';

/**
 * Lawexa's machine at the size of the window (thread 38ad195b: the full-screen
 * view from the earlier machine thread, redone on the current panel). The
 * same live view, as large as the window allows at the display's 16:10 shape,
 * with who drives and the one button that moves it in a bar above. Escape or
 * "Exit full screen" goes back to the side panel; the view and control are
 * the same in both.
 */
export function MachineFullScreen({
  machine,
  url,
  viewOnly,
  free,
  onClose,
}: {
  machine: ReturnType<typeof useMachine>;
  url: string;
  viewOnly: boolean;
  /** Lawexa has it and no chat is using it. */
  free: boolean;
  onClose: () => void;
}) {
  const who = machine.control?.who === 'you' ? 'You are using it' : free ? 'Not in use' : 'Lawexa is using it';
  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 sm:px-6">
          <Monitor aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold">Lawexa’s machine</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">{who}</DialogDescription>
          </div>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
            <div className="hidden max-w-xl flex-1 md:block">
              <MachineControls machine={machine} />
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onClose}>
              <Minimize2 aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Exit full screen</span>
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/40 p-3 sm:p-6">
          {/* As wide as the window, and never taller than it: the 16:10 display fits whole. */}
          <MachineScreen
            url={url}
            onLost={machine.reread}
            onMode={machine.noteMode}
            viewOnly={viewOnly}
            free={free}
            className="w-full max-w-[calc((100dvh-9rem)*1.6)]"
          />
        </div>
        <div className="border-t border-border px-4 py-3 md:hidden">
          <MachineControls machine={machine} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
