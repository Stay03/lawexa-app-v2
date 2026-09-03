import Link from 'next/link';
import { Scale, Calendar, Globe, Eye, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Court, Country } from '@/types/case';

interface CaseDetailHeaderProps {
  title: string;
  court: Court | null;
  country: Country | null;
  judgmentDate: string | null;
  tags: string[] | null;
  viewsCount: number;
  /**
   * True when a named provider supplied the judgment behind this case. The
   * provider itself is admin-only by the owner's instruction, so this badge
   * says that it is verified and never by whom.
   */
  isVerified?: boolean;
  className?: string;
  animationDelay?: number;
}

/**
 * Hero header section for case detail page
 */
function CaseDetailHeader({
  title,
  court,
  country,
  judgmentDate,
  tags,
  viewsCount,
  isVerified = false,
  className,
  animationDelay = 0,
}: CaseDetailHeaderProps) {
  // Format date if available
  const formattedDate = judgmentDate
    ? new Date(judgmentDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const hasMetadata = court || country || formattedDate || viewsCount > 0 || isVerified;
  const hasTags = tags && tags.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Title */}
      <h1
        className="text-2xl font-semibold tracking-tight animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {title}
      </h1>

      {/* Metadata badges */}
      {hasMetadata && (
        <div
          className="flex flex-wrap items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
          style={{ animationDelay: `${animationDelay + 50}ms` }}
        >
          {/* Verified leads the row: it qualifies every other badge beside it,
              because a court and a date are worth more when a named provider
              stands behind the judgment they describe. */}
          {isVerified && (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-600/30 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400"
              title="The full report behind this case came from a verified provider"
            >
              <ShieldCheck className="h-3 w-3" />
              Verified report
            </Badge>
          )}
          {court && (
            <Badge variant="outline" className="gap-1.5">
              <Scale className="h-3 w-3" />
              {court.name}
            </Badge>
          )}
          {country && (
            <Badge variant="outline" className="gap-1.5">
              <Globe className="h-3 w-3" />
              {country.name}
            </Badge>
          )}
          {formattedDate && (
            <Badge variant="secondary" className="gap-1.5">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </Badge>
          )}
          {viewsCount > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <Eye className="h-3 w-3" />
              {viewsCount} {viewsCount === 1 ? 'view' : 'views'}
            </Badge>
          )}
        </div>
      )}

      {/* Tags */}
      {hasTags && (
        <div
          className="flex flex-wrap gap-1.5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
          style={{ animationDelay: `${animationDelay + 100}ms` }}
        >
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/cases?tags=${encodeURIComponent(tag)}`}
              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export { CaseDetailHeader };
