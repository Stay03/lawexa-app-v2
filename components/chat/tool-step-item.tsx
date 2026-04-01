'use client';

import {
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
} from '@/components/prompt-kit';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ToolCallDetails } from '@/components/chat/tool-call-details';
import { SearchResultsList } from '@/components/chat/search-results-cards';
import { StatuteResultsDisplay } from '@/components/chat/statute-results-display';
import type { ToolMessage } from '@/types/chat';
import { cn } from '@/lib/utils';

// Format tool name and parameters into user-friendly text
export function formatToolMessage(
  toolName: string,
  parameters: Record<string, unknown>,
  isComplete: boolean
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
      if (mode === 'outline') {
        return { action: isComplete ? 'Read statute outline' : 'Reading statute outline' };
      }
      if (section) {
        return {
          action: isComplete ? 'Read statute' : 'Reading statute',
          detail: `section ${section}`,
        };
      }
      if (start !== undefined) {
        const end = parameters.end as number | undefined;
        return {
          action: isComplete ? 'Read statute' : 'Reading statute',
          detail: end ? `nodes ${start}–${end}` : `from node ${start}`,
        };
      }
      return { action: isComplete ? 'Read Statute' : 'Reading Statute' };
    }
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

// Format latency in seconds
export function formatLatency(ms: number): string {
  return `found in ${(ms / 1000).toFixed(2)}s`;
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

  const { action, detail } = formatToolMessage(
    message.toolName,
    message.toolParameters,
    isComplete
  );

  return (
    <ChainOfThoughtStep isLast={isLast} status={status} className={className}>
      <Collapsible open={isExpanded} onOpenChange={() => isComplete && onToggle()}>
        <CollapsibleTrigger asChild disabled={!isComplete}>
          <ChainOfThoughtTrigger
            isClickable={isComplete}
            isExpanded={isExpanded}
            rightContent={
              isComplete && message.latencyMs
                ? formatLatency(message.latencyMs)
                : undefined
            }
          >
            <span className="font-medium">{action}</span>
            {detail && (
              <span className="text-muted-foreground font-normal"> {detail}</span>
            )}
          </ChainOfThoughtTrigger>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
          <ChainOfThoughtContent>
            <ToolCallDetails message={message} />
            {showSearchResults && <SearchResultsList message={message} />}
            <StatuteResultsDisplay message={message} />
          </ChainOfThoughtContent>
        </CollapsibleContent>
      </Collapsible>

      {isError && !isExpanded && (
        <p className="text-destructive mt-1 text-sm">
          Error: {message.toolResult?.error || 'Unknown error'}
        </p>
      )}
    </ChainOfThoughtStep>
  );
}
