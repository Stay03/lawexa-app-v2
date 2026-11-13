'use client';

import { useMemo, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { diffBlocks } from '@/lib/utils/block-diff';
import { diffCounts } from '@/lib/utils/line-diff';
import { MarkdownText } from '../markdown/MarkdownText';
import { ScrollKeepContext } from '../markdown/scroll-keep-context';

/**
 * A skill's steps as formatted text, the way a Lawexa answer reads (Stay,
 * 13 November 2026, 2b436b4f: "Can the text be rendered nicely instead of the
 * code view"). Inside the card's own scroll box, so the transcript's
 * keep-your-place deferral is switched off: every block draws at once.
 */
function StepsBox({ children }: { children: ReactNode }) {
  return (
    <ScrollKeepContext.Provider value={null}>
      <div className="max-h-80 overflow-y-auto overscroll-contain text-[13px] leading-relaxed text-foreground">{children}</div>
    </ScrollKeepContext.Provider>
  );
}

/** A new skill's steps, in full. */
export function InstructionsText({ text }: { text: string }) {
  return (
    <StepsBox>
      <MarkdownText content={text} />
    </StepsBox>
  );
}

/**
 * A change's steps against the live skill, by block (a paragraph, a heading, a
 * list, a table): added blocks with a green edge and a +, removed blocks with
 * a red edge and struck through, unchanged blocks plain. Each block renders as
 * formatted text. The marks are words for a screen reader too, so the
 * difference is not carried by colour alone. Admin AI Skills draws its own over
 * the same diff (`lib/utils/block-diff`), since v1 and v2 components may not
 * import each other.
 */
export function InstructionsDiff({ before, after, className }: { before: string; after: string; className?: string }) {
  const diff = useMemo(() => diffBlocks(before, after), [before, after]);
  const { added, removed } = diffCounts(diff);
  return (
    <div className={className}>
      <p className="mb-1.5 text-xs text-muted-foreground">
        {added === 0 && removed === 0
          ? 'No change to the steps.'
          : `${added} ${added === 1 ? 'part' : 'parts'} added, ${removed} removed.`}
      </p>
      <StepsBox>
        <div className="space-y-1.5">
          {diff.map((block, index) => (
            <div
              key={index}
              className={cn(
                'relative border-l-2 py-0.5 pl-3 pr-6',
                block.kind === 'added' && 'rounded-r-md border-emerald-500 bg-emerald-500/[0.07]',
                block.kind === 'removed' &&
                  'rounded-r-md border-red-500 bg-red-500/[0.07] text-muted-foreground line-through decoration-red-500/60 [&_*]:line-through',
                block.kind === 'same' && 'border-transparent',
              )}
            >
              {block.kind !== 'same' && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-2 top-1 select-none text-xs font-semibold no-underline',
                    block.kind === 'added' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
                  )}
                >
                  {block.kind === 'added' ? '+' : '−'}
                </span>
              )}
              {block.kind !== 'same' && <span className="sr-only">{block.kind === 'added' ? 'Added: ' : 'Removed: '}</span>}
              <MarkdownText content={block.text} />
            </div>
          ))}
        </div>
      </StepsBox>
    </div>
  );
}
