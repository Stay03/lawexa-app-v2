'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useBackTo } from '@/v2/runtime/back-to';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  ArrowLeft,
  AtSign,
  BookOpen,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useV2Session } from '@/v2/runtime/session-context';
import { quietReplaceUrlPath } from '@/v2/runtime/url-params';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { NoteRecord } from '../types';
import { NOTE_CONTENT_LIMIT, type NoteDraft } from './autosave-machine';
import { CaseMentionList, MENTION_LISTBOX_ID, mentionOptionId } from './CaseMentionList';
import {
  adoptDraftMirror,
  draftMirrorKey,
  draftMirrorQuery,
  newDraftId,
  noteMirrorKey,
} from './draft-mirror';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { createNoteExtensions } from './extensions';
import { FormattingBar } from './FormattingBar';
import { openCaseMention, useFormatState } from './formatting';
import { LinkDialog } from './LinkDialog';
import { createCaseMentionStore } from './mention-store';
import { stripPastedPresentation } from './paste-sanitizer';
import { RestoreDraftBar } from './RestoreDraftBar';
import { SaveIndicator } from './SaveIndicator';
import { NOTE_PAPER_COLUMN } from './states';
import { ToolbarButton } from './ToolbarButton';
import { useAutosavePause } from './use-autosave-pause';
import { useNoteAutosave } from './use-autosave';
import { useCoarsePointer } from './use-coarse-pointer';
import { pickRestoreCandidate, useDraftMirrorWriter } from './use-draft-mirror';
import { IMAGE_INPUT_ACCEPT, useNoteImageUploads } from './use-image-uploads';

/**
 * NoteEditorScreen — the page IS the paper.
 *
 * One screen serves both authoring routes. `/notes/create` mounts it with no
 * record and the note comes into existence on the first change; `/notes/{slug}/
 * edit` mounts it with the note already resolved. Everything below that line —
 * autosave, the mirror, the toolbars, delete — is identical, which is why they
 * are not two screens.
 *
 * ── NO CHROME THAT ISN'T EARNED ─────────────────────────────────────────────
 * A title in the document's own type, the body beneath it, and nothing else at
 * rest. No fixed toolbar (v1 had one permanently above every note, plus a second
 * one in "writer mode"), no save button, no publish bar, no character counter,
 * no price fields. Formatting appears where it is asked for: over a selection on
 * a pointer device, in the shell dock on a touch one.
 *
 * ── WHY TYPING DOES NOT RE-RENDER THIS COMPONENT ────────────────────────────
 * The body lives in ProseMirror and the title in one `<textarea>`; neither is
 * mirrored into React state per keystroke. `useNoteAutosave` keeps its machine
 * in a ref and publishes only the save VIEW, the mirror writer is imperative,
 * and the only per-keystroke state transition left is the content-limit
 * threshold, which flips at most twice in a session. So a burst of typing
 * repaints the toolbars (via `useEditorState`, which is the point) and nothing
 * else.
 */
export function NoteEditorScreen({
  initialRecord,
}: {
  /** The note being edited, or `null` for a note that does not exist yet. */
  initialRecord: NoteRecord | null;
}) {
  const back = useBackTo('/notes?tab=mine');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();

  const [record, setRecord] = useState<NoteRecord | null>(initialRecord);
  const recordRef = useRef(record);

  // One client id for this editing session, minted before the note has one.
  const [draftId] = useState(newDraftId());
  // The mirror key AT ENTRY — frozen so the restore lookup is asked once, about
  // the identity the session started with, and is not re-run when a create
  // renames it mid-session.
  const [entryMirrorKey] = useState(() =>
    initialRecord === null ? draftMirrorKey(draftId) : noteMirrorKey(initialRecord.id),
  );

  const [mentionStore] = useState(() =>
    createCaseMentionStore({ queryClient, viewerId }),
  );
  const [extensions] = useState(() =>
    createNoteExtensions({
      placeholder: 'Start writing…',
      mentionStore,
    }),
  );

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreDismissed, setRestoreDismissed] = useState(false);

  const [title, setTitle] = useState(initialRecord?.title ?? '');
  const titleRef = useRef(title);
  const titleElementRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: initialRecord?.content ?? '',
      editorProps: {
        // Second line of defence behind the schema (which has no colour marks at
        // all) — see `paste-sanitizer.ts`.
        transformPastedHTML: stripPastedPresentation,
        attributes: {
          // The `@` picker is an inline autocomplete over a rich-text area, so
          // the editable keeps `textbox` semantics and announces the list
          // through `aria-autocomplete` + the live attributes set below.
          'aria-label': 'Note body',
          'aria-autocomplete': 'list',
          class: cn(
            'prose prose-neutral max-w-none dark:prose-invert',
            'min-h-[50vh] pb-10 text-base leading-relaxed focus:outline-none',
            'prose-headings:font-semibold prose-headings:tracking-tight',
            'prose-a:text-primary prose-img:rounded-xl',
            // Placeholder: the extension puts `data-placeholder` on the first
            // node while the document is empty.
            "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground/60 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            // A case mention reads as a name, not as a blue link to click while
            // writing.
            '[&_.case-mention]:font-medium [&_.case-mention]:text-primary [&_.case-mention]:no-underline',
            // The live `@query` while the picker is open.
            '[&_.v2-mention-trigger]:rounded [&_.v2-mention-trigger]:bg-primary/10 [&_.v2-mention-trigger]:text-primary',
          ),
        },
      },
    },
    [],
  );

  const formatState = useFormatState(editor);
  const coarsePointer = useCoarsePointer();
  const images = useNoteImageUploads(editor);
  const { commit: commitUploads, reconcile: reconcileUploads } = images;

  const mirrorKey = record === null ? draftMirrorKey(draftId) : noteMirrorKey(record.id);
  const { write: mirrorWrite, forget: mirrorForget } = useDraftMirrorWriter({
    key: mirrorKey,
    noteId: record?.id ?? null,
    viewerId,
  });

  const { overLimit, measure: measureLimit } = useAutosavePause();

  const handleSaved = useCallback(
    async (next: NoteRecord) => {
      const wasNew = recordRef.current === null;
      recordRef.current = next;
      setRecord(next);
      // Anything in the accepted body is now permanent — out of reach of the
      // upload cleanup (see `use-image-uploads.ts`).
      commitUploads(next.content ?? '');

      if (!wasNew) return;
      // The note now has an id and an address. Move the mirror row onto the id
      // so this session leaves ONE row behind, and make the URL honest without
      // navigating — the editor, its selection and its undo history stay exactly
      // where they are (see `quietReplaceUrlPath`).
      //
      // AWAITED, not fired and forgotten. If the tab dies between the create
      // response and the re-key, the old `draft:{uuid}` row survives with
      // content that IS already saved — and `/notes/create` would then offer to
      // restore it, as "unsaved changes", for the next thirty days. Awaiting
      // costs nothing here (the URL move below is not what the reader is
      // waiting on) and closes that window to the width of one IndexedDB write.
      await adoptDraftMirror(draftId, next.id);
      if (window.location.pathname === '/notes/create') {
        quietReplaceUrlPath(`/notes/${next.slug}/edit`);
      }
    },
    [commitUploads, draftId],
  );

  const autosave = useNoteAutosave({
    scopeId: String(record?.id ?? draftId),
    initial:
      initialRecord === null
        ? null
        : {
            id: initialRecord.id,
            draft: {
              title: initialRecord.title,
              content: initialRecord.content ?? '',
            },
          },
    onSaved: handleSaved,
    paused: overLimit,
  });
  const { change: reportDraft, retry: retrySave } = autosave;

  /** The single place a change becomes a draft — autosave, mirror and limit. */
  const publishDraft = useCallback(
    (draft: NoteDraft) => {
      measureLimit(draft);
      reportDraft(draft);
      mirrorWrite(draft);
    },
    [measureLimit, mirrorWrite, reportDraft],
  );

  const applyTitle = useCallback(
    (next: string) => {
      titleRef.current = next;
      setTitle(next);
      const element = titleElementRef.current;
      if (element) {
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
      }
      publishDraft({
        // Blank is UNTITLED, and untitled is `null` on the wire — never `''`.
        title: next.trim().length === 0 ? null : next,
        content: editor?.getHTML() ?? '',
      });
    },
    [editor, publishDraft],
  );

  // The body's change subscription. A listener + cleanup, no state written in
  // the effect body.
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      const content = editor.getHTML();
      reconcileUploads(content);
      publishDraft({
        title: titleRef.current.trim().length === 0 ? null : titleRef.current,
        content,
      });
    };
    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
    };
  }, [editor, publishDraft, reconcileUploads]);

  // Announce the `@` picker on the editable itself, where focus is. A DOM write
  // driven by the store's subscription — no React state, no re-render.
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const dom = editor.view.dom;
      const snapshot = mentionStore.getSnapshot();
      const listOpen = snapshot.open && snapshot.items.length > 0;
      dom.setAttribute('aria-expanded', listOpen ? 'true' : 'false');
      if (listOpen) {
        dom.setAttribute('aria-controls', MENTION_LISTBOX_ID);
        dom.setAttribute('aria-activedescendant', mentionOptionId(snapshot.activeIndex));
      } else {
        dom.removeAttribute('aria-controls');
        dom.removeAttribute('aria-activedescendant');
      }
    };
    sync();
    return mentionStore.subscribe(sync);
  }, [editor, mentionStore]);

  useEffect(() => () => mentionStore.destroy(), [mentionStore]);

  // Fit the title box to its content on first paint (a wrapped title must not
  // open scrolled).
  useEffect(() => {
    const element = titleElementRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  const headerTitle = record
    ? record.title?.trim() || 'Untitled'
    : 'New note';
  useEffect(() => {
    setHeaderContext({ title: headerTitle, confidential: false });
  }, [headerTitle]);
  useEffect(() => () => clearHeaderContext(), []);

  // ── The restore offer ─────────────────────────────────────────────────────
  const mirrorLookup = useQuery(
    draftMirrorQuery({
      key: entryMirrorKey,
      viewerId,
      includeOrphan: initialRecord === null,
    }),
  );
  const candidate = restoreDismissed
    ? null
    : pickRestoreCandidate(mirrorLookup.data, initialRecord);

  const restoreCandidate = () => {
    if (!candidate || !editor) return;
    setRestoreDismissed(true);
    // The row is replaced by this session's own writes from here on; drop the
    // one that was offered so it can never be offered twice.
    if (candidate.key !== mirrorKey) mirrorForget(candidate.key);
    editor.commands.setContent(candidate.content, { emitUpdate: false });
    applyTitle(candidate.title ?? '');
    publishDraft({ title: candidate.title, content: candidate.content });
  };

  const discardCandidate = () => {
    if (!candidate) return;
    setRestoreDismissed(true);
    mirrorForget(candidate.key);
  };

  // ── Toolbar actions ───────────────────────────────────────────────────────
  const handleLink = () => {
    if (!editor) return;
    if (formatState.link) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const existing = editor.getAttributes('link').href;
    setLinkHref(typeof existing === 'string' ? existing : '');
    setLinkOpen(true);
  };

  const applyLink = (href: string) => {
    editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const handleMention = () => {
    if (editor) openCaseMention(editor);
  };

  const handleImage = () => {
    images.dismissError();
    fileInputRef.current?.click();
  };

  return (
    <div className={NOTE_PAPER_COLUMN}>
      <div className="mb-6 flex min-h-9 items-center justify-between gap-3">
        <Link
          {...back}
          className={cn(
            'v2-interactive -ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Notes
        </Link>

        <div className="flex items-center gap-1.5">
          {/* THE ONE PIECE OF PERSISTENT DESKTOP CHROME, and only because the
              alternative is a dead end. Inserting an image or an `@case` puts
              something NEW at the caret, so neither belongs in a bubble that
              only exists over a selection — and on an empty note there is no
              selection to summon one with. Two icons in the page's own header
              row (beside the back link, above the paper) keep both reachable
              without putting a toolbar over the document. Touch has them in the
              dock bar and does not need these. */}
          {editor && coarsePointer === false ? (
            <span className="mr-1 flex items-center gap-0.5">
              <ToolbarButton
                icon={images.busy ? Loader2 : ImagePlus}
                label={images.busy ? 'Uploading image' : 'Insert image'}
                tone="accent"
                spin={images.busy}
                disabled={images.busy}
                onPress={handleImage}
              />
              <ToolbarButton
                icon={AtSign}
                label="Mention a case"
                tone="accent"
                onPress={handleMention}
              />
            </span>
          ) : null}
          <SaveIndicator
            status={autosave.status}
            savedAt={autosave.savedAt}
            failure={autosave.failure}
            retryScheduled={autosave.retryScheduled}
            onRetry={retrySave}
          />
          {record ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Note actions"
                className={cn(
                  'v2-interactive inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <MoreHorizontal aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/notes/${record.slug}`}>
                    <BookOpen aria-hidden className="size-4" />
                    Read note
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 aria-hidden className="size-4" />
                  Delete note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {candidate ? (
        <RestoreDraftBar
          savedAt={candidate.updated_at}
          onRestore={restoreCandidate}
          onDiscard={discardCandidate}
        />
      ) : null}

      {autosave.status === 'blocked' ? (
        <EditorNotice tone="alert" title="You've reached your note limit">
          {autosave.failure?.message ??
            'Your plan does not allow another note right now.'}{' '}
          What you write here stays on this device until a note can be created.
        </EditorNotice>
      ) : null}

      {overLimit ? (
        <EditorNotice tone="alert" title="This note is too long to save">
          A note holds up to {NOTE_CONTENT_LIMIT.toLocaleString()} characters.
          Saving is paused until this one is shorter — nothing you have already
          saved is affected.
        </EditorNotice>
      ) : null}

      {images.error ? (
        <EditorNotice tone="alert" title="Image not added" onDismiss={images.dismissError}>
          {images.error}
        </EditorNotice>
      ) : null}

      <textarea
        ref={titleElementRef}
        value={title}
        onChange={(event) => applyTitle(event.target.value)}
        onKeyDown={(event) => {
          // Enter LEAVES the title. A note title is one line by definition, and
          // the backend stores it as one; a newline here would be invisible in
          // every list and reader that shows it. So the key does the thing the
          // reader meant — start the body.
          if (event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          editor?.chain().focus('start').run();
        }}
        rows={1}
        // The backend caps a title at 500 characters. Enforced at the door
        // rather than discovered at the save: a pasted long first line would
        // otherwise 422, and a 422 is a settled refusal that parks autosave on
        // the retry chip until the reader works out which field was too long.
        maxLength={500}
        // A new note opens with the caret in the title — the reader came here to
        // write, and asking them to click first is a step with no purpose. An
        // EXISTING note does not steal focus: they may have come to read it.
        autoFocus={initialRecord === null}
        placeholder="Untitled"
        aria-label="Note title"
        className={cn(
          'w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-3xl font-semibold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-4xl',
          FOCUS_RING,
          'focus-visible:ring-offset-4',
        )}
      />

      <div className="mt-6">
        <EditorContent editor={editor} />
      </div>

      {editor && coarsePointer === false ? (
        <EditorBubbleMenu editor={editor} state={formatState} onLink={handleLink} />
      ) : null}

      {editor && coarsePointer === true ? (
        <FormattingBar
          editor={editor}
          state={formatState}
          onLink={handleLink}
          onImage={handleImage}
          onMention={handleMention}
          imageBusy={images.busy}
        />
      ) : null}

      <CaseMentionList store={mentionStore} />

      <LinkDialog
        open={linkOpen}
        initialHref={linkHref}
        onOpenChange={setLinkOpen}
        onSubmit={applyLink}
      />

      {record ? (
        <DeleteNoteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          note={record}
          onDeleted={() => {
            mirrorForget(noteMirrorKey(record.id));
            router.push('/notes?tab=mine');
          }}
        />
      ) : null}

      {/* The picker's DOM lives here, not in `useNoteImageUploads` — see that
          hook's `upload` note for why the ref must not leave a hook. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_INPUT_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared immediately so picking the SAME file twice still fires.
          event.target.value = '';
          if (file) images.upload(file);
        }}
        className="hidden"
      />
    </div>
  );
}

/** An in-paper notice: never a toast, never a modal, always dismissible if it can be. */
function EditorNotice({
  title,
  tone,
  children,
  onDismiss,
}: {
  title: string;
  tone: 'alert';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        'mb-6 flex items-start gap-3 rounded-xl border px-4 py-3',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
        tone === 'alert' && 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <TriangleAlert
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'v2-interactive -mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
