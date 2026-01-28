'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useCaseMentionTooltips } from '@/lib/hooks/useCaseMentionTooltips';

interface NoteContentProps {
  content: string | null;
  animationDelay?: number;
  className?: string;
}

/**
 * Displays the note content with proper formatting
 * Handles click events on case mentions for client-side navigation
 */
function NoteContent({ content, animationDelay = 0, className }: NoteContentProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  // Attach hover tooltips to case mentions
  useCaseMentionTooltips({
    containerRef: contentRef,
    enabled: !!content,
    content,
  });

  // Handle clicks on case mentions for client-side navigation
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
    <Card
      className={cn(
        'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-300',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardContent className="pt-6">
        <div
          ref={contentRef}
          className={cn(
            'prose dark:prose-invert max-w-none text-[18px]',
            '[&_p]:my-2 [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-2',
            '[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1',
            '[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic',
            '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm',
            '[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto',
            '[&_img]:rounded-lg [&_img]:max-w-full [&_img]:h-auto',
            '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
            // Case mention links should not have underline (handled by .case-mention class)
            '[&_a.case-mention]:no-underline'
          )}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </CardContent>
    </Card>
  );
}

export { NoteContent };
