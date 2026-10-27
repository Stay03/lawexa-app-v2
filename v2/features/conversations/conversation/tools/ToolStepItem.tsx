'use client';

import { useId } from 'react';
import { Brain, Check, ChevronDown, Loader2, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ToolCallDetails } from './ToolCallDetails';
import { useToolResult } from './use-tool-result';
import { StepCollapse } from './step-collapse';
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
  readStepTitle,
  extractWebResults,
  formatDuration,
  isMemoryTool,
  isSearchLikeTool,
} from './tool-content';
import type { ToolMessage } from '@/types/chat';
import { EDIT_QUIZ_TOOL, editSavedNothing, isQuizStep, quizStepLabel, quizStepState } from './created-quiz';
import { failedStepLine, stepFailed } from './step-failure';

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
 * A step's status marker — a `bg-secondary` disc with a muted glyph: a check, a
 * spinner, or a cross for a step that didn't work, in the same grey (Stay, 27
 * October 2026: a failed step is never red, step-failure.ts). An optional
 * `icon` overrides the glyph (Brain for memory, Bot for a sub-agent); `spin`
 * keeps a live spinner while the step runs. NEVER the old green palette.
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
      className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
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
  /** The statute's name from the result's metadata, when the result is not loaded. */
  statuteTitle?: string,
  /** The note or case title from the result's metadata, likewise. */
  entityTitle?: string,
  /** Whether a lazy result is still to fetch (`resultRef`). */
  hasResultRef = false,
): { action: string; detail?: string; generic?: boolean } {
  // A read step names what it read: the title from the loaded result, else the
  // one the transcript carries, else (older chats) the id it was asked for.
  const readTitle = readStepTitle(toolResult) || entityTitle || null;
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
        detail: readTitle ? `for ${readTitle}` : parameters.case_id ? `for case #${parameters.case_id}` : undefined,
      };
    case 'get_note':
    case 'get_note_details':
      return {
        action: isComplete ? 'Retrieved note' : 'Retrieving note',
        detail: readTitle ?? (parameters.note_id ? `#${parameters.note_id}` : undefined),
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
      const statuteName = getStatuteTitle(toolResult) || statuteTitle || null;

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
    // The read the AI uses for a case it already found; backend sends its title
    // as `case_title` (3212379).
    case 'view_case': {
      const caseId = parameters.case_id ?? parameters.id;
      return {
        action: isComplete ? 'Read case' : 'Reading case',
        detail: readTitle ?? (caseId ? `#${caseId}` : undefined),
      };
    }
    case 'view_note':
      return {
        action: isComplete ? 'Read note' : 'Reading note',
        detail: readTitle ?? (parameters.id ? `#${parameters.id}` : undefined),
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
    // The file list in chat (piece a; Stay, 23 October 2026): the files a
    // step found show as a card after the chain (`ChatFileListCard`).
    case 'list_files':
      return {
        action: isComplete ? 'Listed files' : 'Listing files',
        detail: typeof parameters.name === 'string' && parameters.name.trim() ? `named "${parameters.name.trim()}"` : undefined,
      };
    case 'search_files':
      return {
        action: isComplete ? 'Searched files' : 'Searching files',
        detail: query ? `for "${query}"` : undefined,
      };
    case 'list_space_contents':
      return {
        action: isComplete ? "Listed the Space's contents" : "Listing the Space's contents",
      };
    // Quiz from a source (Stay, 23 October 2026), and Lawexa building and
    // editing a quiz itself (24 October 2026): the quiz shows as a card after
    // the chain (`CreatedQuizCard`); the step names it.
    case 'create_quiz':
    case 'add_to_quiz':
    case 'edit_quiz':
    case 'read_quiz': {
      const { action, title } = quizStepLabel(toolName, isComplete, toolResult, hasResultRef);
      const asked = typeof parameters.title === 'string' && parameters.title.trim() ? parameters.title.trim() : undefined;
      return { action, detail: title ?? asked };
    }
    default: {
      const readable = toolName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        action: isComplete ? readable : `${readable}...`,
        // No label of its own: a failure says "A step didn't work" (step-failure.ts).
        generic: true,
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
/**
 * The opened step: its result fetched first when the chat download left it
 * out (use-tool-result.ts), with a short skeleton meanwhile and a retry if
 * the fetch fails, then the body the result calls for.
 */
function LoadedToolStepBody({
  result,
  showSearchResults,
}: {
  result: ReturnType<typeof useToolResult>;
  showSearchResults: boolean;
}) {
  if (result.status === 'loading') {
    return (
      <div role="status" aria-label="Loading the step's result" className="space-y-2 pt-2">
        <Skeleton className="h-3.5 w-3/4 rounded" />
        <Skeleton className="h-3.5 w-1/2 rounded" />
      </div>
    );
  }
  if (result.status === 'error') {
    return (
      <p className="text-muted-foreground pt-2 text-sm">
        The result did not load.{' '}
        <button type="button" onClick={() => void result.retry()} className="v2-interactive text-foreground font-medium underline underline-offset-2">
          Try again
        </button>
      </p>
    );
  }
  return <ToolStepBody message={result.message} showSearchResults={showSearchResults} />;
}

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

  const memory = isMemoryTool(message.toolName);
  // The step's result, fetched the first time it opens (v2 loads chats with
  // lazy results). Loaded HERE rather than in the body so the label can name
  // what the step read once the result arrives (Stay's #13), and keeps the
  // name after the step closes: the fetched result is kept for the visit.
  const loaded = useToolResult(message, isExpanded);
  // Failed, or the server's softened "found nothing" sent as a success
  // (step-failure.ts): either way the step did not do what its label says.
  const isError = stepFailed(loaded.message);
  const isSuccess = isComplete && !isError;
  // A refused quiz is a finished step the stored result may still call a
  // success, so its mark follows the card's reading (created-quiz.ts), from the
  // LOADED result: a lazy chat's step carries none until it is fetched (the
  // card fetches it), and the mark read the empty one (shots5, 24 October
  // 2026). The card under the chain already says why, so no "Error:" line.
  // An edit that saved nothing is marked the same (Tester, chat 0a54fba4).
  const quizRefused =
    isQuizStep(message) &&
    (quizStepState(loaded.message)?.kind === 'failed' ||
      (message.toolName === EDIT_QUIZ_TOOL && editSavedNothing(loaded.message.toolResult ?? undefined)));
  const status = !isComplete ? 'loading' : isSuccess && !quizRefused ? 'success' : 'error';
  const label = formatToolMessage(
    message.toolName,
    message.toolParameters,
    isComplete,
    loaded.message.toolResult ?? undefined,
    message.statuteTitle,
    message.entityTitle,
    Boolean(message.resultRef),
  );
  // A step that didn't work says so in plain words, never Lawexa's own error
  // text (step-failure.ts). A refused quiz keeps its label: its card says why.
  const failure = isError && !quizRefused ? failedStepLine(loaded.message, label) : null;
  const { action, detail } = failure ?? label;
  // Glance-level zero signal: a search that affirmatively returned nothing hints
  // it on the COLLAPSED line, so a user need not expand to learn it found nothing.
  const zeroHint = isSuccess && isSearchLikeTool(message.toolName) && detectEmptyResult(message);
  const bodyId = useId();

  return (
    <div className={cn('relative pb-1', className)}>
      {/* Hairline chain connector to the next step, hidden on the last step. */}
      {!isLast && (
        <span className="bg-border absolute bottom-0 left-[9px] top-6 w-px" aria-hidden />
      )}

      {/* No Radix Collapsible here: its closed content stays mounted and measures
          itself on mount (see step-collapse.tsx). The button and region below keep
          what it gave: aria-expanded, aria-controls, keyboard by native button. */}
      <div className="flex items-start gap-2">
        <ToolStepMarker
          status={status}
          icon={memory ? Brain : undefined}
          spin={!memory}
        />
        <button
          type="button"
          disabled={!isComplete}
          aria-expanded={isExpanded}
          aria-controls={bodyId}
          onClick={() => isComplete && onToggle()}
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
            {failure?.outcome && (
              <span className="text-muted-foreground font-normal"> · {failure.outcome}</span>
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
      </div>

      <StepCollapse id={bodyId} open={isExpanded}>
        <div className="border-border ml-[9px] mt-1.5 border-l pl-4">
          <LoadedToolStepBody result={loaded} showSearchResults={showSearchResults} />
        </div>
      </StepCollapse>

    </div>
  );
}
