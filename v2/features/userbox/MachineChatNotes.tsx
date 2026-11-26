'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2, MessagesSquare, Monitor } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { userBoxApi } from '@/lib/api/user-box';
import { extractApiError } from '@/lib/utils/api-error';
import { useV2ChatContext } from '@/v2/features/conversations/conversation/chat-context';
import { useReadOnlyTranscript } from '@/v2/features/conversations/conversation/read-only';
import { useSidePanel } from '@/v2/features/conversations/conversation/side-panel/SidePanelContext';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  CARRIED_ON_LINE,
  FREED_CARD_LINE,
  inUseCardState,
  inUseLine,
  noLongerInUseLine,
  releaseRefusal,
  splitRelease,
} from './machine-model';
import { landUserBox, userBoxQueries } from './queries';
import { reasonOf } from './use-machine';

/**
 * Under an answer that met Lawexa's machine held by another chat (Arthur's 5,
 * thread 38ad195b; `metadata.machine_in_use`): which chat has it, a way there,
 * and "Free it and use it here". Freeing carries this chat on (Arthur's a,
 * 20 November 2026): the release names this chat, the server continues its
 * turn the way Done continues a waiting chat, and the screen follows it. A 409
 * means that chat is still answering, and says so.
 *
 * Once that chat no longer holds the machine (freed here or elsewhere, Done,
 * the 30-minute stop) the card is a plain line with no buttons, after a
 * reload too (Lucy's live test, 20 November 2026).
 */
export function MachineInUseCard({ holder }: { holder: { conversation_uuid: string; title: string } }) {
  const queryClient = useQueryClient();
  const session = useV2Session();
  const chat = useV2ChatContext();
  // Staff reading the person's chat (read-only.tsx): the person's line as they saw it, with nothing to press;
  // the machine read here would be the staff member's own, and "Free it" would free theirs.
  const readOnly = useReadOnlyTranscript();
  const box = useQuery({ ...userBoxQueries.status({ viewerId: session.userId }), enabled: !readOnly }).data ?? null;
  const [carriedOn, setCarriedOn] = useState(false);
  const release = useMutation({
    mutationFn: () => userBoxApi.release(chat?.conversationId),
    onSuccess: (answer) => {
      if (!answer.data) return;
      const { status, resumedTurn } = splitRelease(answer.data);
      landUserBox(queryClient, status);
      if (resumedTurn && chat && (resumedTurn.conversationUuid ?? chat.conversationId) === chat.conversationId) {
        setCarriedOn(true);
        chat.followResumedTurn(resumedTurn.executionId);
      } else {
        toast.success(FREED_CARD_LINE);
      }
    },
    onError: (error) => {
      const { status, message } = extractApiError(error);
      const refusal = releaseRefusal(status, reasonOf(error), message, holder.title);
      // Freed, but this chat did not carry on (no balance, a confidential chat, its own send):
      // read the machine again, and the card turns into its plain line.
      if (refusal.machineFreed) void queryClient.invalidateQueries({ queryKey: userBoxQueries.all });
      toast.error(refusal.text);
    },
    meta: { silentError: true },
  });
  if (readOnly) {
    return (
      <p className="mt-3 flex max-w-xl items-start gap-2 text-sm text-muted-foreground">
        <Monitor aria-hidden className="mt-0.5 size-4 shrink-0" />
        {inUseLine(holder.title)}
      </p>
    );
  }
  if (carriedOn || inUseCardState(box, holder.conversation_uuid) === 'freed') {
    return (
      <p className="mt-3 flex max-w-xl items-start gap-2 text-sm text-muted-foreground">
        <Monitor aria-hidden className="mt-0.5 size-4 shrink-0" />
        {carriedOn ? CARRIED_ON_LINE : noLongerInUseLine(holder.title)}
      </p>
    );
  }
  return (
    <section
      aria-label="Lawexa’s machine is in use"
      className="mt-3 flex max-w-xl flex-col gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
    >
      <p className="flex items-start gap-2">
        <Monitor aria-hidden className="mt-0.5 size-4 shrink-0" />
        {inUseLine(holder.title)}
      </p>
      <div className="flex flex-wrap gap-2 pl-6">
        <Button asChild size="sm" variant="outline" className="gap-1.5 bg-background">
          <Link href={`/c/${holder.conversation_uuid}`}>
            <MessagesSquare aria-hidden className="size-4" />
            Open that chat
          </Link>
        </Button>
        <Button size="sm" variant="ghost" disabled={release.isPending} onClick={() => release.mutate()}>
          {release.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Free it and use it here
        </Button>
      </div>
    </section>
  );
}

/**
 * Under Lawexa's "I stopped waiting" message (Arthur's 3: 30 minutes after a
 * hand-over; `metadata.type` "machine_wait_ended"): a quiet mark that the
 * wait ended, and the machine one tap away. A message carries on as usual.
 */
export function MachineWaitEndedNote() {
  const panel = useSidePanel();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Clock aria-hidden className="size-3.5" />
        Waited 30 minutes
      </span>
      {panel ? (
        <button
          type="button"
          onClick={() => panel.open({ kind: 'machine' })}
          className="v2-interactive inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium hover:bg-secondary/60 hover:text-foreground"
        >
          <Monitor aria-hidden className="size-3.5" />
          Open the machine
        </button>
      ) : null}
    </div>
  );
}
