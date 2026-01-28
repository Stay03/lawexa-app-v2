'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import type { Note } from '@/types/note';
import {
  formatNotePrice,
  formatNoteDate,
  getNoteStatusVariant,
  getNoteStatusText,
  getNoteUrl,
} from '@/lib/utils/note-utils';

interface NoteCardProps {
  note: Note;
  showStatus?: boolean;
  showPrivacy?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Compact note list item for grouped display
 */
function NoteCard({
  note,
  showStatus = false,
  showPrivacy = false,
  className,
  style,
}: NoteCardProps) {
  const router = useRouter();
  const {
    title,
    slug,
    content_preview,
    tags,
    is_free,
    is_paid,
    is_private,
    status,
    thumbnail_url,
    user,
    created_at,
  } = note;

  // Format date
  const formattedDate = formatNoteDate(created_at);

  // Format price
  const priceDisplay = formatNotePrice(note);

  // Truncate preview to 200 characters
  const previewText = content_preview
    ? content_preview.length > 200
      ? `${content_preview.slice(0, 200).trim()}...`
      : content_preview
    : null;

  return (
    <Link
      href={getNoteUrl(note)}
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
          <h3 className="min-w-0 flex-1 text-[20px] font-medium text-foreground group-hover:text-primary sm:truncate">
            {title}
          </h3>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[16px] text-muted-foreground sm:flex-nowrap sm:gap-2.5">
            {/* Status badge */}
            {showStatus && (
              <Badge variant={getNoteStatusVariant(status)} className="text-[10px]">
                {getNoteStatusText(status)}
              </Badge>
            )}

            {/* Privacy indicator */}
            {showPrivacy && is_private && (
              <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}

            {/* Price badge */}
            <Badge variant={is_free ? 'secondary' : 'default'} className="text-[10px]">
              {priceDisplay}
            </Badge>

            {/* Date */}
            <span className="tabular-nums">{formattedDate}</span>

            <BookmarkButton
              type="note"
              id={note.id}
              isBookmarked={note.is_bookmarked}
              variant="icon"
              className="h-7 w-7"
            />
            <ChevronRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </div>

        {/* Author */}
        <div className="mt-1 flex items-center gap-1.5 text-[16px] text-muted-foreground">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-5 w-5 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span>{user.name}</span>
        </div>

        {/* Preview */}
        {previewText && (
          <p className="mt-2 line-clamp-2 text-[16px] text-muted-foreground">
            {previewText}
          </p>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.slice(0, 5).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`/notes?tags=${encodeURIComponent(tag)}`);
                }}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[16px] text-primary transition-colors hover:bg-primary/20"
              >
                {tag}
              </button>
            ))}
            {tags.length > 5 && (
              <span className="text-[16px] text-muted-foreground">
                +{tags.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export { NoteCard };
