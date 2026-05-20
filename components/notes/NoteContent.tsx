'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCaseMentionTooltips } from '@/lib/hooks/useCaseMentionTooltips';

interface NoteContentProps {
  content: string | null;
  animationDelay?: number;
  className?: string;
}

/**
 * Editorial body for a note. No Card chrome — the prose IS the page.
 * Click handler attaches client-side navigation for case mentions.
 */
function NoteContent({ content, animationDelay = 0, className }: NoteContentProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

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

  if (!content) {
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
      <div
        ref={contentRef}
        className="note-prose"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </article>
  );
}

export { NoteContent };
