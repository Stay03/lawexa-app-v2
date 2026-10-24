import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { QuizSource } from '@/types/channel-quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { quizSourceView } from './quiz-source';

const LINK = cn('rounded-sm font-medium text-foreground underline-offset-2 hover:underline', FOCUS_RING);

/**
 * Where a question or a scenario comes from: "Source · Case", the item's
 * title as a link, and the quote it rests on. Plain text and a link, no chip
 * (`quiz-source.ts` decides what it says). Nothing when there is no source.
 */
export function QuizSourceLine({ source, className }: { source: QuizSource | null | undefined; className?: string }) {
  const view = quizSourceView(source);
  if (!view) return null;
  return (
    <div className={cn('text-xs leading-relaxed text-muted-foreground', className)}>
      <p className="min-w-0">
        <span>Source · {view.label}: </span>
        {view.href === null ? (
          <span className="font-medium text-foreground/85">{view.title}</span>
        ) : view.external ? (
          <a href={view.href} target="_blank" rel="noopener noreferrer" className={cn(LINK, 'inline-flex items-center gap-1')}>
            {view.title}
            <ExternalLink aria-hidden className="size-3 shrink-0" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <Link href={view.href} className={LINK}>
            {view.title}
          </Link>
        )}
      </p>
      {view.quote ? <p className="mt-0.5 text-muted-foreground/90">“{view.quote}”</p> : null}
    </div>
  );
}
