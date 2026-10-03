'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCaseMentionTooltips } from '@/lib/hooks/useCaseMentionTooltips';
import { renderNoteNodes } from '@/lib/notes/note-elements';
import { parseNoteHtml } from '@/lib/notes/note-html';

interface NoteContentProps {
  content: string | null;
  animationDelay?: number;
  className?: string;
}

/**
 * Editorial body for a note. No Card chrome — the prose IS the page.
 * Click handler attaches client-side navigation for case mentions.
 *
 * The note's HTML comes from any signed-in author and is stored as sent, so it
 * is never written into the page as HTML. It goes through the same walker as
 * v2's reader (`lib/notes/note-html.ts`: a closed set of tags, checked links
 * and image sources, no author attributes) and renders as React elements, so a
 * script or event attribute in a note cannot run (security fix, 3 October 2026).
 * Case mentions keep the anchor shape the tooltip hook and click handler find.
 */
function NoteContent({ content, animationDelay = 0, className }: NoteContentProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => parseNoteHtml(content), [content]);

  useCaseMentionTooltips({
    containerRef: contentRef,
    enabled: !!content,
    content,
  });

  const handleMentionClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const mention = target.closest('a[data-type="case-mention"]');
      if (mention) {
        e.preventDefault();
        const slug = mention.getAttribute('data-case-slug');
        if (slug) {
          router.push(`/cases/${slug}`);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    const element = contentRef.current;
    if (element) {
      element.addEventListener('click', handleMentionClick);
      return () => element.removeEventListener('click', handleMentionClick);
    }
  }, [handleMentionClick]);

  if (!content || nodes.length === 0) {
    return null;
  }

  return (
    <article
      className={cn(
        'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500',
        'pt-2 pb-2',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div ref={contentRef} className="note-prose">
        {renderNoteNodes(nodes)}
      </div>
    </article>
  );
}

export { NoteContent };
