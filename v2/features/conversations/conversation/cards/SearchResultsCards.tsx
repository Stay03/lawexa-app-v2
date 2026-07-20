'use client';

import { Scale, BookOpen, Globe } from 'lucide-react';
import type { ToolMessage } from '@/types/chat';
import { cn } from '@/lib/utils';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import {
  BoundedScroll,
  ResultRowLink,
  ToolResultGroup,
} from '../tools/ToolResultParts';
import type { SingleEntity, WebResult } from '../tools/tool-content';

/**
 * SearchResultsCards — REDESIGNED for the shared tool-result language. The old
 * cramped `text-[10px]` rows that expanded IN PLACE (a third collapsible nested
 * inside the step, inside the chain — the "messy" stacking the owner saw) are
 * gone. Each hit is now ONE elevated {@link ResultRowLink}: an identity tile, the
 * case/note title, a quiet legal-identity meta line, and a whole-row link into
 * the resource — so "the view case can be better" is answered by making the row
 * itself the designed way in. No "N results" count, no uppercase label; the step
 * line ("Searched cases for …") already says what happened.
 */

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
 * Extract search results from a ToolMessage's result data.
 */
export function extractSearchResults(message: ToolMessage): SearchResults | null {
  if (!message.toolResult?.success || !message.toolResult.data) return null;

  const toolName = message.toolName;
  if (toolName !== 'search_cases' && toolName !== 'search_notes') return null;

  const type: SearchResultType = toolName === 'search_cases' ? 'cases' : 'notes';

  try {
    const data = message.toolResult.data as Record<string, unknown>;
    // Navigate nested structure: { success, data: { cases/notes: [...], total } }
    const innerData = (data.data as Record<string, unknown>) ?? data;
    const items = (innerData[type] as CaseResult[] | NoteResult[]) ?? [];
    const total = (innerData.total as number) ?? items.length;

    if (items.length === 0) return null;

    return { type, items, total };
  } catch {
    return null;
  }
}

function caseMeta(item: CaseResult): string | undefined {
  const court = item.court?.abbreviation || item.court?.name;
  return (
    [court, item.judgment_date ?? undefined, item.citation ?? undefined]
      .filter(Boolean)
      .join(' · ') || undefined
  );
}

function noteMeta(item: NoteResult): string | undefined {
  return item.course?.name || item.topic || undefined;
}

/** A search's hits, as a bounded, scannable list of link rows. */
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
    <ToolResultGroup className={className}>
      <BoundedScroll maxHeight="max-h-72" surface="from-card" className="p-1">
        {isCases
          ? (results.items as CaseResult[]).map((item) => (
              <ResultRowLink
                key={item.id}
                href={`/cases/${item.slug}`}
                icon={Scale}
                title={getCaseDisplayTitle(item)}
                meta={caseMeta(item)}
              />
            ))
          : (results.items as NoteResult[]).map((item) => (
              <ResultRowLink
                key={item.id}
                href={`/notes/${item.slug}`}
                icon={BookOpen}
                title={item.title}
                meta={noteMeta(item)}
              />
            ))}
      </BoundedScroll>
    </ToolResultGroup>
  );
}

/** A single retrieved case/note (get_case / get_note / view_note) — one elevated
 *  row that links straight into the resource. */
export function EntityResultCard({
  entity,
  className,
}: {
  entity: SingleEntity;
  className?: string;
}) {
  return (
    <ToolResultGroup className={cn('p-1', className)}>
      <ResultRowLink
        href={entity.href}
        icon={entity.kind === 'case' ? Scale : BookOpen}
        title={entity.title}
        meta={entity.meta}
      />
    </ToolResultGroup>
  );
}

/** Web-search hits as source rows — a globe tile, the page title, its domain. */
export function WebResultsList({
  results,
  className,
}: {
  results: WebResult[];
  className?: string;
}) {
  return (
    <ToolResultGroup className={className}>
      <BoundedScroll maxHeight="max-h-72" surface="from-card" className="p-1">
        {results.map((result, idx) => (
          <ResultRowLink
            key={`${result.url}-${idx}`}
            href={result.url}
            icon={Globe}
            title={result.title}
            meta={result.source}
          />
        ))}
      </BoundedScroll>
    </ToolResultGroup>
  );
}
