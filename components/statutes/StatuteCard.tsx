'use client';

import Link from 'next/link';
import { ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import type { Statute } from '@/types/statute';

/******************************************************************************
                               Constants
******************************************************************************/

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amended: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  repealed: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

/******************************************************************************
                               Components
******************************************************************************/

interface StatuteCardProps {
  statute: Statute;
  className?: string;
  style?: React.CSSProperties;
  searchQuery?: string;
}

/**
 * Compact statute list item for grouped display
 */
function StatuteCard({ statute, className, style, searchQuery }: StatuteCardProps) {
  const { title, short_title, slug, country, year, status, status_label, description, preamble } = statute;

  // Use description or preamble as preview, truncated
  const preview = description || preamble;
  const previewText = preview
    ? preview.length > 200
      ? `${preview.slice(0, 200).trim()}...`
      : preview
    : null;

  // Construct URL with search query if provided
  const href = searchQuery?.trim()
    ? `/statutes/${slug}?q=${encodeURIComponent(searchQuery)}`
    : `/statutes/${slug}`;

  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-3',
        'px-5 py-4',
        'transition-colors hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className
      )}
      style={style}
    >
      {/* Header: Title and metadata */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[20px] font-medium text-foreground group-hover:text-primary sm:truncate">
            {title}
          </h3>
          {short_title && short_title !== title && (
            <p className="mt-0.5 text-[14px] text-muted-foreground sm:truncate">
              {short_title}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[16px] text-muted-foreground sm:flex-nowrap sm:gap-2.5">
          {country && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
              {country.abbreviation || country.code}
            </span>
          )}
          <span className="flex items-center gap-1 tabular-nums">
            <Calendar className="h-3 w-3" />
            {year}
          </span>
          <span className={cn('rounded px-1.5 py-0.5 text-[13px] font-medium', STATUS_STYLES[status] || '')}>
            {status_label}
          </span>
          <BookmarkButton
            type="statute"
            id={statute.id}
            isBookmarked={statute.is_bookmarked}
            variant="icon"
            className="h-7 w-7"
          />
          <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Description preview */}
      {previewText && (
        <p className="line-clamp-2 text-[16px] text-muted-foreground">
          {previewText}
        </p>
      )}
    </Link>
  );
}

export { StatuteCard };
