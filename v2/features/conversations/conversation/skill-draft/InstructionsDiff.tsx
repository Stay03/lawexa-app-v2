import { cn } from '@/lib/utils';
import { diffCounts, type DiffLine } from '@/lib/utils/line-diff';

/**
 * A skill's steps marked against another version, line by line: added lines
 * green with a +, removed lines red with a −, unchanged lines plain. The marks
 * are words for a screen reader too, so the difference is not carried by
 * colour alone. Admin AI Skills draws its own over the same diff
 * (`lib/utils/line-diff`), since v1 and v2 components may not import each other.
 */
export function InstructionsDiff({ diff, className }: { diff: readonly DiffLine[]; className?: string }) {
  const { added, removed } = diffCounts(diff);
  return (
    <div className={className}>
      <p className="mb-1.5 text-xs text-muted-foreground">
        {added === 0 && removed === 0
          ? 'No change to the steps.'
          : `${added} ${added === 1 ? 'line' : 'lines'} added, ${removed} removed.`}
      </p>
      <ol className="max-h-80 overflow-y-auto overscroll-contain rounded-xl border border-border font-mono text-[12px] leading-relaxed">
        {diff.map((line, index) => (
          <li
            key={index}
            className={cn(
              'flex gap-2 px-2.5 whitespace-pre-wrap break-words',
              line.kind === 'added' && 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
              line.kind === 'removed' && 'bg-red-500/10 text-red-900 line-through decoration-red-500/50 dark:text-red-200',
              line.kind === 'same' && 'text-muted-foreground',
            )}
          >
            <span aria-hidden className="w-3 shrink-0 select-none">
              {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ''}
            </span>
            <span className="sr-only">{line.kind === 'added' ? 'Added: ' : line.kind === 'removed' ? 'Removed: ' : ''}</span>
            <span className="min-w-0 flex-1">{line.text || ' '}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
