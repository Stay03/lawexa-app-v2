'use client';

import Link from 'next/link';
import { User, Calendar, Lock, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Note } from '@/types/note';
import {
  formatNotePrice,
  formatNoteDate,
  getNoteStatusVariant,
  getNoteStatusText,
} from '@/lib/utils/note-utils';

interface NoteDetailHeaderProps {
  note: Note;
  showStatus?: boolean;
  className?: string;
  animationDelay?: number;
}

/**
 * Hero header section for note detail page
 */
function NoteDetailHeader({
  note,
  showStatus = false,
  className,
  animationDelay = 0,
}: NoteDetailHeaderProps) {
  const {
    title,
    user,
    created_at,
    is_free,
    is_private,
    status,
    tags,
  } = note;

  // Format date
  const formattedDate = new Date(created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Price display
  const priceDisplay = formatNotePrice(note);

  const hasTags = tags && tags.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Title */}
      <h1
        className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both text-2xl font-semibold tracking-tight duration-300"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {title}
      </h1>

      {/* Metadata badges */}
      <div
        className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-wrap items-center gap-2 duration-200"
        style={{ animationDelay: `${animationDelay + 50}ms` }}
      >
        {/* Author */}
        <Badge variant="outline" className="gap-1.5">
          <User className="h-3 w-3" />
          {user.name}
        </Badge>

        {/* Date */}
        <Badge variant="secondary" className="gap-1.5">
          <Calendar className="h-3 w-3" />
          {formattedDate}
        </Badge>

        {/* Privacy indicator */}
        {is_private && (
          <Badge variant="outline" className="gap-1.5">
            <Lock className="h-3 w-3" />
            Private
          </Badge>
        )}

        {/* Status (for owner) */}
        {showStatus && (
          <Badge variant={getNoteStatusVariant(status)}>
            {getNoteStatusText(status)}
          </Badge>
        )}

        {/* Price */}
        <Badge variant={is_free ? 'secondary' : 'default'}>
          {priceDisplay}
        </Badge>
      </div>

      {/* Tags */}
      {hasTags && (
        <div
          className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-wrap gap-1.5 duration-200"
          style={{ animationDelay: `${animationDelay + 100}ms` }}
        >
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/notes?tags=${encodeURIComponent(tag)}`}
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

export { NoteDetailHeader };
