'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { MessageContent } from '@/components/prompt-kit/message';
import { cn } from '@/lib/utils';
import { diffBlocks } from '@/lib/utils/block-diff';
import { diffCounts, diffLines } from '@/lib/utils/line-diff';

/**
 * A skill's steps as formatted text, with the admin's markdown renderer (Stay,
 * 13 November 2026, 2b436b4f: "Can the text be rendered nicely instead of the
 * code view"). The chat's draft card draws its own over the same shared code
 * (`lib/utils/block-diff`), since v1 and v2 components may not import each other.
 */
export function SkillInstructionsText({ text }: { text: string }) {
  return (
    <div className="max-h-[32rem] overflow-y-auto rounded-md border p-3">
      <MessageContent markdown>{text}</MessageContent>
    </div>
  );
}

/**
 * A draft's steps against another version's, by block (a paragraph, a heading,
 * a list, a table): added blocks with a green edge and a +, removed blocks with
 * a red edge and struck through, unchanged blocks plain, each as formatted
 * text. The marks are words for a screen reader too, so the difference is not
 * carried by colour alone. "Show raw text" turns to the plain line-by-line
 * diff, for checking a change to the markdown itself.
 */
export function SkillInstructionsDiff({ before, after }: { before: string; after: string }) {
  const [raw, setRaw] = useState(false);
  const blocks = useMemo(() => diffBlocks(before, after), [before, after]);
  const lines = useMemo(() => (raw ? diffLines(before, after) : []), [raw, before, after]);
  const { added, removed } = diffCounts(raw ? lines : blocks);
  const unit = raw ? 'line' : 'part';
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {added === 0 && removed === 0
            ? 'No change to the steps.'
            : `${added} ${added === 1 ? unit : `${unit}s`} added, ${removed} removed.`}
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" aria-pressed={raw} onClick={() => setRaw((on) => !on)}>
          {raw ? 'Show formatted text' : 'Show raw text'}
        </Button>
      </div>
      {raw ? (
        <ol className="max-h-[32rem] overflow-y-auto rounded-md border font-mono text-xs leading-relaxed">
          {lines.map((line, index) => (
            <li
              key={index}
              className={cn(
                'flex gap-2 px-3 whitespace-pre-wrap break-words',
                line.kind === 'added' && 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
                line.kind === 'removed' && 'bg-red-500/10 text-red-900 line-through decoration-red-500/50 dark:text-red-200',
                line.kind === 'same' && 'text-muted-foreground',
              )}
            >
              <span aria-hidden className="w-3 shrink-0 select-none">
                {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ''}
              </span>
              <span className="sr-only">{line.kind === 'added' ? 'Added: ' : line.kind === 'removed' ? 'Removed: ' : ''}</span>
              <span className="min-w-0 flex-1">{line.text || ' '}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="max-h-[32rem] space-y-1.5 overflow-y-auto rounded-md border p-2">
          {blocks.map((block, index) => (
            <div
              key={index}
              className={cn(
                'relative border-l-2 py-0.5 pl-3 pr-7',
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
                    'absolute right-2 top-1 select-none text-xs font-semibold',
                    block.kind === 'added' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
                  )}
                >
                  {block.kind === 'added' ? '+' : '−'}
                </span>
              )}
              {block.kind !== 'same' && <span className="sr-only">{block.kind === 'added' ? 'Added: ' : 'Removed: '}</span>}
              <MessageContent markdown>{block.text}</MessageContent>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
