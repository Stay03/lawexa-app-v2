'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Eye, Loader2 } from 'lucide-react';
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

/**
 * HandoverRow — v2 port of v1's `HandoverDisplay` (the sub-agent delegation
 * concept, §C KEEP), corrected for the v2 engine per CONTRACT 2:
 *
 *   The specialist's live text renders via `useStreamingText(streamingText,
 *   handover.id)` — `handover.streamingContent` is ALWAYS undefined in v2 (the
 *   engine routes the sub-agent's tokens into the per-message live store, not onto
 *   the structural message). Copying v1's `handover.streamingContent` render would
 *   yield a permanently blank agent box.
 *
 * The task-expanded state is DERIVED (`override ?? auto`) rather than driven by
 * effects, so it opens/closes on its own AND animates both directions (standing
 * rule #24), with no setState-in-effect.
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
          <div className="hover:bg-muted/50 -mx-1 mb-1 cursor-pointer rounded-md px-1 py-1.5 transition-colors">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full',
                  isComplete ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {isComplete ? (
                  <Bot className="h-3 w-3" />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </div>
              <span className="text-sm font-medium">
                {handover.agentSlug === 'issue-spotter' ? (
                  stage === 'consulted' ? 'Issues Extracted' : 'Extracting Issues...'
                ) : (
                  <>
                    {stage === 'consulting' &&
                      (isTransfer ? `Transferring to ${agentName}...` : `Consulting ${agentName}...`)}
                    {stage === 'working' && `${agentName} working...`}
                    {stage === 'consulted' &&
                      (isTransfer ? `Transferred to ${agentName}` : `Consulted ${agentName}`)}
                  </>
                )}
              </span>
              <div className="flex-1" />
              {isComplete && handover.latencyMs && (
                <span className="text-muted-foreground text-xs">
                  {(handover.latencyMs / 1000).toFixed(1)}s
                </span>
              )}
              <ChevronDown
                className={cn(
                  'text-muted-foreground h-3.5 w-3.5 transition-transform duration-200',
                  taskOpen && 'rotate-180',
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
          {handover.task && (
            <div className="bg-muted/30 mb-2 ml-7 rounded-md px-3 py-2">
              <p className="text-muted-foreground text-sm italic leading-relaxed">
                &ldquo;{handover.task}&rdquo;
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {toolMessages.length > 0 && (
        <div className="ml-2">
          <CompactToolChain messages={toolMessages} showSearchResults={false} />
        </div>
      )}

      {isAgentStreaming && (
        <div className="ml-2 mt-1">
          <div
            ref={streamingRef}
            className="bg-muted/20 mt-2 max-h-60 overflow-y-auto rounded-lg border p-4"
          >
            <MarkdownText content={live} />
            <span className="bg-foreground/50 ml-0.5 inline-block h-4 w-0.5 animate-pulse" />
          </div>
        </div>
      )}

      {handover.handoverResultContent && isComplete && !isTransfer && (
        <div className="ml-2 mt-1">
          <Collapsible open={resultOpen} onOpenChange={setResultOpen}>
            <CollapsibleTrigger asChild>
              <button className="hover:bg-muted/50 flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors">
                <Eye className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-muted-foreground text-xs">
                  {resultOpen ? 'Hide' : 'View'} agent response
                </span>
                <ChevronDown
                  className={cn(
                    'text-muted-foreground h-3 w-3 transition-transform duration-200',
                    resultOpen && 'rotate-180',
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
              <div className="bg-muted/20 mt-2 max-h-60 overflow-y-auto rounded-lg border p-4">
                <MarkdownText content={handover.handoverResultContent} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
