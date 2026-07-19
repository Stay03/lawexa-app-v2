'use client';

import { useState } from 'react';
import { ChainOfThought } from '@/components/prompt-kit';
import { ToolStepItem } from './ToolStepItem';
import { cn } from '@/lib/utils';
import type { ToolMessage } from '@/types/chat';
import { ChevronDown } from 'lucide-react';

/**
 * CompactToolChain (v2 port of `components/chat/compact-tool-chain.tsx`).
 * Progressive disclosure for a run of tool calls: ≤2 shows all; >2 collapses to a
 * "N tool calls completed" badge + the current step, expandable to the full list.
 * Byte-faithful; only the ToolStepItem import location changed.
 */
interface CompactToolChainProps {
  messages: ToolMessage[];
  showSearchResults?: boolean;
}

export function CompactToolChain({
  messages,
  showSearchResults = true,
}: CompactToolChainProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const toggleStep = (messageId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const allComplete = messages.every((m) => m.toolStatus === 'complete');

  if (messages.length <= 2) {
    return (
      <ChainOfThought>
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={
              index === messages.length - 1
                ? 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 fill-mode-both'
                : undefined
            }
          >
            <ToolStepItem
              message={message}
              isLast={index === messages.length - 1}
              isExpanded={expandedSteps.has(message.id)}
              onToggle={() => toggleStep(message.id)}
              showSearchResults={showSearchResults}
            />
          </div>
        ))}
      </ChainOfThought>
    );
  }

  if (showAll) {
    return (
      <div>
        <ChainOfThought>
          {messages.map((message, index) => (
            <ToolStepItem
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
              isExpanded={expandedSteps.has(message.id)}
              onToggle={() => toggleStep(message.id)}
              showSearchResults={showSearchResults}
            />
          ))}
        </ChainOfThought>
        <button
          onClick={() => setShowAll(false)}
          className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 pl-8 text-xs transition-colors"
        >
          <ChevronDown className="h-3 w-3 rotate-180" />
          Collapse
        </button>
      </div>
    );
  }

  const hiddenCount = messages.length - 1;
  const currentMessage = messages[messages.length - 1];

  return (
    <div>
      <button
        onClick={() => setShowAll(true)}
        className={cn(
          'mb-1.5 flex items-center gap-1.5 pl-1',
          'text-muted-foreground hover:text-foreground transition-colors',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
        )}
      >
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/10">
          <svg
            className="h-2.5 w-2.5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-xs">
          {hiddenCount} tool {hiddenCount === 1 ? 'call' : 'calls'} completed
        </span>
        {allComplete && (
          <span className="text-muted-foreground/60 text-[10px]">&middot; show all</span>
        )}
      </button>

      <ChainOfThought>
        <div
          key={currentMessage.id}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 fill-mode-both"
        >
          <ToolStepItem
            message={currentMessage}
            isLast={true}
            isExpanded={expandedSteps.has(currentMessage.id)}
            onToggle={() => toggleStep(currentMessage.id)}
            showSearchResults={showSearchResults}
          />
        </div>
      </ChainOfThought>
    </div>
  );
}
