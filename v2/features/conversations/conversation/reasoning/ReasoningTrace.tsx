'use client';

import { useState } from 'react';
import { Brain, ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { MarkdownText } from '../markdown/MarkdownText';

/**
 * ReasoningTrace — the §C "thinking" upgrade (contract 3). v1 RECEIVES the model's
 * `thinking` payload and DISCARDS it; v2 surfaces it as a collapsible trace that
 * auto-opens while the model is reasoning and auto-collapses to "Thought for Ns"
 * on finish (the Vercel AI Elements pattern, foundation-standards §5).
 *
 * GATED — zero UI cost when absent (the backend `thinking` payload carries no text
 * today): if there is no reasoning text, this renders nothing at all. It only ever
 * appears when a trace actually has content.
 *
 * Open state is DERIVED (`userOverride ?? isStreaming`), so it opens on its own
 * while streaming and collapses when the stream ends — via the Collapsible's own
 * data-state animations, which animate BOTH directions (standing rule #24) — while
 * still honoring a manual toggle. No setState-in-effect.
 */
export function ReasoningTrace({
  text,
  isStreaming,
  reasoningMs,
  className,
}: {
  /** The reasoning text — live tokens while streaming, or the finalized trace. */
  text: string;
  isStreaming: boolean;
  /** Wall-clock ms spent reasoning (finalized) — powers "Thought for Ns". */
  reasoningMs?: number;
  className?: string;
}) {
  const [userOverride, setUserOverride] = useState<boolean | null>(null);

  // GATE: nothing to show → render nothing (no border, no chrome, no cost).
  if (!text.trim()) return null;

  const open = userOverride ?? isStreaming;
  const label = isStreaming
    ? 'Thinking…'
    : reasoningMs && reasoningMs > 0
      ? `Thought for ${Math.max(1, Math.round(reasoningMs / 1000))}s`
      : 'Thought process';

  return (
    <div className={cn('mb-2', className)}>
      <Collapsible open={open} onOpenChange={setUserOverride}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md py-0.5 text-xs transition-colors"
          >
            <Brain
              className={cn('h-3.5 w-3.5 shrink-0', isStreaming && 'motion-safe:animate-pulse')}
              aria-hidden
            />
            <span className={cn(isStreaming && 'text-shimmer')}>{label}</span>
            <ChevronDown
              className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')}
              aria-hidden
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="v2-collapse">
          <div className="border-muted mt-1 ml-1.5 border-l-2 pl-3">
            <MarkdownText
              content={text}
              className="prose-p:my-1 text-muted-foreground text-[0.8125rem] leading-relaxed"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
