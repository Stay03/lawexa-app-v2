import { Globe, Calendar, BookOpen, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Country } from '@/types/case';
import type { StatuteStatus } from '@/types/statute';

/******************************************************************************
                               Constants
******************************************************************************/

const STATUS_BADGE_VARIANT: Record<StatuteStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  amended: 'secondary',
  repealed: 'destructive',
};

/******************************************************************************
                               Components
******************************************************************************/

interface StatuteDetailHeaderProps {
  title: string;
  shortTitle: string | null;
  country: Country | null;
  year: number;
  status: StatuteStatus;
  statusLabel: string;
  commencementDate: string | null;
  nodesCount: number;
  className?: string;
  animationDelay?: number;
}

/**
 * Hero header section for statute detail page
 */
function StatuteDetailHeader({
  title,
  shortTitle,
  country,
  year,
  status,
  statusLabel,
  commencementDate,
  nodesCount,
  className,
  animationDelay = 0,
}: StatuteDetailHeaderProps) {
  // Format commencement date if available
  const formattedDate = commencementDate
    ? new Date(commencementDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Title */}
      <div
        className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {shortTitle && shortTitle !== title && (
          <p className="mt-1 text-base text-muted-foreground">
            {shortTitle}
          </p>
        )}
      </div>

      {/* Metadata badges */}
      <div
        className="flex flex-wrap items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
        style={{ animationDelay: `${animationDelay + 50}ms` }}
      >
        {country && (
          <Badge variant="outline" className="gap-1.5">
            <Globe className="h-3 w-3" />
            {country.name}
          </Badge>
        )}
        <Badge variant="secondary" className="gap-1.5">
          <Calendar className="h-3 w-3" />
          {year}
        </Badge>
        <Badge variant={STATUS_BADGE_VARIANT[status]} className="gap-1.5">
          {statusLabel}
        </Badge>
        {formattedDate && (
          <Badge variant="secondary" className="gap-1.5">
            <BookOpen className="h-3 w-3" />
            Commenced {formattedDate}
          </Badge>
        )}
        {nodesCount > 0 && (
          <Badge variant="secondary" className="gap-1.5">
            <Hash className="h-3 w-3" />
            {nodesCount} {nodesCount === 1 ? 'section' : 'sections'}
          </Badge>
        )}
      </div>
    </div>
  );
}

export { StatuteDetailHeader };
