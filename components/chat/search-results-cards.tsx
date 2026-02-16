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

function SearchResultRow({
  title,
  source,
  href,
  icon,
}: {
  title: string;
  source: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
        {title}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {source}
      </span>
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

  const isCases = results.type === 'cases';

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
      <div className="max-h-[200px] overflow-y-auto pb-1">
        {isCases
          ? (results.items as CaseResult[]).map((item) => (
              <SearchResultRow
                key={item.id}
                title={item.title}
                source={
                  item.court?.abbreviation ||
                  item.court?.name ||
                  'Case'
                }
                href={`/cases/${item.slug}`}
                icon={<Scale className="h-2.5 w-2.5 text-primary" />}
              />
            ))
          : (results.items as NoteResult[]).map((item) => (
              <SearchResultRow
                key={item.id}
                title={item.title}
                source={item.course?.name || item.topic || 'Note'}
                href={`/notes/${item.slug}`}
                icon={<BookOpen className="h-2.5 w-2.5 text-primary" />}
              />
            ))}
      </div>
    </div>
  );
}
