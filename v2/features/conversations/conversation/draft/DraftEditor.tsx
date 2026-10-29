'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Content } from '@tiptap/core';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Check, Copy, MoreHorizontal, Redo2, Search, Undo2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { AlignMenu } from '@/v2/features/notes/editor/AlignMenu';
import { FontMenu, FontSizeMenu, SizeMenu } from '@/v2/features/notes/editor/FontMenus';
import { createNoteExtensions } from '@/v2/features/notes/editor/extensions';
import { FindBar } from '@/v2/features/notes/editor/FindBar';
import { isFindShortcut, selectionSeed } from '@/v2/features/notes/editor/find-replace';
import {
  applyAlign,
  applyStyle,
  runFormat,
  useFormatState,
  type FormatState,
} from '@/v2/features/notes/editor/formatting';
import { createCaseMentionStore } from '@/v2/features/notes/editor/mention-store';
import { draftMirrorQuery, noteMirrorKey } from '@/v2/features/notes/editor/draft-mirror';
import { useNoteAutosave } from '@/v2/features/notes/editor/use-autosave';
import { pickRestoreCandidate, useDraftMirrorWriter } from '@/v2/features/notes/editor/use-draft-mirror';
import { notesQueries } from '@/v2/features/notes/queries';
import type { NoteRecord } from '@/v2/features/notes/types';
import { stripPastedPresentation } from '@/v2/features/notes/editor/paste-sanitizer';
import { shortcutLabel, useIsMac } from '@/v2/features/notes/editor/shortcut-label';
import { StyleSelect } from '@/v2/features/notes/editor/StyleSelect';
import { PILL_TRIGGER, ToolbarButton, ToolbarDivider, ToolbarDot } from '@/v2/features/notes/editor/ToolbarButton';
import {
  ALIGN_OPTIONS,
  BLOCK_VERBS,
  REDO_KEYS,
  STYLE_OPTIONS,
  TEXT_VERBS,
  UNDO_KEYS,
} from '@/v2/features/notes/editor/toolbar-verbs';
import '@/v2/features/notes/note-fonts.css';
import './draft-panel.css';
import type { ConversationSpaceRef } from '@/types/chat';
import { SidePanelCloseButton } from '../side-panel/ChatSidePanel';
import { useSidePanel } from '../side-panel/SidePanelContext';
import { readDraftEdit, writeDraftEdit } from './draft-edits';
import { registerDraftFlush } from './draft-flush';
import { CATCH_UP_LIMIT_MS, draftNoteLine, type DraftNoteState } from './draft-note-state';
import { markDraftEdited, useDraftNoteState } from './use-draft-notes';
import { DraftHistoryDialog } from './DraftHistoryDialog';
import { findCardRoom } from './find-room';
import {
  DRAFT_MENU,
  DraftFolderPicker,
  DraftSaveBar,
  DraftSaveControl,
  useDraftTools,
  type DraftNoteRef,
} from './DraftSaveBar';
import { markdownToDoc, type DraftFont } from './markdown-to-doc';

/**
 * DraftEditor — a finished draft, editable in the side panel with the note
 * editor's own schema and controls (the draft editor, Stay 23 October 2026:
 * "Font size and type for now"). The same extensions as a note
 * (extensions.ts), so what is written here saves into a note unchanged; the
 * same paste cleaning; and a toolbar of the verbs a document needs: text
 * style, bold, italic, underline, both lists, alignment, and font type and
 * size (FontMenus.tsx).
 *
 * EVERY DRAFT IS A NOTE (Stay's "go", 27 October 2026; thread 1e44eb39).
 * One note holds a draft and all its versions: each version Lawexa writes
 * goes into it, and the newest version opens here on that note, read from
 * the server as it opens, and autosaves as the reader types with the note
 * editor's own autosave and device copy. When the reader sends a message,
 * the send waits for that save (draft-flush.ts), and Lawexa writes its next
 * version on the reader's text. What the panel opens on is decided by
 * draft-note-state.ts:
 *
 *   the note        the newest version: edited, or read by a reader who may
 *                   not edit it.
 *   Lawexa's text   an older version, a version the note has not caught up
 *                   with, a deleted note or one not reached: read only, from
 *                   the draft's Markdown (markdown-to-doc.ts), with a line
 *                   saying why and the downloads.
 *   the page's memory  a confidential chat, which keeps nothing: edited in
 *                   memory for this visit (draft-edits.ts), with the downloads.
 *
 * ── TWO SHAPES, ONE EDITOR ─────────────────────────────────────────────────
 * The phone sheet (below xl) has the wrapped toolbar on top and Save in the
 * foot. Beside the chat on a computer it is take B2 (Stay 24 October 2026):
 * the panel has no header, and one bar across its top (`DraftBar`) holds the
 * formatting on the left and Save and the close on the right; under it the
 * document spans the panel's width with even margins, up to a reading width.
 * Both shapes are drawn and CSS shows one, so a resize never remounts the
 * editor or loses a save in flight.
 *
 * ── FIND AND REPLACE (Arthur asked; Stay said "Yes build", 24 October 2026)
 * Ctrl+F (⌘F on a Mac) while focus is in the panel, "Find and replace" in the
 * bar's ···, or the search button on the phone sheet's toolbar. The chat
 * page's own Ctrl+F outside the panel stays the browser's. One find bar
 * (FindBar.tsx) for both shapes: a strip under the sheet's toolbar on a
 * phone, a card under the bar's right end on a computer.
 */
export function DraftEditor(props: Omit<DraftEditorProps, 'noteState' | 'line'> & { groupKey: string; latestOrdinal: number }) {
  const { conversationId, ordinal, groupKey, latestOrdinal } = props;
  const { state, waitedMs, retry } = useDraftNoteState(conversationId, { ordinal, key: groupKey, latestOrdinal });
  const panel = useSidePanel();
  const text = draftNoteLine(state, waitedMs);
  const action =
    state.kind === 'older'
      ? { label: 'Open latest', onPress: () => panel?.open({ kind: 'draft', ordinal: state.latestOrdinal }) }
      : state.kind === 'unlisted' || (state.kind === 'catching-up' && waitedMs >= CATCH_UP_LIMIT_MS)
        ? { label: 'Try again', onPress: retry }
        : null;
  return <DraftEditorFor {...props} noteState={state} line={text ? { text, action } : null} />;
}

/** The editor for what the draft is to its note. */
function DraftEditorFor(props: DraftEditorProps) {
  const { noteState } = props;
  switch (noteState.kind) {
    case 'loading':
      return <DraftEditorSkeleton versionSwitch={props.versionSwitch} />;
    case 'editable':
    case 'read-only':
      return (
        <DraftNoteOpen
          key={noteState.note.id}
          {...props}
          noteId={noteState.note.id}
          canEdit={noteState.kind === 'editable'}
          documentKey={noteState.document.key}
        />
      );
    case 'confidential': {
      // Nothing is kept in a confidential chat: the edits live in the page's
      // memory (draft-edits.ts), so closing the panel and opening it again
      // keeps them for this visit.
      const edited = readDraftEdit(props.conversationId, props.ordinal);
      return (
        <DraftEditorBody
          key="memory"
          {...props}
          mode={{ kind: 'memory' }}
          initial={edited ?? markdownToDoc(props.markdown, props.font)}
        />
      );
    }
    default:
      return (
        <DraftEditorBody
          key="lawexa"
          {...props}
          mode={{ kind: 'lawexa' }}
          initial={markdownToDoc(props.markdown, props.font)}
        />
      );
  }
}

/**
 * The draft's note, read from the server as it opens (never a kept copy), then
 * the editor on it. The editor is drawn again only for a newer copy than the
 * one it opened on (`updated_at`): its own saves never redraw it.
 */
function DraftNoteOpen(props: DraftEditorProps & { noteId: number; canEdit: boolean; documentKey: string }) {
  const { userId: viewerId } = useV2Session();
  const open = useQuery(notesQueries.draftNoteOpen({ id: props.noteId, viewerId }));
  if (open.isPending) return <DraftEditorSkeleton versionSwitch={props.versionSwitch} />;
  if (open.isError) {
    return (
      <DraftEditorBody
        key="lawexa"
        {...props}
        mode={{ kind: 'lawexa' }}
        initial={markdownToDoc(props.markdown, props.font)}
        line={{ text: 'Your note couldn’t be opened.', action: { label: 'Try again', onPress: () => void open.refetch() } }}
      />
    );
  }
  const record = open.data.data;
  return (
    <DraftEditorBody
      key={`${record.id}:${record.updated_at ?? ''}`}
      {...props}
      mode={{ kind: 'note', record, canEdit: props.canEdit, documentKey: props.documentKey }}
      initial={record.content ?? ''}
      onReload={() => void open.refetch()}
    />
  );
}

interface DraftEditorProps {
  conversationId: string;
  ordinal: number;
  /** The download's name: the draft's title, with its version where it has more than one. */
  title: string;
  markdown: string;
  /** The draft's own font and size from its tag, put on all its text. */
  font: DraftFont;
  /** The chat's Space, for Save to Space folder; `null` outside one. */
  space: ConversationSpaceRef | null;
  /** The strip that switches between the draft's versions, under the bars (DraftVersionSwitch.tsx). */
  versionSwitch?: ReactNode;
  /** What this draft is to its note (draft-note-state.ts), with its line and what the line offers. */
  noteState: DraftNoteState;
  /** The line under the bars, for a panel that does not edit the note (`draftNoteLine`). */
  line?: DraftLine | null;
}

/** A line at the top of the draft, and the one thing it offers. */
interface DraftLine {
  text: string;
  action: { label: string; onPress: () => void } | null;
}

/**
 * What the editor is open on: the note (editing it, or reading it), the
 * page's memory (a confidential chat), or Lawexa's own text, read only.
 */
type DraftEditorMode =
  | { kind: 'note'; record: NoteRecord; canEdit: boolean; documentKey: string }
  | { kind: 'memory' }
  | { kind: 'lawexa' };

/**
 * How far from the draft's own scroll area's edges the caret is kept when it
 * is scrolled to (px). The toolbar and Save are outside that area, so a small
 * margin keeps a line of text in sight above and below the caret.
 */
const CARET_MARGIN_TOP = 24;
const CARET_MARGIN_BOTTOM = 24;

/**
 * The document's frame. On the phone sheet a document measure. On a computer
 * the panel's width with even margins, 48px, or 32px on a panel under 37.5rem
 * (a 1280 screen), up to a 780px reading width (Stay, 24 October 2026: "waste
 * of horizontal space"). Inside an `@container/draft`.
 */
export const DRAFT_DOCUMENT =
  'mx-auto w-full max-w-[68ch] px-5 py-6 xl:max-w-[876px] xl:px-8 xl:pt-8 xl:pb-30 xl:text-[15px] xl:@min-[37.5rem]/draft:px-12';

/**
 * The panel's one bar on a computer: a filled band across the top, with no
 * stroke, no shadow and no corners, that stays while the draft scrolls. The
 * formatting on the left, then Save, then the close. A draft still being
 * written, or one no longer in the chat, shows the bar with the close alone.
 * Not drawn below xl, where the sheet has its header and its own toolbar.
 */
export function DraftBar({ tools, actions }: { tools?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="v2-draft-bar sticky top-0 z-10 hidden h-12 shrink-0 items-center gap-2 pr-2.5 pl-2 xl:flex">
      <div className="flex min-w-0 flex-1 items-center">{tools}</div>
      {actions}
      <SidePanelCloseButton />
    </div>
  );
}

/** The editor's frame while the saved note is looked up: the bar, then lines. */
function DraftEditorSkeleton({ versionSwitch }: { versionSwitch?: ReactNode }) {
  return (
    <div className="@container/draft flex min-h-full flex-col">
      <div aria-hidden className="h-12 shrink-0 border-b border-border/70 xl:hidden" />
      <DraftBar />
      {versionSwitch}
      <div aria-hidden className={cn(DRAFT_DOCUMENT, 'flex flex-col gap-3')}>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

function DraftEditorBody({
  conversationId,
  ordinal,
  title,
  space,
  versionSwitch,
  initial,
  mode,
  line = null,
  onReload,
}: DraftEditorProps & { initial: Content; mode: DraftEditorMode; onReload?: () => void }) {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const record = mode.kind === 'note' ? mode.record : null;
  const savesToNote = mode.kind === 'note' && mode.canEdit;
  const editable = savesToNote || mode.kind === 'memory';
  const [extensions] = useState(() =>
    createNoteExtensions({
      placeholder: 'Write your draft…',
      mentionStore: createCaseMentionStore({ queryClient, viewerId }),
    }),
  );

  // THE NOTE'S AUTOSAVE (drafts saved as notes): the note editor's own, so the
  // draft saves as the reader types, one save at a time, each made on the copy
  // it read (`base_updated_at`; a newer copy answers 409, `conflict`). Nothing
  // saves from a panel that does not edit the note: the machine has no note
  // and is paused, so it never sends.
  const autosave = useNoteAutosave({
    scopeId: record ? String(record.id) : `draft:${conversationId}:${ordinal}`,
    initial: record
      ? { id: record.id, draft: { title: record.title, content: record.content ?? '' }, updatedAt: record.updated_at ?? null }
      : null,
    paused: !savesToNote,
    // The card's "Edited" (DraftCard.tsx) without reading the list again.
    onSaved: () => {
      if (mode.kind === 'note') markDraftEdited(queryClient, { conversationId, viewerId }, mode.documentKey);
    },
  });
  const { change: reportDraft } = autosave;

  // The device copy of what is typed (the note editor's mirror), ahead of the
  // autosave, so typing a save never reached is offered back.
  const mirrorKey = record ? noteMirrorKey(record.id) : `draft-panel:${conversationId}:${ordinal}`;
  const { write: mirrorWrite, forget: mirrorForget } = useDraftMirrorWriter({
    key: mirrorKey,
    noteId: record?.id ?? null,
    viewerId: savesToNote ? viewerId : null,
  });
  const mirrorLookup = useQuery({
    ...draftMirrorQuery({ key: mirrorKey, viewerId, includeOrphan: false }),
    enabled: savesToNote,
  });
  const [offerDismissed, setOfferDismissed] = useState(false);
  const typingOffer = savesToNote && !offerDismissed ? pickRestoreCandidate(mirrorLookup.data, record) : null;

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initial,
    editable,
    onUpdate: ({ editor: instance }) => {
      if (mode.kind === 'memory') {
        writeDraftEdit(conversationId, ordinal, instance.getJSON());
        return;
      }
      if (!savesToNote || !record) return;
      const draft = { title: record.title, content: instance.getHTML() };
      reportDraft(draft);
      mirrorWrite(draft);
    },
    editorProps: {
      transformPastedHTML: stripPastedPresentation,
      // The caret keeps a line of room inside the draft's scroll area when it is scrolled to.
      scrollThreshold: { top: CARET_MARGIN_TOP, bottom: CARET_MARGIN_BOTTOM, left: 0, right: 0 },
      scrollMargin: { top: CARET_MARGIN_TOP, bottom: CARET_MARGIN_BOTTOM, left: 0, right: 0 },
      attributes: {
        'aria-label': 'Draft',
        'aria-readonly': editable ? 'false' : 'true',
        class: cn(
          'v2-note-fonts v2-draft-doc prose prose-neutral max-w-none dark:prose-invert',
          'min-h-[40vh] pb-10 text-base leading-relaxed focus:outline-none',
          'prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary',
          '[&_mark]:rounded-[0.2em] [&_mark]:bg-primary/28 [&_mark]:px-[0.1em] [&_mark]:text-inherit',
          '[&_code]:before:content-none [&_code]:after:content-none',
          '[&_.tableWrapper]:my-4 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:overscroll-x-contain',
          '[&_table]:my-0 [&_table]:w-full [&_table]:border-collapse',
          '[&_td]:min-w-[6em] [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
          '[&_th]:min-w-[6em] [&_th]:border [&_th]:border-border [&_th]:bg-secondary/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-top',
        ),
      },
    },
  });

  const tools = useDraftTools(editor, title);

  // LAWEXA SEES THE LAST WORD TYPED: a message waits for this save
  // (draft-flush.ts). The flusher saves now, then settles once all is saved,
  // or at once with `false` on a failure the reader must act on.
  const statusRef = useRef(autosave.status);
  const waitersRef = useRef<((saved: boolean) => void)[]>([]);
  useEffect(() => {
    statusRef.current = autosave.status;
    const settled = autosave.status === 'clean' ? true : SAVE_STOPPED.has(autosave.status) ? false : null;
    if (settled === null) return;
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((resolve) => resolve(settled));
  }, [autosave.status]);
  const { flush } = autosave;
  useEffect(() => {
    if (!savesToNote) return;
    return registerDraftFlush(conversationId, ordinal, () => {
      if (statusRef.current === 'clean') return Promise.resolve(true);
      if (SAVE_STOPPED.has(statusRef.current)) return Promise.resolve(false);
      const settled = new Promise<boolean>((resolve) => waitersRef.current.push(resolve));
      flush();
      return settled;
    });
  }, [conversationId, ordinal, savesToNote, flush]);

  // THE CARET STAYS IN VIEW AS THE KEYBOARD RISES (Arthur's iPhone, 24 October
  // 2026: "the tap on the specific portion of the note still takes the
  // blinker God knows where"). A tap puts the caret where it lands, then the
  // keyboard rises and the sheet, which takes the visible area, gets shorter
  // from the bottom, so a caret placed low in the draft ends up under the
  // keyboard's top edge, out of sight. Once the editor has focus, and on
  // every change of the visible area while it has it, the selection is
  // scrolled back into view, clear of the toolbar and Save.
  useEffect(() => {
    if (!editor) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const keepCaretInView = (): void => {
      if (!editor.isFocused) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!editor.isDestroyed) editor.commands.scrollIntoView();
      });
    };
    viewport?.addEventListener('resize', keepCaretInView);
    editor.on('focus', keepCaretInView);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', keepCaretInView);
      editor.off('focus', keepCaretInView);
    };
  }, [editor]);

  const mac = useIsMac();
  const [findOpen, setFindOpen] = useState(false);
  const [findSeed, setFindSeed] = useState('');
  const [findRequest, setFindRequest] = useState(0);
  const openFind = useCallback(() => {
    if (!editor) return;
    setFindSeed(selectionSeed(editor.state));
    setFindOpen(true);
    setFindRequest((count) => count + 1);
  }, [editor]);

  // ROOM UNDER THE FIND CARD (Lucy, 25 October 2026: "the find bar covers the
  // top lines of the draft"). On a computer the card hangs over the top of the
  // scroll area; while it is open its height, measured as it changes (the
  // replace row opens and closes), is kept as top room in that area
  // (find-room.ts). Closing the bar takes the room away.
  const [findCardHeight, setFindCardHeight] = useState(0);
  useEffect(() => {
    const card = frameRef.current?.querySelector<HTMLElement>('[data-v2-draft-find] > *');
    if (!findOpen || !card) return;
    const observer = new ResizeObserver(([entry]) => setFindCardHeight(entry.target.getBoundingClientRect().height));
    observer.observe(card);
    return () => observer.disconnect();
  }, [findOpen]);
  const findRoom = findOpen ? findCardRoom(findCardHeight) : 0;

  // Ctrl+F (⌘F) with focus in the panel opens the draft's find; anywhere else
  // on the chat page it stays the browser's. A listener on the panel's own
  // element, so a key pressed outside it never arrives here.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !editor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFindShortcut(event, mac)) return;
      event.preventDefault();
      openFind();
    };
    frame.addEventListener('keydown', onKeyDown);
    return () => frame.removeEventListener('keydown', onKeyDown);
  }, [editor, mac, openFind]);

  const note: DraftNoteRef | null = record ? { id: record.id, slug: record.slug } : null;
  const saveState = savesToNote ? { ...autosave, onRetry: autosave.retry } : null;
  const actions = { tools, note, autosave: saveState, space, onHistory: () => setHistoryOpen(true) };

  return (
    // THE DRAFT SCROLLS IN ITS OWN AREA, between the bars at the top and Save
    // at the foot, and the bars and the find box sit outside it (Arthur's
    // iPhone, 25 October 2026: with the keyboard up, "3 of 6" showed the
    // draft's first lines). When the find box was a sticky strip inside the
    // panel's scroller, iOS scrolled that scroller back to the box's place at
    // the top every time the box had focus, so the match the find had just
    // centred went out of sight. Now nothing focusable scrolls with the
    // draft, and a match centred in this area is in the part above the
    // keyboard: the sheet is as tall as the visible area (ChatSidePanel).
    <div ref={frameRef} className="@container/draft flex h-full min-h-0 flex-col">
      {editor ? (
        // The bars and the find bar, above the draft: the find bar is a
        // strip under the sheet's toolbar, or a card under the computer bar's
        // right end (placed against this box).
        <div className="relative z-10 shrink-0">
          {editable ? <DraftToolbar editor={editor} onFind={openFind} /> : null}
          {/* While the reader types on a phone (draft-panel.css): the computer bar's
              tools, folded to one row (undo, font, B I, ··· with the rest), in place
              of the three-row toolbar above, so the draft keeps its lines. */}
          {editable ? (
            <div className="v2-draft-typing-tools sticky top-0 z-10 hidden h-11 shrink-0 items-center border-b border-border/70 bg-popover px-2">
              <DraftBarTools editor={editor} frameRef={frameRef} onFind={openFind} />
            </div>
          ) : null}
          <DraftBar
            tools={editable ? <DraftBarTools editor={editor} frameRef={frameRef} onFind={openFind} /> : null}
            actions={<DraftSaveControl {...actions} />}
          />
          {findOpen ? (
            // `contents`: no box of its own, so the card is placed exactly as
            // before; it only marks the card for the room above.
            <div data-v2-draft-find className="contents">
              <FindBar
                editor={editor}
                layout="draft"
                label="Find in draft"
                seed={findSeed}
                focusRequest={findRequest}
                onClose={() => setFindOpen(false)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div aria-hidden className="h-12 shrink-0 border-b border-border/70 xl:hidden" />
          <DraftBar />
        </>
      )}
      {versionSwitch}
      {line ? <DraftLineBar line={line} /> : null}
      {typingOffer && editor ? (
        <DraftTypingOffer
          savedAt={typingOffer.updated_at}
          content={typingOffer.content}
          onDiscard={() => {
            setOfferDismissed(true);
            mirrorForget(typingOffer.key);
          }}
        />
      ) : null}
      {autosave.status === 'conflict' ? (
        <DraftLineBar
          tone="alert"
          line={{
            text: 'This draft’s note changed since it opened here (Lawexa wrote a new version, or it was edited elsewhere). What you typed since then isn’t saved; copy it first if you need it.',
            action: onReload ? { label: 'Reload', onPress: onReload } : null,
          }}
        />
      ) : null}
      <div
        data-v2-draft-scroll
        className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain xl:scroll-pt-[var(--v2-draft-find-room)] xl:pt-[var(--v2-draft-find-room)]"
        style={{ '--v2-draft-find-room': `${findRoom}px` } as CSSProperties}
      >
        <div className={DRAFT_DOCUMENT}>
          <EditorContent editor={editor} />
        </div>
      </div>
      {editor ? (
        <>
          <DraftSaveBar {...actions} />
          <DraftFolderPicker tools={tools} note={note} space={space} />
        </>
      ) : null}
      {record ? (
        <DraftHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          noteId={record.id}
          canRestore={savesToNote}
          current={editor ? () => editor.getHTML() : null}
          saving={savesToNote && autosave.status !== 'clean'}
          onRestored={onReload}
        />
      ) : null}
    </div>
  );
}

/** The autosave states a send cannot wait out: a failure, a newer copy, the plan's limit. */
const SAVE_STOPPED: ReadonlySet<string> = new Set(['error', 'conflict', 'blocked']);

/** A line under the bars: what the panel shows, and the one thing it offers. */
function DraftLineBar({ line, tone = 'quiet' }: { line: DraftLine; tone?: 'quiet' | 'alert' }) {
  return (
    <div
      role={tone === 'alert' ? 'alert' : 'status'}
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/70 px-5 py-2 text-[13px] xl:px-8',
        tone === 'alert' ? 'bg-destructive/8 text-destructive' : 'bg-secondary/50 text-muted-foreground',
      )}
    >
      <span className="min-w-0 flex-1">{line.text}</span>
      {line.action ? (
        <button
          type="button"
          onClick={line.action.onPress}
          className={cn(
            'v2-interactive shrink-0 rounded-md px-2 py-1 font-medium text-foreground transition-colors hover:bg-secondary',
            FOCUS_RING,
          )}
        >
          {line.action.label}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Typing a save never reached, kept on this device (the note editor's
 * mirror), offered back as text to copy: never put over the note, which may
 * hold a newer version of Lawexa's by now.
 */
function DraftTypingOffer({ savedAt, content, onDiscard }: { savedAt: string; content: string; onDiscard: () => void }) {
  const [copied, setCopied] = useState(false);
  // One reading of the clock, as RestoreDraftBar: never in a render body.
  const [now] = useState(() => Date.now());
  const relative = formatRelativeTime(savedAt, now);
  const when = relative === '' || relative === 'now' ? 'a moment ago' : `${relative} ago`;
  const copy = () => {
    const holder = document.createElement('div');
    holder.innerHTML = content;
    void navigator.clipboard.writeText(holder.innerText || holder.textContent || '').then(() => setCopied(true));
  };
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/70 bg-secondary/50 px-5 py-2 text-[13px] text-muted-foreground xl:px-8"
    >
      <span className="min-w-0 flex-1">Typing from {when} wasn’t saved to this draft.</span>
      <button
        type="button"
        onClick={copy}
        className={cn('v2-interactive shrink-0 rounded-md px-2 py-1 font-medium text-foreground hover:bg-secondary', FOCUS_RING)}
      >
        {copied ? 'Copied' : 'Copy it'}
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className={cn('v2-interactive shrink-0 rounded-md px-2 py-1 font-medium text-foreground hover:bg-secondary', FOCUS_RING)}
      >
        Discard
      </button>
    </div>
  );
}
const LIST_VERBS = BLOCK_VERBS.filter((verb) => verb.verb === 'bulletList' || verb.verb === 'orderedList');
const MARK_VERBS = TEXT_VERBS.filter((verb) => verb.verb === 'bold' || verb.verb === 'italic' || verb.verb === 'underline');

/** Copy the draft as it now reads, as plain text, for pasting elsewhere; "Copied" for a moment after. */
function useCopyText(editor: Editor) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(editor.getText({ blockSeparator: '\n\n' })).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return { copied, copy };
}

/**
 * The phone sheet's bar: it sticks to the panel's top while the draft scrolls.
 * It wraps onto more rows wherever it runs out of width, so every control is
 * in sight: on a phone a sideways row hid size, bold and the rest with no sign
 * they were there (Lucy's live check, 23 October 2026). Not drawn on a
 * computer, where the panel's one bar (`DraftBar`) takes its place.
 */
function DraftToolbar({ editor, onFind }: { editor: Editor; onFind: () => void }) {
  const state = useFormatState(editor);
  const { copied, copy } = useCopyText(editor);
  const mac = useIsMac();
  const keys = (binding: string) => shortcutLabel(binding, mac);

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      className="v2-draft-sheet-tools sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-x-0.5 gap-y-1 border-b border-border/70 bg-popover px-3 py-1.5 xl:hidden"
    >
      <ToolbarButton
        compact
        icon={Undo2}
        label="Undo"
        shortcut={keys(UNDO_KEYS)}
        disabled={!state.canUndo}
        onPress={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        compact
        icon={Redo2}
        label="Redo"
        shortcut={keys(REDO_KEYS)}
        disabled={!state.canRedo}
        onPress={() => editor.chain().focus().redo().run()}
      />
      <ToolbarDivider />
      <StyleSelect editor={editor} state={state} mac={mac} />
      <FontMenu editor={editor} />
      <SizeMenu editor={editor} />
      <ToolbarDivider />
      {MARK_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <ToolbarButton
          compact
          key={verb}
          icon={icon}
          label={label}
          shortcut={keys(binding)}
          active={state[verb]}
          disabled={state.inCodeBlock}
          onPress={() => runFormat(editor, verb)}
        />
      ))}
      <ToolbarDivider />
      {LIST_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <ToolbarButton
          compact
          key={verb}
          icon={icon}
          label={label}
          shortcut={keys(binding)}
          active={state[verb]}
          onPress={() => runFormat(editor, verb)}
        />
      ))}
      <AlignMenu editor={editor} state={state} mac={mac} />
      <ToolbarDivider />
      <ToolbarButton compact icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy text'} onPress={copy} />
      <ToolbarButton compact icon={Search} label="Find and replace" shortcut={keys('Mod-f')} onPress={onFind} />
    </div>
  );
}

/**
 * Below this width of the panel (px), the bar folds Redo, Underline and the
 * text style into its ··· menu, so Save and the close still fit beside the
 * formatting at a 1280 screen. The bar hides them in CSS with the same number
 * (`@max-[37.5rem]/draft`); the menu, drawn in a portal outside that container,
 * measures the panel when it opens.
 */
const BAR_FOLD_WIDTH = 600;

const UNDERLINE = TEXT_VERBS.find((verb) => verb.verb === 'underline');

/**
 * The formatting on the left of the computer's bar (take B2, Stay 24 October
 * 2026):
 *
 *   undo · redo  •  Normal · Times New Roman 14  •  B I U · ···
 *
 * ··· holds both lists, alignment and Copy text, and Redo, Underline and the
 * text style when the panel is narrow. Soft fills on hover (ToolbarButton
 * `pill`), no outlined boxes.
 */
function DraftBarTools({
  editor,
  frameRef,
  onFind,
}: {
  editor: Editor;
  frameRef: RefObject<HTMLDivElement | null>;
  onFind: () => void;
}) {
  const state = useFormatState(editor);
  const mac = useIsMac();
  const keys = (binding: string) => shortcutLabel(binding, mac);

  return (
    <div role="toolbar" aria-label="Formatting" aria-orientation="horizontal" className="flex min-w-0 items-center gap-px">
      <ToolbarButton
        pill
        icon={Undo2}
        label="Undo"
        shortcut={keys(UNDO_KEYS)}
        disabled={!state.canUndo}
        onPress={() => editor.chain().focus().undo().run()}
      />
      <span className="contents @max-[37.5rem]/draft:hidden">
        <ToolbarButton
          pill
          icon={Redo2}
          label="Redo"
          shortcut={keys(REDO_KEYS)}
          disabled={!state.canRedo}
          onPress={() => editor.chain().focus().redo().run()}
        />
      </span>
      <ToolbarDot />
      <span className="contents @max-[37.5rem]/draft:hidden">
        <StyleSelect editor={editor} state={state} mac={mac} pill menuClassName={DRAFT_MENU} />
      </span>
      <FontSizeMenu editor={editor} menuClassName={DRAFT_MENU} />
      <ToolbarDot />
      {MARK_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <span key={verb} className={cn('contents', verb === 'underline' && '@max-[37.5rem]/draft:hidden')}>
          <ToolbarButton
            pill
            icon={icon}
            label={label}
            shortcut={keys(binding)}
            active={state[verb]}
            disabled={state.inCodeBlock}
            onPress={() => runFormat(editor, verb)}
          />
        </span>
      ))}
      <BarMoreMenu editor={editor} state={state} mac={mac} frameRef={frameRef} onFind={onFind} />
    </div>
  );
}

/** The bar's ···: lists, alignment, Copy text and Find and replace; Redo, Underline and the text style too on a narrow panel. */
function BarMoreMenu({
  editor,
  state,
  mac,
  frameRef,
  onFind,
}: {
  editor: Editor;
  state: FormatState;
  mac: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  onFind: () => void;
}) {
  const [folded, setFolded] = useState(false);
  const { copied, copy } = useCopyText(editor);
  // Find and replace takes focus to its own box: the menu must not pull focus
  // back to the editor as it closes.
  const toFind = useRef(false);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setFolded((frameRef.current?.clientWidth ?? BAR_FOLD_WIDTH) < BAR_FOLD_WIDTH);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label="More formatting"
            onMouseDown={(event) => event.preventDefault()}
            className={cn(PILL_TRIGGER, 'size-7.5', FOCUS_RING)}
          >
            <MoreHorizontal aria-hidden className="size-[17px]" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          More
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className={DRAFT_MENU}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!toFind.current) editor.commands.focus();
          toFind.current = false;
        }}
      >
        {folded ? (
          <>
            <DropdownMenuItem disabled={!state.canRedo} onSelect={() => editor.chain().focus().redo().run()}>
              <Redo2 aria-hidden className="size-4" />
              Redo
              <DropdownMenuShortcut>{shortcutLabel(REDO_KEYS, mac)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            {UNDERLINE ? (
              <DropdownMenuCheckboxItem
                checked={state.underline}
                disabled={state.inCodeBlock}
                onSelect={() => runFormat(editor, UNDERLINE.verb)}
              >
                <UNDERLINE.icon aria-hidden className="size-4" />
                {UNDERLINE.label}
                <DropdownMenuShortcut>{shortcutLabel(UNDERLINE.keys, mac)}</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={state.blockStyle}>
              {STYLE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem
                  key={option.style}
                  value={option.style}
                  disabled={state.inCodeBlock}
                  onSelect={() => applyStyle(editor, option.style)}
                >
                  {option.label}
                  <DropdownMenuShortcut>{shortcutLabel(option.keys, mac)}</DropdownMenuShortcut>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {LIST_VERBS.map(({ verb, icon: Icon, label, keys: binding }) => (
          <DropdownMenuCheckboxItem key={verb} checked={state[verb]} onSelect={() => runFormat(editor, verb)}>
            <Icon aria-hidden className="size-4" />
            {label}
            <DropdownMenuShortcut>{shortcutLabel(binding, mac)}</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={state.align}>
          {ALIGN_OPTIONS.map(({ align, icon: Icon, label, keys: binding }) => (
            <DropdownMenuRadioItem
              key={align}
              value={align}
              disabled={state.inCodeBlock}
              onSelect={() => applyAlign(editor, align)}
            >
              <Icon aria-hidden className="size-4" />
              {label}
              <DropdownMenuShortcut>{shortcutLabel(binding, mac)}</DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* The menu stays open after a copy, so "Copied" is seen. */}
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            copy();
          }}
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? 'Copied' : 'Copy text'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            toFind.current = true;
            onFind();
          }}
        >
          <Search aria-hidden className="size-4" />
          Find and replace
          <DropdownMenuShortcut>{shortcutLabel('Mod-f', mac)}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
