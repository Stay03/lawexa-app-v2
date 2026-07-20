'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Eye } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useStreamingText, type StreamingSource } from '@/v2/runtime/chat-engine';
import type { HandoverMessage, ToolMessage } from '@/types/chat';
import { CompactToolChain } from '../tools/CompactToolChain';
import { MarkdownText } from '../markdown/MarkdownText';
import { ToolStepMarker } from '../tools/ToolStepItem';
import { BoundedScroll, ToolSectionLabel } from '../tools/ToolResultParts';
import { formatDuration } from '../tools/tool-content';

/**
 * HandoverRow — the sub-agent surface, now speaking the SAME language as the tool
 * steps (owner: "one coherent system across tools, sub-agents, and their nested
 * steps"): the quiet {@link ToolStepMarker} (Bot glyph, a live spinner while the
 * specialist works), the header's quiet duration, and — the exhibit-1 fix — the
 * delegated task rendered inside a BOUNDED, scrollable block instead of the old
 * unbounded giant italic pull-quote of the entire prompt. The nested tool chain,
 * the live specialist stream, and its final response all sit indented under the
 * header on one rail, each bounded.
 *
 * CONTRACT 2 preserved: the specialist's live text renders via
 * `useStreamingText(streamingText, handover.id)` (v2 routes sub-agent tokens into
 * the per-message store). The task-expanded state is DERIVED (`override ?? auto`)
 * so it opens/closes on its own AND animates both directions with no
 * setState-in-effect.
 */
function formatAgentName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HandoverRow({
  handover,
  toolMessages,
  streamingText,
}: {
  handover: HandoverMessage;
  toolMessages: ToolMessage[];
  streamingText: StreamingSource;
}) {
  const isComplete = handover.handoverStatus === 'complete';
  const isTransfer = handover.handoverType === 'transfer';
  const agentName = formatAgentName(handover.agentSlug);

  // CONTRACT 2 — live specialist text from the per-message store, by handover id.
  const live = useStreamingText(streamingText, handover.id);
  const isAgentStreaming = !isComplete && live.trim().length > 0;

  const [taskOverride, setTaskOverride] = useState<boolean | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const streamingRef = useRef<HTMLDivElement>(null);

  // Keep the live specialist box pinned to its newest text (DOM side-effect only).
  useEffect(() => {
    if (streamingRef.current) {
      streamingRef.current.scrollTop = streamingRef.current.scrollHeight;
    }
  }, [live]);

  // 3-stage status: consulting → working → consulted.
  const stage = isComplete ? 'consulted' : toolMessages.length > 0 ? 'working' : 'consulting';
  // Task detail auto-opens only during the initial "consulting" beat.
  const taskOpen = taskOverride ?? stage === 'consulting';

  return (
    <div>
      <Collapsible open={taskOpen} onOpenChange={setTaskOverride}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="v2-interactive hover:bg-secondary/50 -mx-1.5 flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors"
          >
            <ToolStepMarker status={isComplete ? 'success' : 'loading'} icon={Bot} />
            <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
              {handover.agentSlug === 'issue-spotter' ? (
                stage === 'consulted' ? (
                  'Issues extracted'
                ) : (
                  'Extracting issues…'
                )
              ) : (
                <>
                  {stage === 'consulting' &&
                    (isTransfer
                      ? `Transferring to ${agentName}…`
                      : `Consulting ${agentName}…`)}
                  {stage === 'working' && `${agentName} working…`}
                  {stage === 'consulted' &&
                    (isTransfer ? `Transferred to ${agentName}` : `Consulted ${agentName}`)}
                </>
              )}
            </span>
            {isComplete && handover.latencyMs != null && (
              <span className="text-muted-foreground/60 shrink-0 text-xs tabular-nums">
                {formatDuration(handover.latencyMs)}
              </span>
            )}
            <ChevronDown
              aria-hidden
              className={cn(
                'text-muted-foreground size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
                taskOpen && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="v2-collapse">
          {handover.task && (
            <div className="ml-7 mt-1.5 space-y-1">
              <ToolSectionLabel>Task</ToolSectionLabel>
              <BoundedScroll
                maxHeight="max-h-40"
                surface="from-muted"
                className="bg-muted rounded-lg border border-border px-3 py-2"
              >
                <p className="text-muted-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {handover.task}
                </p>
              </BoundedScroll>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {toolMessages.length > 0 && (
        <div className="ml-7 mt-1">
          <CompactToolChain messages={toolMessages} showSearchResults={false} />
        </div>
      )}

      {isAgentStreaming && (
        <div className="ml-7 mt-2">
          <div
            ref={streamingRef}
            className="bg-muted max-h-60 overflow-y-auto rounded-lg border border-border p-3"
          >
            <MarkdownText content={live} />
            <span className="bg-foreground/50 ml-0.5 inline-block h-4 w-0.5 animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      )}

      {handover.handoverResultContent && isComplete && !isTransfer && (
        <div className="ml-7 mt-2">
          <Collapsible open={resultOpen} onOpenChange={setResultOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="v2-interactive text-muted-foreground hover:text-foreground -mx-1 flex min-h-7 items-center gap-1.5 rounded-md px-1 transition-colors"
              >
                <Eye aria-hidden className="size-3.5" />
                <span className="text-xs">{resultOpen ? 'Hide' : 'View'} agent response</span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'size-3 transition-transform duration-200 motion-reduce:transition-none',
                    resultOpen && 'rotate-180',
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="v2-collapse">
              <div className="bg-muted mt-2 rounded-lg border border-border">
                <BoundedScroll maxHeight="max-h-64" surface="from-muted" className="p-3">
                  <MarkdownText content={handover.handoverResultContent} />
                </BoundedScroll>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
