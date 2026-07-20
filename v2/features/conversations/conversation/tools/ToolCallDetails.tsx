'use client';

import { cn } from '@/lib/utils';
import type { ToolMessage } from '@/types/chat';
import { classifyParameters, detectEmptyResult, extractResultMessage } from './tool-content';
import {
  BoundedScroll,
  ToolEmptyLine,
  ToolSectionLabel,
  ToolStateLine,
} from './ToolResultParts';

/**
 * ToolCallDetails — the GENERIC expanded body for a tool step that has no richer
 * card (web fetches, memory recalls, and any unknown tool). It replaces the old
 * flat `String(value)` parameter dump — the thing that turned exhibit 2's
 * `create_note` HTML argument into a wall of raw source.
 *
 * The taxonomy now classifies the RAW parameters ({@link classifyParameters}):
 *  • short scalars stay inline chips,
 *  • long text / HTML / arrays become a BOUNDED, scrollable block (HTML stripped
 *    to readable prose — never source), so nothing is ever unbounded,
 *  • URL arrays become link rows.
 * Redundant keys the step line already states (`query`, `case_id`, `mode`…) are
 * dropped, and the result is a single quiet line — no "N results", no "found in
 * Xs" (the duration sits on the step header).
 */
interface ToolCallDetailsProps {
  message: ToolMessage;
  className?: string;
}

export function ToolCallDetails({ message, className }: ToolCallDetailsProps) {
  const params = classifyParameters(message.toolParameters, message.toolName);
  const chips = params.filter((p) => p.kind === 'chip');
  const blocks = params.filter((p) => p.kind !== 'chip');

  const isComplete = message.toolStatus === 'complete';
  const success = message.toolResult?.success !== false;
  const error = message.toolResult?.error ?? null;
  const serverMessage = extractResultMessage(message);
  // An affirmative "returned zero" (empty-list payload) — null when the shape is
  // merely unrecognised, so an unreadable result never masquerades as zero.
  const empty = isComplete && success ? detectEmptyResult(message) : null;

  const hasParams = params.length > 0;
  // A quiet "Completed" only when there is genuinely nothing else to show, so an
  // expanded step is never blank — but never noise when there is real content.
  const showDoneFallback =
    isComplete && success && !empty && !serverMessage && !hasParams;

  return (
    <div className={cn('space-y-3 pt-2', className)}>
      {hasParams && (
        <div className="space-y-2">
          <ToolSectionLabel>Parameters</ToolSectionLabel>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((param, idx) => (
                <span
                  key={`chip-${idx}`}
                  className="bg-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
                >
                  <span className="text-muted-foreground">{param.label}</span>
                  <span className="text-foreground font-medium">{param.value}</span>
                </span>
              ))}
            </div>
          )}

          {blocks.map((param, idx) => (
            <div key={`block-${idx}`} className="space-y-1">
              <p className="text-muted-foreground text-[11px]">{param.label}</p>
              {param.kind === 'text' ? (
                <BoundedScroll
                  maxHeight="max-h-44"
                  surface="from-muted"
                  className="bg-muted rounded-lg border border-border px-3 py-2"
                >
                  <p className="text-foreground/80 whitespace-pre-wrap break-words text-xs leading-relaxed">
                    {param.value}
                  </p>
                </BoundedScroll>
              ) : (
                <div className="flex flex-col gap-1">
                  {param.urls.map((url, i) => (
                    <a
                      key={`url-${i}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary v2-interactive min-h-6 truncate text-xs hover:underline"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isComplete && !success && (
        <ToolStateLine tone="error">{error || 'Failed'}</ToolStateLine>
      )}
      {empty && <ToolEmptyLine>{empty}</ToolEmptyLine>}
      {isComplete && success && !empty && serverMessage && (
        <ToolStateLine>{serverMessage}</ToolStateLine>
      )}
      {showDoneFallback && <ToolStateLine>Completed</ToolStateLine>}
    </div>
  );
}
