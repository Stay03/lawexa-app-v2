'use client';

import Link from 'next/link';
import {
  BookOpen,
  ExternalLink,
  FileDiff,
  Globe,
  Scale,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { getAppUrl } from '@/lib/constants/seo';
import type { ReportSource, ReportSourceType } from '@/types/radar';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * ReportSources — the report's structured citation list, in the v2 row
 * grammar (hairlines between rows, one affordance mark at the right edge).
 *
 * NUMBERED BY `position`, not array index (the study's correction): the
 * number shown IS the marker the report's text cites — a gap in the sequence
 * stays a gap, so "[3]" in the prose always finds row 3 here.
 *
 * Link resolution is the same three-way rule as the case page's authority
 * rows: web sources open externally (new tab, safe rel), Lawexa records
 * navigate in-app, and an unresolvable reference stays honest plain text.
 * In-app detection is window-free (`getAppUrl`), so SSR and client agree.
 */

const SOURCE_TYPE_ICONS: Record<ReportSourceType, LucideIcon> = {
  web_page: Globe,
  other: Globe,
  case: Scale,
  statute: BookOpen,
  amendment: FileDiff,
  note: StickyNote,
};

const EXTERNAL_SOURCE_TYPES: ReadonlySet<ReportSourceType> = new Set([
  'web_page',
  'other',
]);

/** In-app path for a Lawexa source; null when the URL is not ours. */
function inAppPath(source: ReportSource): string | null {
  if (!source.url) return null;
  if (source.url.startsWith('/')) return source.url;
  try {
    const appOrigin = new URL(getAppUrl()).origin;
    const parsed = new URL(source.url);
    if (parsed.origin === appOrigin) return parsed.pathname;
  } catch {
    return null;
  }
  return null;
}

function sourceTitle(source: ReportSource): string {
  return source.title ?? source.domain ?? source.url ?? 'Untitled source';
}

function SourceRow({ source }: { source: ReportSource }) {
  const Icon = SOURCE_TYPE_ICONS[source.source_type];
  const title = sourceTitle(source);

  const body = (
    <>
      <Icon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{title}</span>
        {source.domain ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {source.domain}
          </span>
        ) : null}
      </span>
    </>
  );

  const rowClass =
    'v2-interactive flex min-h-11 flex-1 items-start gap-2.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50';

  if (EXTERNAL_SOURCE_TYPES.has(source.source_type) && source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(rowClass, FOCUS_RING)}
      >
        {body}
        <ExternalLink
          aria-hidden
          className="mt-1 size-3.5 shrink-0 text-muted-foreground/40"
        />
      </a>
    );
  }

  const appPath = inAppPath(source);
  if (appPath) {
    return (
      <Link href={appPath} className={cn(rowClass, FOCUS_RING)}>
        {body}
      </Link>
    );
  }

  return <span className="flex min-h-11 flex-1 items-start gap-2.5 px-2 py-2.5">{body}</span>;
}

export function ReportSources({ sources }: { sources: ReportSource[] }) {
  if (sources.length === 0) return null;

  const ordered = [...sources].sort((a, b) => a.position - b.position);

  return (
    <section aria-label="Sources" className="flex flex-col gap-3">
      {/* The case page's section-heading grammar: label + hairline. */}
      <div className="flex items-center gap-3">
        <h2 className="report-kicker shrink-0">
          Sources
          <span className="text-muted-foreground/50">
            {' · '}
            <span className="tabular-nums">{ordered.length}</span>
          </span>
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border/60" />
      </div>

      <ol className="flex flex-col divide-y divide-border/60">
        {ordered.map((source) => (
          <li key={source.id} className="flex items-start gap-1">
            <span className="w-7 shrink-0 pt-3 text-center font-mono text-xs tabular-nums text-muted-foreground">
              {source.position}
            </span>
            <SourceRow source={source} />
          </li>
        ))}
      </ol>
    </section>
  );
}
