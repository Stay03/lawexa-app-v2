'use client';

import { Scale, BookOpen, Quote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RelatedCaseCard } from './RelatedCaseCard';
import { cn } from '@/lib/utils';
import type { RelatedCase } from '@/types/case';

/******************************************************************************
                               Types
******************************************************************************/

type RelationType = 'similar' | 'cited' | 'cited_by';

interface IRelatedCasesSectionProps {
  type: RelationType;
  cases: RelatedCase[];
  className?: string;
  animationDelay?: number;
}

/******************************************************************************
                               Constants
******************************************************************************/

const SECTION_CONFIG: Record<RelationType, {
  title: string;
  icon: typeof Scale;
  emptyMessage: string;
}> = {
  similar: {
    title: 'Similar Cases',
    icon: Scale,
    emptyMessage: 'No similar cases found',
  },
  cited: {
    title: 'Cases Cited',
    icon: BookOpen,
    emptyMessage: 'This case does not cite other cases',
  },
  cited_by: {
    title: 'Cited By',
    icon: Quote,
    emptyMessage: 'This case has not been cited by other cases',
  },
};

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Section component for displaying related cases (similar, cited, or cited_by)
 */
function RelatedCasesSection({
  type,
  cases,
  className,
  animationDelay = 0,
}: IRelatedCasesSectionProps) {
  const config = SECTION_CONFIG[type];
  const Icon = config.icon;

  // Don't render if no cases
  if (!cases || cases.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn(
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {config.title}
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {cases.length} {cases.length === 1 ? 'case' : 'cases'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {cases.map((relatedCase) => (
            <RelatedCaseCard key={relatedCase.id} caseItem={relatedCase} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/******************************************************************************
                               Export
******************************************************************************/

export { RelatedCasesSection };
export type { IRelatedCasesSectionProps, RelationType };
