'use client';

import { FilePenLine, FileX, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useSidePanel } from '../side-panel/SidePanelContext';
import { ADDED_WORDS, REMOVED_WORDS } from './DraftChangesView';
import { draftEditStatus, type DraftEditBlock } from './draft-blocks';
import { draftGroupKey } from './draft-versions';

/**
 * DraftEditCard — a change Lawexa makes to part of a draft (`<draft-edit>`,
 * Stay's option A, thread 803b7234), where it sits in the answer: "Editing
 * Tenancy Agreement…" and each find/replace pair as it arrives, the old words
 * struck through and the new ones underlined, as "Show changes" marks them.
 * No tag is ever shown as text.
 *
 * Once the answer is saved, the server applies the change: one it made is read
 * as the whole new version and drawn as that version's own card
 * (lib/utils/draft-edits.ts), and one it could not make stays here, saying so,
 * with the change it tried greyed.
 *
 * The draft is named by its id, from the chat's drafts (the newest title of
 * its group); a chat that keeps no versions, or an id it has not seen, reads
 * "the draft".
 */
export function DraftEditCard({ edit, live }: { edit: DraftEditBlock; live: boolean }) {
  const panel = useSidePanel();
  const title = (edit.id ? panel?.draftTitle(draftGroupKey({ title: '', id: edit.id })) : null) ?? 'the draft';
  const writing = live && !edit.complete;
  const heading = edit.failed
    ? 'Lawexa couldn’t make this change'
    : writing
      ? `Editing ${title}…`
      : `Changes to ${title}`;

  return (
    <div className="rounded-2xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            edit.failed ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
          )}
        >
          {edit.failed ? <FileX className="size-5" /> : <FilePenLine className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-snug font-semibold text-foreground">
            {heading}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            {writing ? <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" /> : null}
            {edit.failed ? `${title} · ${draftEditStatus(edit, live)}` : draftEditStatus(edit, live)}
          </span>
        </span>
      </div>
      {edit.pairs.length > 0 ? (
        <ol
          aria-label="Changes"
          className={cn(
            'mt-3 space-y-2 border-t border-border/70 pt-3 text-sm leading-relaxed',
            edit.failed && 'opacity-60',
          )}
        >
          {edit.pairs.map((pair, index) => (
            <li key={index} className="max-h-40 overflow-hidden break-words whitespace-pre-wrap">
              {pair.find ? <del className={REMOVED_WORDS}>{pair.find}</del> : null}
              {pair.find && pair.replace ? ' ' : null}
              {pair.replace ? <ins className={ADDED_WORDS}>{pair.replace}</ins> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
