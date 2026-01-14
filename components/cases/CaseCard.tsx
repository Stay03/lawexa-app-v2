'use client';

import Link from 'next/link';
import { ChevronRight, Scale, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Case } from '@/types/case';

interface CaseCardProps {
  caseItem: Case;
  className?: string;
}

/**
 * Compact case card for list display
 */
function CaseCard({ caseItem, className }: CaseCardProps) {
  const { title, slug, court, judgment_date } = caseItem;

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
        'group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h3 className="truncate font-medium text-foreground group-hover:text-primary">
          {title}
        </h3>
        {court && (
          <Badge variant="outline" className="shrink-0">
            <Scale className="mr-1 h-3 w-3" />
            {court.abbreviation || court.name}
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
        {formattedDate && (
          <span className="flex items-center gap-1 text-xs">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
        )}
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export { CaseCard };
