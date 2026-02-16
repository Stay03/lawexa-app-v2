'use client';

import { Scale, BookOpen } from 'lucide-react';
import type { ToolMessage } from '@/types/chat';
import { cn } from '@/lib/utils';

interface CaseResult {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  topic?: string;
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

function CaseSearchResultCard({ item }: { item: CaseResult }) {
  const courtLabel = item.court?.abbreviation || item.court?.name;
  const sourceInfo = [courtLabel, item.citation].filter(Boolean).join(' · ');

  return (
    <a
      href={`/cases/${item.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group/card flex w-[180px] shrink-0 flex-col gap-2 rounded-xl border border-border/50 bg-card p-3 transition-colors hover:border-border hover:bg-muted/50"
    >
      <div className="flex items-start gap-2">
        <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
        <h4 className="line-clamp-2 text-xs font-medium leading-tight text-foreground group-hover/card:text-primary">
          {item.title}
        </h4>
      </div>
      {sourceInfo && (
        <p className="line-clamp-1 text-[10px] text-muted-foreground">
          {sourceInfo}
        </p>
      )}
      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
        {item.excerpt}
      </p>
    </a>
  );
}

function NoteSearchResultCard({ item }: { item: NoteResult }) {
  const sourceInfo = item.course?.name || item.topic;

  return (
    <a
      href={`/notes/${item.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group/card flex w-[180px] shrink-0 flex-col gap-2 rounded-xl border border-border/50 bg-card p-3 transition-colors hover:border-border hover:bg-muted/50"
    >
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
        <h4 className="line-clamp-2 text-xs font-medium leading-tight text-foreground group-hover/card:text-primary">
          {item.title}
        </h4>
      </div>
      {sourceInfo && (
        <p className="line-clamp-1 text-[10px] text-muted-foreground">
          {sourceInfo}
        </p>
      )}
      {item.excerpt && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
          {item.excerpt}
        </p>
      )}
    </a>
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
  if (!results) return null;

  return (
    <div className={cn('mt-2', className)}>
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {results.type === 'cases'
          ? (results.items as CaseResult[]).map((item) => (
              <CaseSearchResultCard key={item.id} item={item} />
            ))
          : (results.items as NoteResult[]).map((item) => (
              <NoteSearchResultCard key={item.id} item={item} />
            ))}
      </div>
      {results.total && results.total > results.items.length && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Showing {results.items.length} of {results.total} results
        </p>
      )}
    </div>
  );
}
