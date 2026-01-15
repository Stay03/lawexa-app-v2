import Link from 'next/link';
import { Scale, Calendar, Globe, FileText, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Court, Country } from '@/types/case';

interface CaseDetailHeaderProps {
  title: string;
  court: Court | null;
  country: Country | null;
  judgmentDate: string | null;
  citation: string | null;
  tags: string[] | null;
  viewsCount: number;
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
  citation,
  tags,
  viewsCount,
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

  const hasMetadata = court || country || formattedDate || citation || viewsCount > 0;
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
          {citation && (
            <Badge variant="secondary" className="gap-1.5">
              <FileText className="h-3 w-3" />
              {citation}
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
