'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Clock, Monitor } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useSidePanel } from '@/v2/features/conversations/conversation/side-panel/SidePanelContext';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useMinuteNow } from '@/v2/features/channels/use-minute-now';
import { useV2Session } from '@/v2/runtime/session-context';
import { handOverState, waitingLine } from './machine-model';
import { userBoxQueries } from './queries';

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
  const session = useV2Session();
  const params = useParams<{ conversationId?: string }>();
  const box = useQuery({ ...userBoxQueries.status({ viewerId: session.userId }), enabled: handOver }).data ?? null;
  if (!panel || (panel.target?.kind === 'machine' && !panel.closing)) return null;
  const open = () => panel.open({ kind: 'machine' });
  // "Press Done" only while Lawexa waits for Done in this chat; once the hand-over has moved on,
  // the step header and the wait-ended note already open the machine. Until the status arrives,
  // the plain way in below.
  const state = handOver ? handOverState(box, params?.conversationId ?? null) : null;
  if (state === 'over') return null;

  if (state === 'waiting') {
    return (
      <div className="ml-7">
      <button
        type="button"
        onClick={open}
        className={cn(
          'v2-interactive mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          FOCUS_RING,
        )}
      >
        <Monitor aria-hidden className="size-4" />
        Open the machine and press Done
      </button>
      <HandOverWait />
      </div>
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

/**
 * Under the hand-over button: how long Lawexa waits (Arthur's 3, thread
 * 38ad195b), from the machine's own state. Nothing once the wait is over.
 */
function HandOverWait() {
  const session = useV2Session();
  const now = useMinuteNow();
  const box = useQuery(userBoxQueries.status({ viewerId: session.userId })).data ?? null;
  const wait = box && box.control === 'user' && now > 0 ? waitingLine(box.waiting, now) : null;
  if (!wait) return null;
  return (
    <p
      className={cn(
        'mt-1.5 flex items-center gap-1.5 text-xs',
        wait.tone === 'reminded' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
      )}
    >
      <Clock aria-hidden className="size-3.5" />
      {wait.text}
    </p>
  );
}
