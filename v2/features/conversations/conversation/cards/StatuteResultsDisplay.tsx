'use client';

import { ScrollText, FileText, ExternalLink } from 'lucide-react';
import type { ToolMessage } from '@/types/chat';
import { cn } from '@/lib/utils';
import { BoundedScroll, ResultRowLink, ToolResultGroup } from '../tools/ToolResultParts';

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
          <p key={key++} className="text-foreground/90 mb-1 mt-2 text-xs font-medium">
            {titleMatch[1]}
          </p>,
        );
      }
    } else {
      nodes.push(
        <p
          key={key++}
          className={cn(
            'text-foreground/80 text-[11px] leading-relaxed',
            indent === 1 && 'ml-4',
            indent === 2 && 'ml-8',
          )}
        >
          {num && <span className="text-muted-foreground mr-1">{num}</span>}
          {part}
        </p>,
      );
    }

    tagIndex++;
  }

  // Fallback: if no structured content was parsed, show raw text
  if (nodes.length === 0) {
    const plainText = xml.replace(/<[^>]+>/g, '').trim();
    if (plainText) {
      nodes.push(
        <p key={0} className="text-foreground/80 whitespace-pre-wrap text-[11px] leading-relaxed">
          {plainText}
        </p>,
      );
    }
  }

  return nodes;
}

/******************************************************************************
                            Sub-components
******************************************************************************/

function statuteMeta(item: StatuteInfo): string | undefined {
  return (
    [
      item.country?.name,
      item.year ? String(item.year) : undefined,
      item.total_nodes ? `${item.total_nodes.toLocaleString()} sections` : undefined,
    ]
      .filter(Boolean)
      .join(' · ') || undefined
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
    <ToolResultGroup>
      <ResultRowLink
        href={`/statutes/${statute.slug}`}
        icon={ScrollText}
        title={statute.title}
        meta={statuteMeta(statute)}
      />
      <div className="border-border border-t">
        {topLevel.length > 0 ? (
          <BoundedScroll maxHeight="max-h-72" surface="from-card" className="py-1">
            {topLevel.map((item) => (
              <div key={item.pos} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                <span className="text-muted-foreground bg-secondary shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase">
                  {item.type}
                </span>
                {item.num && <span className="text-muted-foreground shrink-0">{item.num}</span>}
                <span className="text-foreground/80 min-w-0 flex-1 truncate">
                  {item.title || ''}
                </span>
              </div>
            ))}
          </BoundedScroll>
        ) : (
          <p className="text-muted-foreground px-3 py-2 text-xs">No outline available</p>
        )}
      </div>
    </ToolResultGroup>
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
  const title = sectionMatch
    ? `Section ${sectionMatch.number} — ${sectionMatch.title}`
    : statute?.title || 'Statute content';
  const meta = sectionMatch
    ? [sectionMatch.parent_context, statute?.title].filter(Boolean).join(' · ')
    : showing;

  return (
    <ToolResultGroup>
      {/* Section header */}
      <div className="border-border flex items-start gap-3 border-b px-3 py-2.5">
        <span
          aria-hidden
          className="bg-secondary text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
        >
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{title}</p>
          {meta && <p className="text-muted-foreground truncate text-xs">{meta}</p>}
        </div>
      </div>

      {/* Content */}
      <BoundedScroll maxHeight="max-h-64" surface="from-card" className="space-y-1 px-3 py-2">
        {parseStatuteXml(content)}
      </BoundedScroll>

      {/* Other matches + open link */}
      {((otherMatches && otherMatches.length > 0) || statute?.slug) && (
        <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
          {otherMatches && otherMatches.length > 0 ? (
            <span className="text-muted-foreground min-w-0 truncate text-[10px]">
              Also in {otherMatches.map((m) => m.parent_context).join(', ')}
            </span>
          ) : (
            <span />
          )}
          {statute?.slug && (
            <a
              href={`/statutes/${statute.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary v2-interactive inline-flex shrink-0 items-center gap-1 text-xs hover:underline"
            >
              Open statute <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
    </ToolResultGroup>
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
  if (!data) return null;

  // Search results — bounded list of link rows into each statute.
  if (data.mode === 'search' && data.statutes) {
    return (
      <ToolResultGroup className={className}>
        <BoundedScroll maxHeight="max-h-72" surface="from-card" className="p-1">
          {data.statutes.map((item) => (
            <ResultRowLink
              key={item.id}
              href={`/statutes/${item.slug}`}
              icon={ScrollText}
              title={item.title}
              meta={statuteMeta(item)}
            />
          ))}
        </BoundedScroll>
      </ToolResultGroup>
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
