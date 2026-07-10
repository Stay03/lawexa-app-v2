'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreatmentBadge } from './TreatmentBadge';
import type { RelatedCaseDisplay } from '@/lib/utils/related-cases';

/******************************************************************************
                               Types
******************************************************************************/

interface IRelatedCaseCardProps {
  caseItem: RelatedCaseDisplay;
  className?: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Compact card for displaying related cases (similar, cited, cited_by).
 * Non-linkable rows (external citations with no case in our DB) render as a
 * plain, non-interactive card.
 */
function RelatedCaseCard({ caseItem, className }: IRelatedCaseCardProps) {
  const { title, href, citation, judgmentDate, court, country, treatment } = caseItem;

  // Format date if available
  const formattedDate = judgmentDate
    ? new Date(judgmentDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      })
    : null;

  const content = (
    <>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h4
            className={cn(
              'text-sm font-medium text-foreground line-clamp-1',
              href && 'group-hover:text-primary'
            )}
          >
            {title}
          </h4>
          <TreatmentBadge treatment={treatment} className="shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {citation && <span className="font-medium">{citation}</span>}
          {(court || country || formattedDate) && citation && (
            <span className="text-muted-foreground/40">|</span>
          )}
          {court && <span>{court.name}</span>}
          {country && !court && <span>{country.name}</span>}
          {formattedDate && <span className="tabular-nums">{formattedDate}</span>}
        </div>
      </div>
      {href && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-50 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
      )}
    </>
  );

  const baseClass = cn(
    'group flex items-center justify-between gap-3',
    'rounded-lg border bg-card p-3',
    className
  );

  if (!href) {
    return <div className={cn(baseClass, 'cursor-default')}>{content}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        baseClass,
        'transition-colors hover:bg-muted/50 hover:border-primary/20',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      {content}
    </Link>
  );
}

/******************************************************************************
                               Export
******************************************************************************/

export { RelatedCaseCard };
export type { IRelatedCaseCardProps };
