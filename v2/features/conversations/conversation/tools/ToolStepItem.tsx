'use client';

import { Brain, Check, ChevronDown, Loader2, X, type LucideIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ToolCallDetails } from './ToolCallDetails';
import {
  EntityResultCard,
  SearchResultsList,
  WebResultsList,
  extractSearchResults,
} from '../cards/SearchResultsCards';
import { StatuteResultsDisplay, extractStatuteData } from '../cards/StatuteResultsDisplay';
import { NoteLinkCard } from '../cards/NoteLinkCard';
import {
  detectEmptyResult,
  extractCreatedNote,
  extractSingleEntity,
  extractWebResults,
  formatDuration,
  isMemoryTool,
  isSearchLikeTool,
} from './tool-content';
import type { ToolMessage } from '@/types/chat';

/**
 * ToolStepItem + the tool-call taxonomy (`formatToolMessage`) — the module design
 * language, now with a DEEP-redesigned expanded body. Same BRAIN (the tool-name →
 * human-copy mapping, the statute/memory special-casing, the expand-only-when-
 * complete rule); the SKIN is a native quiet marker over a hairline connector, a
 * quiet duration on the header (so the body drops "N results" / "found in Xs"),
 * and a per-tool {@link ToolStepBody} router that gives every payload a designed,
 * BOUNDED presentation instead of a raw parameter dump.
 */

/**
 * A step's status marker — a `bg-secondary` disc with a muted glyph, switching to
 * a `destructive` tint only on failure. An optional `icon` overrides the glyph
 * (Brain for memory, Bot for a sub-agent); `spin` keeps a live spinner while the
 * step runs. NEVER the old green palette.
 */
export function ToolStepMarker({
  status,
  icon: Icon,
  spin = true,
}: {
  status: 'loading' | 'success' | 'error';
  icon?: LucideIcon;
  spin?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full',
        status === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-secondary text-muted-foreground',
      )}
    >
      {status === 'error' ? (
        <X className="size-3" strokeWidth={2.5} />
      ) : status === 'loading' ? (
        spin || !Icon ? (
          <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
        ) : (
          <Icon className="size-3" />
        )
      ) : Icon ? (
        <Icon className="size-3" />
      ) : (
        <Check className="size-3" strokeWidth={2.5} />
      )}
    </span>
  );
}

function getStatuteTitle(toolResult?: { data?: unknown }): string | null {
  if (!toolResult?.data || typeof toolResult.data !== 'object') return null;
  const data = toolResult.data as Record<string, unknown>;
  const inner = (data.data as Record<string, unknown>) ?? data;
  const statute = inner.statute as { title?: string } | undefined;
  return statute?.title ?? null;
}

export function formatToolMessage(
  toolName: string,
  parameters: Record<string, unknown>,
  isComplete: boolean,
  toolResult?: { success: boolean; data: unknown; error: string | null },
): { action: string; detail?: string } {
  const query = parameters.query as string | undefined;

  switch (toolName) {
    case 'search_cases':
      return {
        action: isComplete ? 'Searched cases' : 'Searching cases',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'search_notes':
      return {
        action: isComplete ? 'Searched notes' : 'Searching notes',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'get_case':
    case 'get_case_details':
      return {
        action: isComplete ? 'Retrieved case details' : 'Retrieving case details',
        detail: parameters.case_id ? `for case #${parameters.case_id}` : undefined,
      };
    case 'get_note':
    case 'get_note_details':
      return {
        action: isComplete ? 'Retrieved note' : 'Retrieving note',
        detail: parameters.note_id ? `#${parameters.note_id}` : undefined,
      };
    case 'search_statutes':
      return {
        action: isComplete ? 'Searched statutes' : 'Searching statutes',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'read_statute': {
      const mode = parameters.mode as string | undefined;
      const section = parameters.section as string | undefined;
      const start = parameters.start as number | undefined;
      const statuteName = getStatuteTitle(toolResult) || null;

      if (mode === 'outline') {
        return {
          action: isComplete ? 'Read outline' : 'Reading outline',
          detail: statuteName ? `of ${statuteName}` : undefined,
        };
      }
      if (section) {
        return {
          action: isComplete ? `Read section ${section}` : `Reading section ${section}`,
          detail: statuteName ? `of ${statuteName}` : undefined,
        };
      }
      if (start !== undefined) {
        const end = parameters.end as number | undefined;
        const range = end ? `${start}–${end}` : `${start}`;
        return {
          action: isComplete ? `Read lines ${range}` : `Reading lines ${range}`,
          detail: statuteName ? `of ${statuteName}` : undefined,
        };
      }
      return {
        action: isComplete ? 'Read Statute' : 'Reading Statute',
        detail: statuteName || undefined,
      };
    }
    case 'view_note':
      return {
        action: isComplete ? 'Read note' : 'Reading note',
        detail: parameters.id ? `#${parameters.id}` : undefined,
      };
    case 'web_search':
      return {
        action: isComplete ? 'Searched the web' : 'Searching the web',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'get_page_content': {
      const urls = parameters.urls as string[] | undefined;
      const urlCount = urls?.length;
      return {
        action: isComplete ? 'Read page content' : 'Reading page content',
        detail: urlCount ? `from ${urlCount} page${urlCount > 1 ? 's' : ''}` : undefined,
      };
    }
    case 'search_my_conversations':
      return {
        action: isComplete ? 'Checked memory' : 'Checking memory',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'view_conversation':
      return {
        action: isComplete ? 'Memory recalled' : 'Recalling memory',
      };
    default: {
      const readable = toolName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        action: isComplete ? readable : `${readable}...`,
      };
    }
  }
}

/**
 * The expanded body of a completed step — routed by tool family so each result
 * gets a designed, BOUNDED presentation:
 *  • a created note → the {@link NoteLinkCard} affordance (title + link/DOCX),
 *    NEVER its raw HTML body (owner's exhibit 2);
 *  • a statute → the outline/section/search display;
 *  • (top-level only) a search → elevated result rows; a single case/note →
 *    one elevated row; web hits → source rows;
 *  • everything else → the generic classified-parameter renderer.
 *
 * `showSearchResults=false` (nested sub-agent chains) keeps the compact heritage:
 * the small note affordance and statute display still show, the heavier result
 * lists fall back to the generic details.
 */
function ToolStepBody({
  message,
  showSearchResults,
}: {
  message: ToolMessage;
  showSearchResults: boolean;
}) {
  const createdNote = extractCreatedNote(message);
  if (createdNote) return <NoteLinkCard note={createdNote} />;

  if (extractStatuteData(message)) {
    return <StatuteResultsDisplay message={message} />;
  }

  if (showSearchResults) {
    if (extractSearchResults(message)) {
      return <SearchResultsList message={message} />;
    }
    const web = extractWebResults(message);
    if (web) return <WebResultsList results={web} />;
    const entity = extractSingleEntity(message);
    if (entity) return <EntityResultCard entity={entity} />;
  }

  return <ToolCallDetails message={message} />;
}

interface ToolStepItemProps {
  message: ToolMessage;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  showSearchResults?: boolean;
  className?: string;
}

export function ToolStepItem({
  message,
  isLast,
  isExpanded,
  onToggle,
  showSearchResults = true,
  className,
}: ToolStepItemProps) {
  const isComplete = message.toolStatus === 'complete';
  const isSuccess = isComplete && message.toolResult?.success !== false;
  const isError = isComplete && message.toolResult?.success === false;
  const status = !isComplete ? 'loading' : isSuccess ? 'success' : 'error';

  const memory = isMemoryTool(message.toolName);
  const { action, detail } = formatToolMessage(
    message.toolName,
    message.toolParameters,
    isComplete,
    message.toolResult ?? undefined,
  );
  // Glance-level zero signal: a search that affirmatively returned nothing hints
  // it on the COLLAPSED line, so a user need not expand to learn it found nothing.
  const zeroHint = isSuccess && isSearchLikeTool(message.toolName) && detectEmptyResult(message);

  return (
    <div className={cn('relative pb-1', className)}>
      {/* Hairline chain connector to the next step, hidden on the last step. */}
      {!isLast && (
        <span className="bg-border absolute bottom-0 left-[9px] top-6 w-px" aria-hidden />
      )}

      <Collapsible open={isExpanded} onOpenChange={() => isComplete && onToggle()}>
        <div className="flex items-start gap-2">
          <ToolStepMarker
            status={status}
            icon={memory ? Brain : undefined}
            spin={!memory}
          />
          <CollapsibleTrigger asChild disabled={!isComplete}>
            <button
              type="button"
              disabled={!isComplete}
              className={cn(
                'flex min-h-6 flex-1 items-center gap-1.5 rounded-md py-0.5 pr-1 text-left transition-colors',
                isComplete
                  ? 'v2-interactive hover:bg-secondary/50 -mx-1.5 cursor-pointer px-1.5'
                  : 'cursor-default',
              )}
            >
              <span className="min-w-0 flex-1 text-sm leading-snug">
                <span className="text-foreground font-medium">{action}</span>
                {detail && <span className="text-muted-foreground font-normal"> {detail}</span>}
                {zeroHint && (
                  <span className="text-muted-foreground/70 font-normal"> · no matches</span>
                )}
              </span>
              {isComplete && message.latencyMs != null && (
                <span className="text-muted-foreground/60 shrink-0 text-xs tabular-nums">
                  {formatDuration(message.latencyMs)}
                </span>
              )}
              {isComplete && (
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'text-muted-foreground size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
                    isExpanded && 'rotate-180',
                  )}
                />
              )}
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="v2-collapse">
          <div className="border-border ml-[9px] mt-1.5 border-l pl-4">
            <ToolStepBody message={message} showSearchResults={showSearchResults} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {isError && !isExpanded && (
        <p className="text-destructive ml-7 mt-1 text-sm">
          Error: {message.toolResult?.error || 'Unknown error'}
        </p>
      )}
    </div>
  );
}
