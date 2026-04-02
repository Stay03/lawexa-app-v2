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

// Extract statute title from tool result data
function getStatuteTitle(toolResult?: { data?: unknown }): string | null {
  if (!toolResult?.data || typeof toolResult.data !== 'object') return null;
  const data = toolResult.data as Record<string, unknown>;
  const inner = (data.data as Record<string, unknown>) ?? data;
  const statute = inner.statute as { title?: string } | undefined;
  return statute?.title ?? null;
}

// Format tool name and parameters into user-friendly text
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
      const ofName = statuteName ? ` of ${statuteName}` : '';

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

  const isStatuteTool = message.toolName === 'search_statutes' || message.toolName === 'read_statute';
  const { action, detail } = formatToolMessage(
    message.toolName,
    message.toolParameters,
    isComplete,
    message.toolResult ?? undefined,
  );

  return (
    <ChainOfThoughtStep isLast={isLast} status={status} className={className}>
      <Collapsible open={isExpanded} onOpenChange={() => isComplete && onToggle()}>
        <CollapsibleTrigger asChild disabled={!isComplete}>
          <ChainOfThoughtTrigger
            isClickable={isComplete}
            isExpanded={isExpanded}
            rightContent={undefined}
          >
            <span className="font-medium">{action}</span>
            {detail && (
              <span className="text-muted-foreground font-normal"> {detail}</span>
            )}
          </ChainOfThoughtTrigger>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
          <ChainOfThoughtContent>
            {!isStatuteTool && <ToolCallDetails message={message} />}
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
