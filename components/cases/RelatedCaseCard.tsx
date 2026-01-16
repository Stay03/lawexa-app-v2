'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RelatedCase } from '@/types/case';

/******************************************************************************
                               Types
******************************************************************************/

interface IRelatedCaseCardProps {
  caseItem: RelatedCase;
  className?: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Compact card for displaying related cases (similar, cited, cited_by)
 */
function RelatedCaseCard({ caseItem, className }: IRelatedCaseCardProps) {
  const { title, slug, citation, judgment_date, court, country } = caseItem;

  // Format date if available
  const formattedDate = judgment_date
    ? new Date(judgment_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <Link
      href={`/cases/${slug}`}
      className={cn(
        'group flex items-center justify-between gap-3',
        'rounded-lg border bg-card p-3',
        'transition-colors hover:bg-muted/50 hover:border-primary/20',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h4 className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">
          {title}
        </h4>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {citation && (
            <span className="font-medium">{citation}</span>
          )}
          {(court || country || formattedDate) && citation && (
            <span className="text-muted-foreground/40">|</span>
          )}
          {court && (
            <span>{court.name}</span>
          )}
          {country && !court && (
            <span>{country.name}</span>
          )}
          {formattedDate && (
            <span className="tabular-nums">{formattedDate}</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-50 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
    </Link>
  );
}

/******************************************************************************
                               Export
******************************************************************************/

export { RelatedCaseCard };
export type { IRelatedCaseCardProps };
