'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Bot, Sparkles, X } from 'lucide-react';

import { CompactToolChain } from '@/components/chat/compact-tool-chain';
import { MessageContent } from '@/components/prompt-kit';
import { useChatStream } from '@/lib/hooks/useChatStream';
import { useRotatingText } from '@/lib/hooks/useRotatingText';
import { THINKING_PHRASES } from '@/lib/constants/thinking-phrases';
import { cn } from '@/lib/utils';
import {
  isErrorMessage,
  isHandoverMessage,
  isToolMessage,
  type ChatMessage,
  type ConversationMessage,
  type HandoverMessage,
  type ToolMessage,
} from '@/types/chat';

interface LawexaGlancePanelProps {
  executionId: string;
  summonerName: string;
  onClose: () => void;
}

// Slug → readable agent name, e.g. "issue-spotter" → "Issue Spotter".
function formatAgentName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Grouped timeline: consecutive tool calls collapse into one chain; a handover
// absorbs the tool calls that follow it. Mirrors the conversation's grouping so
// the glance renders identically, just more compact.
type GlanceGroup =
  | { type: 'single'; message: ConversationMessage }
  | { type: 'tool-chain'; messages: ToolMessage[] }
  | { type: 'handover'; handover: HandoverMessage; toolMessages: ToolMessage[] };

function groupMessages(messages: ConversationMessage[]): GlanceGroup[] {
  const groups: GlanceGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (isHandoverMessage(msg)) {
      const toolMessages: ToolMessage[] = [];
      i += 1;
      while (i < messages.length && isToolMessage(messages[i])) {
        toolMessages.push(messages[i] as ToolMessage);
        i += 1;
      }
      groups.push({ type: 'handover', handover: msg, toolMessages });
    } else if (isToolMessage(msg)) {
      const toolMessages: ToolMessage[] = [msg];
      i += 1;
      while (i < messages.length && isToolMessage(messages[i])) {
        toolMessages.push(messages[i] as ToolMessage);
        i += 1;
      }
      groups.push({ type: 'tool-chain', messages: toolMessages });
    } else {
      groups.push({ type: 'single', message: msg });
      i += 1;
    }
  }

  return groups;
}

// Blinking caret shown at the tail of streaming assistant text.
function StreamingCursor() {
  return (
    <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground/70 align-middle" />
  );
}

// Compact handover: a small "Consulting {agent}…" label, its nested tool chain,
// and any streaming / completed sub-agent text as markdown. Deliberately lighter
// than the conversation's full HandoverDisplay — this is a glance, not a chat.
function GlanceHandover({
  handover,
  toolMessages,
}: {
  handover: HandoverMessage;
  toolMessages: ToolMessage[];
}) {
  const isComplete = handover.handoverStatus === 'complete';
  const agentName = formatAgentName(handover.agentSlug);
  const isTransfer = handover.handoverType === 'transfer';
  const verb = isTransfer ? 'Transferr' : 'Consult';
  const label = isComplete
    ? `${verb}ed ${agentName}`
    : `${verb}ing ${agentName}…`;
  const subText = handover.streamingContent || handover.handoverResultContent;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bot className="size-3 shrink-0 text-primary" />
        <span className={cn('truncate', !isComplete && 'animate-pulse')}>
          {label}
        </span>
      </div>
      {toolMessages.length > 0 && (
        <div className="pl-1">
          <CompactToolChain messages={toolMessages} showSearchResults={false} />
        </div>
      )}
      {subText && (
        <MessageContent
          className="prose-sm pl-1 text-sm text-muted-foreground"
          markdown
          isStreaming={!isComplete}
        >
          {subText}
        </MessageContent>
      )}
    </div>
  );
}

/**
 * Live "watch Lawexa work" glance (Phase 6). Drives the SAME `useChatStream`
 * engine personal chat uses — attaching read-only to the summon's execution —
 * so the reader sees the full turn (tool calls, thinking, handovers, streaming
 * answer) rendered with the SAME components as the conversation, just compact.
 *
 * The authoritative clean reply still lands in the feed as its own message; this
 * panel is a disposable, best-effort preview.
 */
export function LawexaGlancePanel({
  executionId,
  summonerName,
  onClose,
}: LawexaGlancePanelProps) {
  const { messages, isStreaming, connectToStream, disconnect } =
    useChatStream();
  const bodyRef = useRef<HTMLDivElement>(null);

  // Attach read-only to the live stream once per execution. The panel is keyed
  // by executionId upstream, so this effect runs a single connect + disconnect
  // per turn (connectToStream/disconnect are stable useCallbacks). Effect body
  // only calls SSE lifecycle methods — never setState.
  useEffect(() => {
    connectToStream(executionId);
    return () => disconnect();
  }, [executionId, connectToStream, disconnect]);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  // A trailing assistant message with no text yet means Lawexa is still working
  // toward its answer — show a quiet thinking line instead of an empty bubble.
  const lastMessage = messages[messages.length - 1];
  const lastAssistantIsEmpty =
    !!lastMessage &&
    lastMessage.role === 'assistant' &&
    !isHandoverMessage(lastMessage) &&
    !isErrorMessage(lastMessage) &&
    lastMessage.content.trim().length === 0;
  const hasVisibleAnswer = messages.some(
    (m) =>
      m.role === 'assistant' &&
      !isHandoverMessage(m) &&
      !isErrorMessage(m) &&
      m.content.trim().length > 0,
  );
  const showThinking =
    isStreaming && (!hasVisibleAnswer || lastAssistantIsEmpty);

  const { currentText: thinkingText } = useRotatingText({
    phrases: THINKING_PHRASES,
    intervalMs: 5000,
    mode: 'random',
    enabled: showThinking,
  });

  // Follow new content as it streams. DOM side-effect only — never setState —
  // so it satisfies the React Compiler's no-setState-in-effect rule.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, showThinking, thinkingText]);

  return (
    <div className="pointer-events-auto w-full max-w-xs rounded-2xl border bg-background/95 shadow-md backdrop-blur sm:max-w-md">
      <div className="flex items-center gap-1.5 border-b px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="size-3 shrink-0 animate-pulse text-primary" />
        <span className="min-w-0 flex-1 truncate">
          Watching Lawexa respond to{' '}
          <span className="font-medium text-foreground">{summonerName}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Stop watching"
          className="-mr-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div
        ref={bodyRef}
        className="max-h-[50vh] space-y-2.5 overflow-y-auto px-3 py-2.5"
      >
        {groups.map((group) => {
          if (group.type === 'tool-chain') {
            return (
              <CompactToolChain
                key={`tools-${group.messages[0].id}`}
                messages={group.messages}
              />
            );
          }

          if (group.type === 'handover') {
            return (
              <GlanceHandover
                key={`handover-${group.handover.id}`}
                handover={group.handover}
                toolMessages={group.toolMessages}
              />
            );
          }

          const { message } = group;

          // Error: quiet, non-alarming — the real reply still lands in the feed.
          if (isErrorMessage(message)) {
            return (
              <p key={message.id} className="text-sm text-muted-foreground">
                Lawexa hit an error.
              </p>
            );
          }

          // User turns don't appear in a read-only glance, but guard anyway so
          // the streaming assistant answer is the only bubble we render as text.
          if (message.role !== 'assistant') return null;

          if (!message.content.trim()) return null;

          const streaming = (message as ChatMessage).isStreaming ?? false;
          return (
            <div key={message.id}>
              <MessageContent
                className="prose-sm text-sm"
                markdown
                isStreaming={streaming}
              >
                {message.content}
              </MessageContent>
              {streaming && <StreamingCursor />}
            </div>
          );
        })}

        {showThinking && (
          <p
            className="text-shimmer text-sm font-medium"
            role="status"
            aria-live="polite"
          >
            {thinkingText}…
          </p>
        )}
      </div>
    </div>
  );
}
