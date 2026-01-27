'use client';

import Link from 'next/link';
import { ChevronRight, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrendingCaseDetailItem } from '@/types/trending';

interface TrendingCaseCardProps {
  item: TrendingCaseDetailItem;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Compact trending case list item for grouped display.
 * Similar to CaseCard but uses trending-specific fields.
 */
function TrendingCaseCard({ item, className, style }: TrendingCaseCardProps) {
  const { title, slug, court, country, judgment_date, citation, views_count } = item;

  // Format date if available
  const formattedDate = judgment_date
    ? new Date(judgment_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Link
      href={`/cases/${slug}`}
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
        <h3 className="min-w-0 flex-1 text-sm font-medium text-foreground group-hover:text-primary sm:truncate">
          {title}
        </h3>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:flex-nowrap sm:gap-2.5">
          {country && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
              {country.code}
            </span>
          )}
          {court && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
              {court}
            </span>
          )}
          {formattedDate && (
            <span className="tabular-nums">{formattedDate}</span>
          )}
          {views_count > 0 && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {views_count}
              </span>
            </>
          )}
          <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Citation */}
      {citation && (
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {citation}
        </p>
      )}
    </Link>
  );
}

export { TrendingCaseCard };
