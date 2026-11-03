'use client';

import { Monitor } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useSidePanel } from '@/v2/features/conversations/conversation/side-panel/SidePanelContext';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/** The step that hands the machine to the person (Userbox v1). */
export const HAND_OVER_TOOL = 'box_hand_to_user';

/**
 * The way into Lawexa's machine from the chat (Userbox v1; the techlead's
 * review of ca6cbedf): on the header line of every step Lawexa took on it, so
 * it shows without opening the step, and, on the step that hands the machine
 * over, a full button under it, since Lawexa's answer then tells the person
 * to press Done there. Nothing outside a chat's side panel (a card drawn
 * elsewhere opens nothing), and nothing while the machine's panel is open.
 */
export function OpenMachineButton({ handOver = false }: { handOver?: boolean }) {
  const panel = useSidePanel();
  if (!panel || (panel.target?.kind === 'machine' && !panel.closing)) return null;
  const open = () => panel.open({ kind: 'machine' });

  if (handOver) {
    return (
      <button
        type="button"
        onClick={open}
        className={cn(
          'v2-interactive mt-2 ml-7 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          FOCUS_RING,
        )}
      >
        <Monitor aria-hidden className="size-4" />
        Open the machine and press Done
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open Lawexa’s machine"
      title="Open Lawexa’s machine"
      className={cn(
        'v2-interactive flex min-h-6 shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground',
        FOCUS_RING,
      )}
    >
      <Monitor aria-hidden className="size-3.5" />
      <span>Open machine</span>
    </button>
  );
}
