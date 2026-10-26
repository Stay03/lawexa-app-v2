'use client';

import { useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';

import type { ConversationSpaceRef } from '@/types/chat';
import { V2_SHELL_CONTENT_ID } from '@/v2/shell/shell-content';
import { MarkdownText } from '@/v2/features/conversations/conversation/markdown/MarkdownText';
import { ChatSidePanel } from '@/v2/features/conversations/conversation/side-panel/ChatSidePanel';
import { useSidePanel } from '@/v2/features/conversations/conversation/side-panel/SidePanelContext';
import { draftStatus } from '@/v2/features/conversations/conversation/draft/draft-blocks';
import { DRAFT_DOCUMENT, DraftBar, DraftEditor } from '@/v2/features/conversations/conversation/draft/DraftEditor';
import { reportDraftAt } from './report-drafts';

/**
 * ReportDraftPanel — a draft a Radar wrote into a report, open in the chat's
 * side panel (`?side=draft:N`, plan 5.5). The chat's draft panel finds its
 * draft among a transcript's answers; a report is one answer, so this finds it
 * in the report's own text (`report-drafts.ts`) and hands it to the same
 * editor: the reader edits it, saves it as a note (one note per draft, keyed
 * on the Radar's chat and the draft's number) and downloads Word or PDF.
 *
 * WHERE IT IS DRAWN. Below xl it is the chat panel's sheet over the page. On a
 * computer it is the chat panel's card (`frame: 'card'`) in a box beside the
 * report: the box rides the page's scroll (sticky) at the height of the
 * shell's scroll area, so the report reads on the left while the draft stays
 * in view. That height is measured, because the area's top is the header's
 * height, which changes with the pushed bar; a DOM write, no React state.
 */
export function ReportDraftPanel({
  narrative,
  draftOffset,
  conversationUuid,
  space,
}: {
  narrative: string;
  draftOffset: number;
  conversationUuid: string;
  space: ConversationSpaceRef | null;
}) {
  const panel = useSidePanel();
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    const scroller = document.getElementById(V2_SHELL_CONTENT_ID);
    if (!box || !scroller) return;
    const observer = new ResizeObserver(() => {
      box.style.setProperty('--v2-report-draft-h', `${scroller.clientHeight}px`);
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const target = panel?.target;
  if (target?.kind !== 'draft') return null;
  const draft = reportDraftAt(narrative, draftOffset, target.ordinal);

  return (
    <div
      ref={boxRef}
      className="xl:sticky xl:top-0 xl:h-[var(--v2-report-draft-h,100dvh)] xl:w-[min(50%,52rem)] xl:shrink-0 xl:py-3 xl:pr-3"
    >
      {draft ? (
        <ChatSidePanel label="Draft" title={draft.title} subtitle={draftStatus(draft, false)} icon={<DraftIcon />} bare>
          {draft.complete ? (
            <DraftEditor
              key={target.ordinal}
              conversationId={conversationUuid}
              ordinal={target.ordinal}
              title={draft.title}
              markdown={draft.body}
              font={{ font: draft.font, size: draft.size }}
              space={space}
            />
          ) : (
            // A report that stopped inside its draft: it reads, it does not edit.
            <div className="@container/draft">
              <DraftBar />
              <article className={DRAFT_DOCUMENT}>
                <MarkdownText content={draft.body} />
              </article>
            </div>
          )}
        </ChatSidePanel>
      ) : (
        <ChatSidePanel label="Draft" title="Draft" icon={<DraftIcon />} bare>
          <DraftBar />
          <p className="px-5 py-8 text-sm text-muted-foreground xl:px-12">This draft is not in this report.</p>
        </ChatSidePanel>
      )}
    </div>
  );
}

function DraftIcon() {
  return (
    <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
      <FileText className="size-[18px]" />
    </span>
  );
}
