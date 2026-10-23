'use client';

import { FileText, Loader2, PanelRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { MarkdownText } from '../markdown/MarkdownText';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { draftStatus, type DraftBlock } from './draft-blocks';

/**
 * DraftCard — a draft Lawexa wrote, where it sits in the answer: its title,
 * how far it has got ("Writing · 420 words" while it streams), and Open, which
 * shows it in the side panel beside the chat (`?side=draft:N`). The draft's
 * text is the panel's, not the transcript's, so a long agreement does not push
 * the conversation off the screen.
 *
 * Outside a chat that has the panel (none today, but the card must never be a
 * dead button), it shows the draft's text in place instead.
 */
export function DraftCard({
  draft,
  ordinal,
  live,
}: {
  draft: DraftBlock;
  ordinal: number;
  /** The answer is still arriving: an open draft is being written, not cut short. */
  live: boolean;
}) {
  const panel = useSidePanel();
  const showing = panel?.target?.kind === 'draft' && panel.target.ordinal === ordinal && !panel.closing;
  const status = draftStatus(draft, live);

  if (!panel) {
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-3">
        <p className="mb-2 text-sm font-semibold text-foreground">{draft.title}</p>
        <MarkdownText content={draft.body} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => panel.open({ kind: 'draft', ordinal })}
      aria-pressed={showing}
      className={cn(
        'v2-interactive group flex w-full items-center gap-3 rounded-2xl border bg-card px-3.5 py-3 text-left transition-colors',
        showing ? 'border-primary/50 bg-primary/[0.06]' : 'border-border hover:border-primary/40',
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"
      >
        <FileText className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-snug font-semibold text-foreground">{draft.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {draft.complete || !live ? null : (
            <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />
          )}
          {status}
        </span>
      </span>
      <span
        className={cn(
          'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors',
          showing ? 'bg-primary/15 text-primary' : 'bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground',
        )}
      >
        <PanelRight aria-hidden className="size-4" />
        {showing ? 'Showing' : 'Open'}
      </span>
    </button>
  );
}
