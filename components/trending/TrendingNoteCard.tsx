'use client';

import Link from 'next/link';
import { ChevronRight, Eye, Flame, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TrendingNoteDetailItem } from '@/types/trending';

interface TrendingNoteCardProps {
  item: TrendingNoteDetailItem;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Compact trending note list item for grouped display.
 * Similar to NoteCard but uses trending-specific fields.
 */
function TrendingNoteCard({ item, className, style }: TrendingNoteCardProps) {
  const {
    title,
    slug,
    content_preview,
    tags,
    is_free,
    price_ngn,
    thumbnail_url,
    author,
    trending_score,
    views_count,
    unique_viewers,
  } = item;

  // Format price display
  const priceDisplay = is_free
    ? 'Free'
    : price_ngn
      ? `₦${price_ngn}`
      : 'Free';

  // Truncate preview to 200 characters
  const previewText = content_preview
    ? content_preview.length > 200
      ? `${content_preview.slice(0, 200).trim()}...`
      : content_preview
    : null;

  return (
    <Link
      href={`/notes/${slug}`}
      className={cn(
        'group flex gap-4',
        'px-5 py-4',
        'transition-colors hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className
      )}
      style={style}
    >
      {/* Thumbnail */}
      {thumbnail_url && (
        <div className="hidden shrink-0 sm:block">
          <div className="relative h-16 w-24 overflow-hidden rounded-md bg-muted">
            <img
              src={thumbnail_url}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header: Title and metadata */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h3 className="min-w-0 flex-1 text-sm font-medium text-foreground group-hover:text-primary sm:truncate">
            {title}
          </h3>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:flex-nowrap sm:gap-2.5">
            {/* Price badge */}
            <Badge variant={is_free ? 'secondary' : 'default'} className="text-[10px]">
              {priceDisplay}
            </Badge>

            <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </div>

        {/* Author */}
        {author && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{author.name}</span>
          </div>
        )}

        {/* Preview */}
        {previewText && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {previewText}
          </p>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                {tag}
              </span>
            ))}
            {tags.length > 5 && (
              <span className="text-xs text-muted-foreground">
                +{tags.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Trending stats */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-orange-500">
            <Flame className="h-3.5 w-3.5" />
            {trending_score}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {views_count} {views_count === 1 ? 'view' : 'views'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {unique_viewers} {unique_viewers === 1 ? 'viewer' : 'viewers'}
          </span>
        </div>
      </div>
    </Link>
  );
}

export { TrendingNoteCard };
