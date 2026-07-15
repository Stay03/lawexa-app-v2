'use client';

import { useState } from 'react';
import { Scale, BookOpen, ChevronDown, ExternalLink } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import type { ToolMessage } from '@/types/chat';
import { cn } from '@/lib/utils';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';

interface CaseResult {
  id: number;
  title: string;
  display_title?: string | null;
  slug: string;
  excerpt: string;
  topic?: string;
  tags?: string[];
  principles?: string;
  court?: { name: string; abbreviation?: string } | null;
  country?: { name: string } | null;
  judgment_date?: string | null;
  citation?: string | null;
  course?: { name: string } | null;
}

interface NoteResult {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  topic?: string;
  course?: { name: string; slug?: string } | null;
}

type SearchResultType = 'cases' | 'notes';

interface SearchResults {
  type: SearchResultType;
  items: CaseResult[] | NoteResult[];
  total?: number;
}

/**
 * Extract search results from a ToolMessage's result data
 */
export function extractSearchResults(message: ToolMessage): SearchResults | null {
  if (!message.toolResult?.success || !message.toolResult.data) return null;

  const toolName = message.toolName;
  if (toolName !== 'search_cases' && toolName !== 'search_notes') return null;

  const type: SearchResultType = toolName === 'search_cases' ? 'cases' : 'notes';

  try {
    const data = message.toolResult.data as Record<string, unknown>;
    // Navigate nested structure: { success, data: { cases/notes: [...], total, returned } }
    const innerData = (data.data as Record<string, unknown>) ?? data;
    const items = (innerData[type] as CaseResult[] | NoteResult[]) ?? [];
    const total = (innerData.total as number) ?? items.length;

    if (items.length === 0) return null;

    return { type, items, total };
  } catch {
    return null;
  }
}

function CaseResultRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: CaseResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const source = item.court?.abbreviation || item.court?.name || 'Case';
  const title = getCaseDisplayTitle(item);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Scale className="h-2.5 w-2.5 text-primary" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
            {title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {source}
          </span>
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mx-3 mb-2 rounded-lg border border-border/30 bg-background/50 p-3">
          <div className="max-h-[150px] overflow-y-auto space-y-2">
            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              {item.topic && <span>{item.topic}</span>}
              {item.citation && (
                <>
                  <span className="text-border">·</span>
                  <span>{item.citation}</span>
                </>
              )}
              {item.judgment_date && (
                <>
                  <span className="text-border">·</span>
                  <span>{item.judgment_date}</span>
                </>
              )}
            </div>

            {/* Excerpt */}
            {item.excerpt && (
              <p className="text-[11px] leading-relaxed text-foreground/80">
                {item.excerpt}
              </p>
            )}

            {/* Principles */}
            {item.principles && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Key Principles
                </p>
                <p className="text-[11px] leading-relaxed text-foreground/70">
                  {item.principles}
                </p>
              </div>
            )}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Open link */}
          <a
            href={`/cases/${item.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            Open case <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NoteResultRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: NoteResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const source = item.course?.name || item.topic || 'Note';

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-2.5 w-2.5 text-primary" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
            {item.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {source}
          </span>
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mx-3 mb-2 rounded-lg border border-border/30 bg-background/50 p-3">
          <div className="max-h-[150px] overflow-y-auto space-y-2">
            {/* Meta info */}
            {item.topic && (
              <span className="text-[10px] text-muted-foreground">
                {item.topic}
              </span>
            )}

            {/* Excerpt */}
            {item.excerpt && (
              <p className="text-[11px] leading-relaxed text-foreground/80">
                {item.excerpt}
              </p>
            )}
          </div>

          {/* Open link */}
          <a
            href={`/notes/${item.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            Open note <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SearchResultsList({
  message,
  className,
}: {
  message: ToolMessage;
  className?: string;
}) {
  const results = extractSearchResults(message);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!results) return null;

  const isCases = results.type === 'cases';

  const toggleItem = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className={cn('mt-3 rounded-xl border border-border/40 bg-muted/20', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {isCases ? 'Cases' : 'Notes'}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {results.total ?? results.items.length} results
        </span>
      </div>

      {/* Scrollable list */}
      <div className="max-h-[300px] overflow-y-auto pb-1">
        {isCases
          ? (results.items as CaseResult[]).map((item) => (
              <CaseResultRow
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => toggleItem(item.id)}
              />
            ))
          : (results.items as NoteResult[]).map((item) => (
              <NoteResultRow
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
      </div>
    </div>
  );
}
