import Link from 'next/link';
import {
  BookOpen,
  ExternalLink,
  FileDiff,
  Globe,
  Scale,
  StickyNote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ReportSource, ReportSourceType } from '@/types/radar';

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

/**
 * Resolve an in-app path for a Lawexa source. App routes are slug-based, so
 * we only link when the backend supplies a usable URL — a dangling source_id
 * with no URL renders as plain text rather than a fabricated link.
 */
function inAppPath(source: ReportSource): string | null {
  if (!source.url) return null;
  if (source.url.startsWith('/')) return source.url;
  try {
    const parsed = new URL(source.url);
    if (
      typeof window !== 'undefined' &&
      parsed.origin === window.location.origin
    ) {
      return parsed.pathname;
    }
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
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {source.domain && (
          <span className="block truncate text-xs text-muted-foreground">
            {source.domain}
          </span>
        )}
      </span>
    </>
  );

  const rowClassName =
    'flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors';

  if (EXTERNAL_SOURCE_TYPES.has(source.source_type) && source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${rowClassName} hover:bg-muted/40`}
      >
        {body}
        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      </a>
    );
  }

  const appPath = inAppPath(source);
  if (appPath) {
    return (
      <Link href={appPath} className={`${rowClassName} hover:bg-muted/40`}>
        {body}
      </Link>
    );
  }

  return <div className={rowClassName}>{body}</div>;
}

interface ReportSourcesProps {
  sources: ReportSource[];
}

/**
 * The report's structured citation list: web sources open externally,
 * Lawexa records link in-app, and unresolvable references stay plain text.
 */
function ReportSources({ sources }: ReportSourcesProps) {
  if (sources.length === 0) return null;

  const ordered = [...sources].sort((a, b) => a.position - b.position);

  return (
    <div className="not-prose rounded-xl border">
      <ol className="divide-y divide-border/50">
        {ordered.map((source, index) => (
          <li key={source.id} className="flex items-baseline gap-1">
            <span className="w-8 shrink-0 pt-3 text-center font-mono text-xs text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <SourceRow source={source} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export { ReportSources };
