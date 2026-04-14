'use client';

import { MessageContent } from '@/components/prompt-kit';
import { cn } from '@/lib/utils';
import type { NarrationMessage } from '@/types/chat';

interface NarrationDisplayProps {
  message: NarrationMessage;
}

export function NarrationDisplay({ message }: NarrationDisplayProps) {
  if (!message.content?.trim()) return null;

  const hasRichContent =
    message.content.length > 200 ||
    message.content.includes('#') ||
    /<\w/.test(message.content);

  return (
    <div className="px-4">
      <div className="mx-auto max-w-2xl">
        <div
          className={cn(
            'border-l-2 border-border/60 pl-3 py-1',
            !hasRichContent && 'text-muted-foreground text-sm italic'
          )}
        >
          {hasRichContent ? (
            <MessageContent
              className="prose prose-sm dark:prose-invert text-muted-foreground"
              markdown
            >
              {message.content}
            </MessageContent>
          ) : (
            <p>{message.content.trim()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
