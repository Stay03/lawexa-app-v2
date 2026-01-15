'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Case } from '@/types/case';

interface CaseCardProps {
  caseItem: Case;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Compact case list item for grouped display
 */
function CaseCard({ caseItem, className, style }: CaseCardProps) {
  const { title, slug, court, judgment_date, principles, tags, country } = caseItem;

  // Format date if available
  const formattedDate = judgment_date
    ? new Date(judgment_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  // Truncate principles to 300 characters
  const principlesPreview = principles
    ? principles.length > 300
      ? `${principles.slice(0, 300).trim()}...`
      : principles
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
              {country.abbreviation || country.code}
            </span>
          )}
          {court && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
              {court.name}
            </span>
          )}
          {formattedDate && (
            <span className="tabular-nums">{formattedDate}</span>
          )}
          <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Principles preview */}
      {principlesPreview && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {principlesPreview}
        </p>
      )}

      {/* Tags - clickable to filter */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 5).map((tag) => (
            <Link
              key={tag}
              href={`/cases?tags=${encodeURIComponent(tag)}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20"
            >
              {tag}
            </Link>
          ))}
          {tags.length > 5 && (
            <span className="text-xs text-muted-foreground">
              +{tags.length - 5} more
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

export { CaseCard };
