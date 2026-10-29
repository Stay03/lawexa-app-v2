'use client';

import { useEffect, useRef } from 'react';
import { FileText, Loader2, PanelRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { MarkdownText } from '../markdown/MarkdownText';
import { useV2ChatContext } from '../chat-context';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { draftStatus, type DraftBlock } from './draft-blocks';
import { draftGroupKey, draftVersionLabel } from './draft-versions';
import { useDraftEdited } from './use-draft-notes';

/**
 * The chat's message box is focused or has words in it: the shell's box on a
 * chat's route (ChatDock), the case chat's own on a case page (CaseChatCore).
 */
function readerIsTyping(): boolean {
  const box = document.querySelector<HTMLTextAreaElement>(
    '[data-v2-chat-dock] textarea, [data-v2-case-chat-composer] textarea',
  );
  if (!box) return false;
  return document.activeElement === box || box.value.trim() !== '';
}

/**
 * DraftCard — a draft Lawexa wrote, where it sits in the answer: its title,
 * how far it has got ("Writing · 420 words" while it streams), and Open, which
 * shows it in the side panel beside the chat (`?side=draft:N`). The draft's
 * text is the panel's, not the transcript's, so a long agreement does not push
 * the conversation off the screen.
 *
 * Outside a chat that has the panel (the statute page's chat, which no page
 * hosts a panel for: side-panel-host.tsx), it shows the draft's text in place,
 * so the card is never a dead button.
 *
 * VERSIONS (Stay, 27 October 2026, option B). A draft Lawexa wrote again after
 * a change reads "Version 2 · Draft · 1,240 words", and every older version's
 * card is greyed, so the newest one is the one the eye finds. An older card
 * still opens its own version.
 *
 * EDITED (drafts saved as notes, thread 1e44eb39). Every draft is a note, and
 * the newest version's card adds "· Edited" once the reader has changed it,
 * so they know Lawexa will work from their text.
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
  const version = panel?.draftVersion(ordinal, draftGroupKey(draft)) ?? null;
  const versionLabel = draftVersionLabel(version);
  const older = version !== null && !version.latest;
  // EDITED (drafts saved as notes): the reader changed the newest version in
  // its note, so Lawexa will work from their text.
  const chat = useV2ChatContext();
  const edited = useDraftEdited(chat?.conversationId, draftGroupKey(draft), Boolean(panel) && draft.complete && !older);

  // A DRAFT OPENS ITSELF WHEN LAWEXA FINISHES IT (Stay, 24 October 2026: "auto
  // open when its done"). The card saw it being written, and its closing tag
  // has now arrived: the panel opens on it, on a phone and a computer, unless
  // the reader is writing in the message box (focused, or with words in it),
  // where a sheet over the box would take their sentence away. A draft that was
  // already finished when the card appeared (a saved answer) opens only on a tap.
  const seenWriting = useRef(!draft.complete && live);
  useEffect(() => {
    if (!draft.complete) {
      if (live) seenWriting.current = true;
      return;
    }
    if (!seenWriting.current || !panel) return;
    seenWriting.current = false;
    if (!readerIsTyping()) panel.open({ kind: 'draft', ordinal });
  }, [draft.complete, live, panel, ordinal]);

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
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
          older ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
        )}
      >
        <FileText className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] leading-snug font-semibold',
            older ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {draft.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {draft.complete || !live ? null : (
            <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />
          )}
          {versionLabel ? `${versionLabel} · ${status}` : status}
          {edited ? ' · Edited' : null}
          {older ? <span className="sr-only">, an older version</span> : null}
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
