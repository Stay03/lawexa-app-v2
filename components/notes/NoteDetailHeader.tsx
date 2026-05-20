'use client';

import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Note } from '@/types/note';
import {
  formatNotePrice,
  getNoteStatusText,
} from '@/lib/utils/note-utils';

interface NoteDetailHeaderProps {
  note: Note;
  showStatus?: boolean;
  className?: string;
  animationDelay?: number;
}

/**
 * Editorial hero for the note detail page.
 * Serif display title, italic meta line, inline tag row, hairline rule.
 */
function NoteDetailHeader({
  note,
  showStatus = false,
  className,
  animationDelay = 0,
}: NoteDetailHeaderProps) {
  const { title, user, created_at, is_private, status, tags } = note;

  const formattedDate = new Date(created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const priceDisplay = formatNotePrice(note);
  const hasTags = tags && tags.length > 0;

  // Build the meta line items in editorial order: byline, date, price/free,
  // optional private flag, optional draft/owner status.
  const metaItems: React.ReactNode[] = [
    <span key="author">By {user.name}</span>,
    <span key="date">{formattedDate}</span>,
    <span key="price">{priceDisplay}</span>,
  ];
  if (is_private) {
    metaItems.push(
      <span key="private" className="inline-flex items-center gap-1">
        <Lock className="h-3 w-3" aria-hidden />
        Private
      </span>
    );
  }
  if (showStatus) {
    metaItems.push(<span key="status">{getNoteStatusText(status)}</span>);
  }

  return (
    <header className={cn('space-y-5', className)}>
      <p
        className="note-editorial-eyebrow animate-in fade-in-0 fill-mode-both duration-300"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        Lawexa · Notes
      </p>

      <h1
        className="note-editorial-title animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500"
        style={{ animationDelay: `${animationDelay + 40}ms` }}
      >
        {title}
      </h1>

      <p
        className="note-editorial-meta animate-in fade-in-0 fill-mode-both duration-300"
        style={{ animationDelay: `${animationDelay + 120}ms` }}
      >
        {metaItems.map((node, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="meta-sep" aria-hidden>·</span>}
            {node}
          </React.Fragment>
        ))}
      </p>

      {hasTags && (
        <div
          className="note-editorial-tags animate-in fade-in-0 fill-mode-both flex flex-wrap items-center gap-x-1 gap-y-1.5 duration-300"
          style={{ animationDelay: `${animationDelay + 180}ms` }}
        >
          {tags.map((tag, idx) => (
            <React.Fragment key={tag}>
              {idx > 0 && <span className="tag-sep" aria-hidden>/</span>}
              <Link href={`/notes?tags=${encodeURIComponent(tag)}`}>{tag}</Link>
            </React.Fragment>
          ))}
        </div>
      )}

      <div
        className="note-editorial-rule animate-in fade-in-0 fill-mode-both duration-500"
        style={{ animationDelay: `${animationDelay + 240}ms` }}
        aria-hidden
      />
    </header>
  );
}

export { NoteDetailHeader };
