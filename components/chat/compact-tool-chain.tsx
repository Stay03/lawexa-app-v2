'use client';

import { useState } from 'react';
import { ChainOfThought } from '@/components/prompt-kit';
import { ToolStepItem } from '@/components/chat/tool-step-item';
import { cn } from '@/lib/utils';
import type { ToolMessage } from '@/types/chat';
import { ChevronDown } from 'lucide-react';

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
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const allComplete = messages.every((m) => m.toolStatus === 'complete');

  // 2 or fewer messages: show all normally
  if (messages.length <= 2) {
    return (
      <ChainOfThought>
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={
              index === messages.length - 1
                ? 'animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both'
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

  // Show all mode: full list
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

  // Compact mode: badge + current tool only
  const hiddenCount = messages.length - 1;
  const currentMessage = messages[messages.length - 1];

  return (
    <div>
      {/* Completed count badge */}
      <button
        onClick={() => setShowAll(true)}
        className={cn(
          'mb-1.5 flex items-center gap-1.5 pl-1',
          'text-muted-foreground hover:text-foreground transition-colors',
          'animate-in fade-in duration-200'
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
          <span className="text-muted-foreground/60 text-[10px]">
            &middot; show all
          </span>
        )}
      </button>

      <ChainOfThought>
        {/* Current tool call */}
        <div
          key={currentMessage.id}
          className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both"
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
