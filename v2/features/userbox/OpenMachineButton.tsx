'use client';

import { Monitor } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useSidePanel } from '@/v2/features/conversations/conversation/side-panel/SidePanelContext';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * "Open Lawexa's machine", under a step Lawexa took on it (a box_* tool,
 * Userbox v1): the way into the live view from the chat. Nothing outside a
 * chat's side panel (a card drawn elsewhere opens nothing), and nothing while
 * the machine's panel is already open.
 */
export function OpenMachineButton() {
  const panel = useSidePanel();
  if (!panel || (panel.target?.kind === 'machine' && !panel.closing)) return null;
  return (
    <button
      type="button"
      onClick={() => panel.open({ kind: 'machine' })}
      className={cn(
        'v2-interactive mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary',
        FOCUS_RING,
      )}
    >
      <Monitor aria-hidden className="size-3.5" />
      Open Lawexa’s machine
    </button>
  );
}
