'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isErrorMessage, isHandoverMessage } from '@/types/chat';
import { useConversationStream } from '@/v2/runtime/chat-engine';
import { ActivityStatus } from '@/v2/features/conversations/conversation/ActivityStatus';
import { groupMessages } from '@/v2/features/conversations/conversation/message-groups';
import { AssistantMessageRow } from '@/v2/features/conversations/conversation/rows/AssistantMessageRow';
import { HandoverRow } from '@/v2/features/conversations/conversation/rows/HandoverRow';
import { CompactToolChain } from '@/v2/features/conversations/conversation/tools/CompactToolChain';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LawexaMark } from '../ui/avatars';

/**
 * LawexaGlancePanel — watch one Lawexa turn happen, live. Phase-5 W3; study A9
 * marks v1's panel KEEP-the-model, REDESIGN: same idea, re-pointed onto the v2
 * chat engine and the v2 conversation rows (v1's `useChatStream` and its
 * components are boundary-blocked, and the v2 engine is the better one anyway).
 * Sources: plan W3 item 6, api-digest §C (`GET /api/chat/stream/{execution_id}`
 * — any active member, multi-viewer, late attach safe) — 2026-08-04.
 *
 * READ-ONLY, AND DISPOSABLE ON PURPOSE. The panel ATTACHES to an execution that
 * someone else started; it never sends, never cancels, never retries. If the
 * stream drops, if the reader closes the panel, if they were never watching at
 * all — nothing is lost, because the authoritative reply arrives in the channel
 * as an ordinary message regardless. That is what licenses every simplification
 * below: no reconnect ladder, no error banner with a Retry that would lie, no
 * persistence.
 *
 * WHY THE CONVERSATION'S OWN ROWS. This IS a personal-chat turn — the same
 * agent, the same tool chain, the same handovers, the same streaming answer. So
 * it renders with the components the conversation screen uses (tool chains,
 * sub-agent rows, the streaming answer row) rather than a second, thinner
 * imitation that would drift. What is dropped is the chat CHROME: no user
 * bubbles (the summoning message is directly above this panel in the feed), no
 * message actions worth pressing, no composer.
 *
 * COST IS OPT-IN. The whole engine arrives with this module, which is why the
 * responding row imports it through `dynamic(..., { ssr: false })` and only
 * when a reader clicks Watch.
 */

/** Read-only surface: the conversation rows take action callbacks; these are
 *  the honest no-ops. Module-level so the memoised rows keep their identity. */
const NOOP = () => {};

export function LawexaGlancePanel({
  executionId,
  summonerName,
  onClose,
}: {
  executionId: string;
  summonerName: string;
  onClose: () => void;
}) {
  const stream = useConversationStream();
  const bodyRef = useRef<HTMLDivElement>(null);
  // Client clock read ONCE, in a lazy initializer — never in render (React
  // Compiler rule) and never in an effect that would setState.
  const [attachedAt] = useState(() => Date.now());

  const { connectToStream, disconnect } = stream;
  // Attach exactly once per execution. The panel is KEYED by executionId
  // upstream, so this is one connect + one disconnect per turn; the effect body
  // only calls SSE lifecycle methods, never setState.
  useEffect(() => {
    connectToStream(executionId);
    return () => disconnect();
  }, [executionId, connectToStream, disconnect]);

  const groups = useMemo(() => groupMessages(stream.messages), [stream.messages]);

  // Is there an answer on screen yet? Until there is, the activity line stands
  // in for it — an empty box under "Watching…" would read as a stall.
  const hasAnswer = stream.messages.some(
    (message) =>
      message.role === 'assistant' &&
      !isHandoverMessage(message) &&
      !isErrorMessage(message) &&
      message.content.trim().length > 0,
  );
  const failed = stream.messages.some(isErrorMessage) || stream.error !== null;

  // Follow the newest content. DOM side-effect only — no setState — so the
  // React Compiler's no-setState-in-effect rule holds.
  useEffect(() => {
    const element = bodyRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [stream.messages, stream.isStreaming]);

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border bg-muted/30 shadow-xs',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200',
      )}
    >
      <div className="flex items-center gap-1.5 border-b bg-background/60 px-3 py-2 text-xs">
        <LawexaMark className="size-3 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          Watching Lawexa answer{' '}
          <span className="font-medium text-foreground">{summonerName}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Stop watching"
          className={cn(
            '-mr-1 shrink-0 rounded-full p-1 text-muted-foreground',
            'transition-colors duration-150 hover:bg-muted hover:text-foreground',
            'motion-reduce:transition-none',
            FOCUS_RING,
          )}
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </div>

      <div
        ref={bodyRef}
        className="v2-quiet-scroll max-h-[40vh] space-y-3 overflow-y-auto px-3 py-2.5"
      >
        {groups.map((group) => {
          if (group.type === 'tool-chain') {
            return (
              <CompactToolChain
                key={`tools-${group.messages[0].id}`}
                messages={group.messages}
                showSearchResults={false}
              />
            );
          }
          if (group.type === 'handover-group') {
            return (
              <HandoverRow
                key={`handover-${group.handover.id}`}
                handover={group.handover}
                toolMessages={group.toolMessages}
                streamingText={stream.streamingText}
              />
            );
          }

          const { message } = group;
          // Errors stay quiet: the real reply (or a `.ai.turn_failed`) is what
          // decides this turn's outcome, and a red banner inside a peek would
          // overstate a preview's authority.
          if (isErrorMessage(message)) return null;
          // A read-only glance shows no user turn — the question is the message
          // this panel is anchored under.
          if (message.role !== 'assistant') return null;

          return (
            <AssistantMessageRow
              key={message.id}
              message={message}
              streamingText={stream.streamingText}
              reasoning={stream.reasoning}
              // Read-only: prompt cards render, their actions stay inert.
              isInteracted
              isLast={false}
              canRegenerate={false}
              onRegenerate={NOOP}
            />
          );
        })}

        {stream.isStreaming && !hasAnswer && (
          <ActivityStatus startTime={attachedAt} narration={null} />
        )}

        {!stream.isStreaming && failed && (
          <p className="text-sm text-muted-foreground">
            This peek ended early. Lawexa&rsquo;s reply will still appear in the
            channel if the answer completes.
          </p>
        )}

        {!stream.isStreaming && !failed && hasAnswer && (
          <p className="text-xs text-muted-foreground">
            Finished — the reply lands in the channel.
          </p>
        )}
      </div>
    </div>
  );
}
