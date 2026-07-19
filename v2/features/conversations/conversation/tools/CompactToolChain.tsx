'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolMessage } from '@/types/chat';
import { ToolStepItem, ToolStepMarker } from './ToolStepItem';

/**
 * CompactToolChain — REDESIGNED (fix round §A7-41) for the shared module design
 * language, preserving the FULL taxonomy: ≤2 steps show all; >2 collapse to a
 * quiet "N tool calls completed" summary + the current step, expandable to the
 * whole list; per-step expand stays owned by {@link ToolStepItem}.
 *
 * THE FIX the owner called out: the show-all / collapse used to be a HARD
 * conditional swap (zero transition). It is now a REAL both-directions animation —
 * the hidden earlier steps stay MOUNTED inside a `grid-template-rows: 0fr↔1fr`
 * region (the compositor-friendly height-auto technique; content height is resolved
 * by the browser, so a variable-height list animates without measuring), with the
 * opacity tweening in lockstep. Reduced motion settles instantly. No keyed remount,
 * no dead `animate-collapse-*` classes, and the old inline green-check badge is gone
 * in favour of the module's quiet monochrome marker.
 */
interface CompactToolChainProps {
  messages: ToolMessage[];
  showSearchResults?: boolean;
}

/** The fresh-step entrance — a soft fade + rise, reduced-motion-guarded. */
const STEP_REVEAL =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 motion-safe:fill-mode-both';

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

  // ≤2 steps: the whole (short) chain is always shown.
  if (messages.length <= 2) {
    return (
      <div className="flex flex-col">
        {messages.map((message, index) => (
          <div key={message.id} className={index === messages.length - 1 ? STEP_REVEAL : undefined}>
            <ToolStepItem
              message={message}
              isLast={index === messages.length - 1}
              isExpanded={expandedSteps.has(message.id)}
              onToggle={() => toggleStep(message.id)}
              showSearchResults={showSearchResults}
            />
          </div>
        ))}
      </div>
    );
  }

  // >2 steps: progressive disclosure. The earlier steps collapse behind a summary
  // that animates open/closed BOTH ways; the current step is always visible.
  const earlierMessages = messages.slice(0, -1);
  const currentMessage = messages[messages.length - 1];
  const hiddenCount = earlierMessages.length;
  const allComplete = messages.every((m) => m.toolStatus === 'complete');

  return (
    <div className="flex flex-col">
      {/* Summary / Collapse toggle — a pseudo-step (marker + hairline connector to
          the chain below), so it lines up with the real step rail. */}
      <div className="relative pb-1">
        <span className="bg-border absolute bottom-0 left-[9px] top-6 w-px" aria-hidden />
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="v2-interactive text-muted-foreground hover:text-foreground -mx-1.5 flex min-h-8 items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors"
        >
          <ToolStepMarker status="success" />
          <span className="text-sm">
            {showAll
              ? 'Collapse steps'
              : `${hiddenCount} tool ${hiddenCount === 1 ? 'call' : 'calls'} completed`}
          </span>
          {!showAll && allComplete && (
            <span className="text-muted-foreground/60 text-[11px]">· show all</span>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
              showAll && 'rotate-180',
            )}
          />
        </button>
      </div>

      {/* Hidden earlier steps — height 0fr↔1fr both-directions transition, staying
          mounted so the reverse (collapse) animates too. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          showAll ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div
            inert={!showAll || undefined}
            className={cn(
              'flex flex-col transition-opacity duration-200 ease-out motion-reduce:transition-none',
              showAll ? 'opacity-100' : 'opacity-0',
            )}
          >
            {earlierMessages.map((message) => (
              <ToolStepItem
                key={message.id}
                message={message}
                isLast={false}
                isExpanded={expandedSteps.has(message.id)}
                onToggle={() => toggleStep(message.id)}
                showSearchResults={showSearchResults}
              />
            ))}
          </div>
        </div>
      </div>

      {/* The current (last) step — always visible, entering softly. */}
      <div className={STEP_REVEAL}>
        <ToolStepItem
          message={currentMessage}
          isLast
          isExpanded={expandedSteps.has(currentMessage.id)}
          onToggle={() => toggleStep(currentMessage.id)}
          showSearchResults={showSearchResults}
        />
      </div>
    </div>
  );
}
