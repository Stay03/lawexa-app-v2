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
 * opacity tweening in lockstep. Reduced motion settles instantly, and the old inline
 * green-check badge is gone in favour of the module's quiet monochrome marker.
 *
 * ── THE STACKING ROUND (owner, July 25) ─────────────────────────────────────
 * Two separate faults, both about steps ARRIVING rather than about the toggle:
 *
 *  1. ONE STRUCTURE FOR EVERY LENGTH. There were two returns — a plain list at ≤2
 *     steps, the summary + collapsed region beyond — so the third call in every
 *     chain replaced one subtree with a different one. Nothing can animate across
 *     that. The three regions below are now always rendered and only their values
 *     change, so 2→3 plays as a fold rather than a redraw.
 *  2. THE CURRENT STEP IS KEYED. Its wrapper had no key, so React reused the same
 *     DOM node forever and the entrance animation — which only runs on mount — fired
 *     once per chain instead of once per step.
 *
 * And one that was not about arrival at all: "· show all" was gated on every step
 * having completed, so it blinked out whenever a new tool started. It is an
 * affordance, not a status.
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

  // ONE STRUCTURE FOR EVERY LENGTH (owner: "sometimes they don't stack with that
  // clean sleek smooth animation"). There used to be two returns — a plain list for
  // ≤2 steps and the summary + collapsed region for >2 — and crossing that boundary
  // swapped one subtree for a completely different one. React cannot reconcile
  // that, so the third tool call in every chain arrived as a hard structural jump
  // with no animation at all. The regions below are now always the same three, and
  // only their VALUES change with length, so 2→3 plays as the earlier steps folding
  // into the summary rather than as a redraw.
  const earlierMessages = messages.slice(0, -1);
  const currentMessage = messages[messages.length - 1];
  const hiddenCount = earlierMessages.length;
  // ≤2 steps stay fully open with no toggle (the approved taxonomy, unchanged);
  // beyond that the earlier steps collapse behind the summary.
  const collapsible = messages.length > 2;
  const open = !collapsible || showAll;

  return (
    <div className="flex flex-col">
      {/* Summary / Collapse toggle — a pseudo-step (marker + hairline connector to
          the chain below), so it lines up with the real step rail. */}
      {collapsible && (
        <div className={cn('relative pb-1', STEP_REVEAL)}>
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
            {/* "· show all" is an AFFORDANCE, not a status. It used to be gated on
                every step in the chain having finished, so the moment a new tool
                started it vanished and then came back when that tool completed —
                the flicker the owner reported. Whether the hidden steps can be
                expanded has nothing to do with what the CURRENT step is doing. */}
            {!showAll && (
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
      )}

      {/* Earlier steps — height 0fr↔1fr both-directions transition, staying mounted
          so the reverse (collapse) animates too. Open and untoggleable while the
          chain is short; that is what makes 2→3 an animated fold instead of a jump. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div
            inert={!open || undefined}
            className={cn(
              'flex flex-col transition-opacity duration-200 ease-out motion-reduce:transition-none',
              open ? 'opacity-100' : 'opacity-0',
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

      {/* The current (last) step — always visible, entering softly.
          KEYED ON THE MESSAGE ID, and that is the whole of the second half of the
          owner's report. Without a key this wrapper is the same DOM node forever:
          React swaps the child inside it, the element never mounts again, and a CSS
          entrance animation only plays on mount — so the reveal ran once for the
          first step and never again. Keying it means each new step is a new element
          and animates in, every time. `expandedSteps` lives in this component, so
          the remount costs no state. */}
      <div key={currentMessage.id} className={STEP_REVEAL}>
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
