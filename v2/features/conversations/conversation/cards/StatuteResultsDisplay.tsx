'use client';

import { useState } from 'react';
import { ScrollText, ChevronDown, ExternalLink, FileText } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import type { ToolMessage } from '@/types/chat';
import { cn } from '@/lib/utils';

/******************************************************************************
                               Types
******************************************************************************/

interface StatuteInfo {
  id: number;
  title: string;
  slug: string;
  year?: number;
  country?: { name: string; code?: string };
  total_nodes?: number;
  approx_word_count?: number;
}

interface OutlineItem {
  pos: number;
  type: string;
  num: string | null;
  title: string | null;
  depth: number;
}

interface SectionMatch {
  number: string;
  position: number;
  title: string;
  depth: number;
  parent_context: string;
}

interface OtherMatch {
  position: number;
  title: string;
  parent_context: string;
}

type StatuteDisplayMode = 'search' | 'outline' | 'content' | null;

interface StatuteDisplayData {
  mode: StatuteDisplayMode;
  statute?: StatuteInfo;
  // search mode
  statutes?: StatuteInfo[];
  total?: number;
  // outline mode
  outline?: OutlineItem[];
  // content mode
  sectionMatch?: SectionMatch;
  otherMatches?: OtherMatch[];
  content?: string;
  showing?: string;
  hasMore?: boolean;
}

/******************************************************************************
                            Data Extraction
******************************************************************************/

export function extractStatuteData(message: ToolMessage): StatuteDisplayData | null {
  if (!message.toolResult?.success || !message.toolResult.data) return null;

  const toolName = message.toolName;
  if (toolName !== 'search_statutes' && toolName !== 'read_statute') return null;

  try {
    const data = message.toolResult.data as Record<string, unknown>;
    const innerData = (data.data as Record<string, unknown>) ?? data;

    if (toolName === 'search_statutes') {
      const statutes = (innerData.statutes as StatuteInfo[]) ?? [];
      const total = (innerData.total as number) ?? statutes.length;
      if (statutes.length === 0) return null;
      return { mode: 'search', statutes, total };
    }

    // read_statute
    const statute = innerData.statute as StatuteInfo | undefined;
    const outline = innerData.outline as OutlineItem[] | undefined;
    const content = innerData.content as string | undefined;
    const mode = innerData.mode as string | undefined;
    const sectionMatch = innerData.section_match as SectionMatch | undefined;
    const otherMatches = innerData.other_matches as OtherMatch[] | undefined;
    const showing = innerData.showing as string | undefined;
    const hasMore = innerData.has_more as boolean | undefined;

    if (outline && mode === 'outline') {
      return { mode: 'outline', statute, outline };
    }

    if (content) {
      return { mode: 'content', statute, sectionMatch, otherMatches, content, showing, hasMore };
    }

    return null;
  } catch {
    return null;
  }
}

/******************************************************************************
                            XML Content Parser
******************************************************************************/

function parseStatuteXml(xml: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let key = 0;

  // Remove outer section/schedule tags and process inner content
  const text = xml
    .replace(/<\/?section[^>]*>/g, '')
    .replace(/<\/?schedule[^>]*>/g, '')
    .replace(/<\/?part[^>]*>/g, '');

  // Process subsections: <subsection pos="..." num="(1)">text</subsection>
  // Process paragraphs: <paragraph pos="..." num="(a)">text</paragraph>
  // Process headings: <heading pos="..." title="..."/>

  // Split into meaningful blocks
  const parts = text.split(/<\/?(?:subsection|paragraph|heading)[^>]*>/g);
  const tags = text.match(/<(?:subsection|paragraph|heading)[^>]*>/g) || [];

  let tagIndex = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) {
      if (tagIndex < tags.length) tagIndex++;
      continue;
    }

    // Determine indent level from the preceding tag
    let indent = 0;
    let num = '';
    let isHeading = false;

    if (tagIndex > 0 && tagIndex <= tags.length) {
      const tag = tags[tagIndex - 1];
      if (tag.includes('paragraph')) indent = 2;
      else if (tag.includes('subsection')) indent = 1;
      else if (tag.includes('heading')) isHeading = true;

      const numMatch = tag.match(/num="([^"]*)"/);
      if (numMatch) num = numMatch[1];
    }

    if (isHeading) {
      const titleMatch = tags[tagIndex - 1]?.match(/title="([^"]*)"/);
      if (titleMatch) {
        nodes.push(
          <p key={key++} className="font-medium text-foreground/90 mt-2 mb-1">
            {titleMatch[1]}
          </p>
        );
      }
    } else {
      nodes.push(
        <p
          key={key++}
          className={cn(
            'text-[11px] leading-relaxed text-foreground/80',
            indent === 1 && 'ml-4',
            indent === 2 && 'ml-8'
          )}
        >
          {num && <span className="text-muted-foreground mr-1">{num}</span>}
          {part}
        </p>
      );
    }

    tagIndex++;
  }

  // Fallback: if no structured content was parsed, show raw text
  if (nodes.length === 0) {
    const plainText = xml.replace(/<[^>]+>/g, '').trim();
    if (plainText) {
      nodes.push(
        <p key={0} className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
          {plainText}
        </p>
      );
    }
  }

  return nodes;
}

/******************************************************************************
                            Sub-components
******************************************************************************/

function StatuteSearchRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: StatuteInfo;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const meta = [item.country?.name, item.year].filter(Boolean).join(' · ');

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ScrollText className="h-2.5 w-2.5 text-primary" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
            {item.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {meta}
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
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              {item.country?.name && <span>{item.country.name}</span>}
              {item.year && (
                <>
                  <span className="text-border">·</span>
                  <span>{item.year}</span>
                </>
              )}
              {item.total_nodes && (
                <>
                  <span className="text-border">·</span>
                  <span>{item.total_nodes.toLocaleString()} sections</span>
                </>
              )}
            </div>
          </div>
          <a
            href={`/statutes/${item.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            Open statute <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StatuteOutlineDisplay({
  statute,
  outline,
}: {
  statute: StatuteInfo;
  outline: OutlineItem[];
}) {
  // Show only top-level items (depth 0)
  const topLevel = outline.filter((item) => item.depth === 0);

  return (
    <div className="mt-3 rounded-xl border border-border/40 bg-muted/20">
      {/* Statute header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{statute.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          {statute.country?.name && <span>{statute.country.name}</span>}
          {statute.year && (
            <>
              <span className="text-border">·</span>
              <span>{statute.year}</span>
            </>
          )}
          {statute.total_nodes && (
            <>
              <span className="text-border">·</span>
              <span>{statute.total_nodes.toLocaleString()} sections</span>
            </>
          )}
          {statute.approx_word_count && (
            <>
              <span className="text-border">·</span>
              <span>~{statute.approx_word_count.toLocaleString()} words</span>
            </>
          )}
        </div>
      </div>

      {/* Outline items */}
      <div className="max-h-[300px] overflow-y-auto py-1">
        {topLevel.map((item) => (
          <div
            key={item.pos}
            className="flex items-center gap-2 px-3 py-1.5 text-[11px]"
          >
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
              {item.type}
            </span>
            {item.num && (
              <span className="shrink-0 text-muted-foreground">{item.num}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-foreground/80">
              {item.title || ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatuteContentDisplay({
  statute,
  sectionMatch,
  otherMatches,
  content,
  showing,
}: {
  statute?: StatuteInfo;
  sectionMatch?: SectionMatch;
  otherMatches?: OtherMatch[];
  content: string;
  showing?: string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border/40 bg-muted/20">
      {/* Section header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-border/30">
        {sectionMatch ? (
          <>
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground">
                Section {sectionMatch.number} — {sectionMatch.title}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>{sectionMatch.parent_context}</span>
              {statute && (
                <>
                  <span className="text-border">·</span>
                  <span className="truncate">{statute.title}</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">
              {statute?.title || 'Statute content'}
            </span>
            {showing && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {showing}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[250px] overflow-y-auto px-3 py-2 space-y-1">
        {parseStatuteXml(content)}
      </div>

      {/* Other matches note */}
      {otherMatches && otherMatches.length > 0 && (
        <div className="px-3 pb-2 text-[10px] text-muted-foreground">
          Also found in: {otherMatches.map((m) => m.parent_context).join(', ')}
        </div>
      )}

      {/* Open link */}
      {statute?.slug && (
        <div className="px-3 pb-2">
          <a
            href={`/statutes/${statute.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            Open statute <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      )}
    </div>
  );
}

/******************************************************************************
                            Main Component
******************************************************************************/

export function StatuteResultsDisplay({
  message,
  className,
}: {
  message: ToolMessage;
  className?: string;
}) {
  const data = extractStatuteData(message);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!data) return null;

  // Search results
  if (data.mode === 'search' && data.statutes) {
    return (
      <div className={cn('mt-3 rounded-xl border border-border/40 bg-muted/20', className)}>
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Statutes
          </span>
          <span className="text-[10px] text-muted-foreground">
            {data.total ?? data.statutes.length} results
          </span>
        </div>
        <div className="max-h-[300px] overflow-y-auto pb-1">
          {data.statutes.map((item) => (
            <StatuteSearchRow
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
            />
          ))}
        </div>
      </div>
    );
  }

  // Outline
  if (data.mode === 'outline' && data.statute && data.outline) {
    return (
      <div className={className}>
        <StatuteOutlineDisplay statute={data.statute} outline={data.outline} />
      </div>
    );
  }

  // Content (section or node range)
  if (data.mode === 'content' && data.content) {
    return (
      <div className={className}>
        <StatuteContentDisplay
          statute={data.statute}
          sectionMatch={data.sectionMatch}
          otherMatches={data.otherMatches}
          content={data.content}
          showing={data.showing}
        />
      </div>
    );
  }

  return null;
}
