'use client';

import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  AlertCircle,
  ArrowUp,
  FileText,
  FileUp,
  Loader2,
  Paperclip,
  Plus,
  ShieldCheck,
  VenetianMask,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileUpload,
  FileUploadContent,
} from '@/components/ui/file-upload';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';

import { cn } from '@/lib/utils';
import { uploadAttachment } from '@/v2/features/conversations/attachment-upload';
import { seedEarlyRuling } from '@/v2/features/conversations/conversation/early-ruling';
import { ActivityStatus } from '@/v2/features/conversations/conversation/ActivityStatus';
import { REDACTING_LABEL } from '@/v2/features/conversations/conversation/redaction-wait';
import { useV2Session } from '@/v2/runtime/session-context';
import { reportChatError } from '@/v2/runtime/chat-errors/report';
import { extractApiError, extractBlockedReason } from '@/lib/utils/api-error';
import type { IBlockedReason } from '@/types/message-pack';
import type { UserRole } from '@/types/auth';
import type { ChatReference } from '@/types/chat';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import {
  RedactionUnavailableError,
  startConversation,
} from '@/v2/features/conversations/start-conversation';
import {
  ALLOWED_FILE_TYPES,
  ATTACHMENT_SIZE_ERROR,
  ATTACHMENT_TYPE_ERROR,
  MAX_FILES_PER_TURN,
  acceptedTypesFor,
  allowedInMode,
  allowedTypesFor,
  attachmentHintFor,
  isImageAttachment,
  maxSizeFor,
  privateModeFileError,
  privateModeOf,
} from '@/v2/features/conversations/attachment-rules';
import { JurisdictionField } from './composer/JurisdictionField';
import { WorkflowField } from './composer/WorkflowField';
import { useWorkflowSelection } from './composer/useWorkflowSelection';
import { OutOfMessagesStrip } from '@/v2/features/subscription/OutOfMessagesStrip';
import { homeSendFailure } from './home-send-failure';

/**
 * HomeComposer — the ONE v2-native composer both home designs share, now WIRED to
 * actually send. On submit it uploads-then-creates via the shared
 * `startConversation` flow, writes the byte-compatible `conv_init` handoff, and
 * navigates to `/c/{id}` — which falls through to v1's conversation page, where the
 * stream runs (the strangler seam; wave 3 claims that route and reuses the same
 * handoff). It faithfully reproduces the UX, states, and copy studied first-hand in
 * `app/(main)/page.tsx`:
 *
 *  - a `+` plus-menu with Attach files + the CONSOLIDATED privacy toggles
 *    (Redacted + Confidential);
 *  - a ROLE-AWARE workflow selector (`WorkflowField` over `useWorkflowSelection`);
 *  - a jurisdiction chip (`JurisdictionField`) over v1's live jurisdiction list;
 *  - REAL attachments: per-file upload with uploading / uploaded / failed chips,
 *    v1's validation (PDF/DOC/DOCX/RTF, 10MB, ×10, dedup), remove, and drag-drop;
 *  - GUEST submit routes to `/login` preserving the draft (v2-honest equivalent of
 *    v1's in-place auth modal — see `useComposerDraft`).
 *
 * FURNITURE → SUBMIT. Jurisdiction is controlled here (so submit can read the
 * choice + carry it into v1's per-conversation slot); the workflow selection lives
 * in `useWorkflowSelection` so its resolved id reaches the payload; confidential is
 * controlled by the parent design (the greeting presents it); redacted + study-mode
 * ride in as the plus-menu toggle / the Study tab's state.
 *
 * SMOOTH MOTION (owner rule #17): the confidential emerald ring fades in/out, the
 * redacted dot scales+fades, attachment chips animate in on add and out on remove,
 * the send button swaps to a spinner while creating — all `motion-reduce`-guarded.
 *
 * PORTAL-EVENT NOTE (studied from v1): React synthetic events bubble through the
 * React tree even out of portaled menu content, so a click inside an open menu
 * would reach `PromptInput`'s root `onClick`, refocus the textarea, and Radix would
 * read that as focus-outside and close the menu. Every furniture trigger and menu
 * surface therefore stops click propagation.
 */

/** Per-file upload slot — v1's `FileUploadEntry` shape, byte-for-byte. */
/** The picture itself when there is one, the document glyph otherwise. A
 *  component rather than a ternary inline, because the `next/image` pragma
 *  belongs on the element and not buried in a branch. */
function AttachmentIcon({ preview }: { preview?: string }) {
  if (!preview) {
    return <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={preview} alt="" className="size-5 shrink-0 rounded object-cover" />;
}

interface FileUploadEntry {
  key: string;
  file_name: string;
  file_size: number;
  status: 'uploading' | 'uploaded' | 'failed';
  /** Object URL for a picture, revoked when the chip goes. Same contract as
   *  the conversation composer's — see `attachment-rules.ts`. */
  preview?: string;
  file_id?: number;
  /** From the upload's answer, so the sent message can show a picture as one. */
  mime_type?: string;
  error?: string;
}

/** Attachment exit window — must clear before the row leaves the DOM. */
const CHIP_EXIT_MS = 160;

/** Compact human file size — pure, so it is safe to call in render. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The space a conversation starts in (`SpaceChatDock`, a space's Conversations tab). */
export interface HomeComposerSpace {
  uuid: string;
  name: string;
}

/** What a host may ask of the box: open its own file picker, so a file picked
 *  from outside the box (an empty space's Upload files) lands in it as a chip. */
export interface HomeComposerHandle {
  attach: () => void;
}

interface HomeComposerBaseProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Signed-in users get the full furniture; guests get a bare composer. */
  signedIn: boolean;
  /** Drives the role-aware workflow selector (users vs admin/superadmin). */
  role?: UserRole;
  /** Study-mode CTA state (Study tab only) — sends `study_mode: true` on create. */
  studyMode?: boolean;
  /**
   * Tie the new conversation to the content it is about. Set by a CONTENT page
   * (the case page's ask composer sends `[{ type: 'case', id: slug }]`); the home
   * leaves it undefined.
   *
   * This is the whole reason the case page reuses this composer rather than
   * growing its own: one composer, one create path, one set of privacy and
   * jurisdiction rules. v1 answered the same need with a SECOND chat engine
   * embedded in a sheet (800 lines with its own SSE handling and its own message
   * rendering, which drifted from the real conversation page). Here the case page
   * creates a normal conversation and hands the reader to the real one.
   */
  references?: ChatReference[];
  /** Placeholder override — a content page asks about its own subject. */
  placeholder?: string;
  /** Extra classes for the PromptInput card (per-design shadow / padding). */
  className?: string;
  /** Extra classes for the textarea (per-design font sizing). */
  textareaClassName?: string;
  /** Extra classes for the send button (per-design desktop sizing). */
  sendButtonClassName?: string;
  /** The box's handle (`HomeComposerHandle`): a host's own button opens the
   *  box's picker (Arthur, 15 October 2026: an upload from an empty space showed
   *  no sign of where it went; now it is a chip in the box until it is sent). */
  handle?: Ref<HomeComposerHandle>;
  /** A redacted send started (`true`) or was refused (`false`). The host fades
   *  its suggested prompts while it waits, so nothing sits behind the box
   *  (Stay, 22 October 2026, of the old line among the prompts: "it looks like
   *  a mess"). */
  onRedactingChange?: (redacting: boolean) => void;
}

/**
 * The home and the content pages offer the private modes, with confidential
 * CONTROLLED by the design so the greeting can present it. A space (Spaces
 * F4) offers neither: the server refuses both beside `space_uuid`, so the
 * plus-menu has no Privacy section and there is nothing to control.
 */
export type HomeComposerProps = HomeComposerBaseProps &
  (
    | {
        space?: undefined;
        confidential: boolean;
        onConfidentialChange: (next: boolean) => void;
      }
    | {
        /** Start the conversation in this space (`space_uuid`, backend B4). */
        space: HomeComposerSpace;
        confidential?: undefined;
        onConfidentialChange?: undefined;
      }
  );

export function HomeComposer({
  value,
  onValueChange,
  signedIn,
  role,
  confidential = false,
  onConfidentialChange,
  studyMode = false,
  references,
  space,
  placeholder = 'Ask a legal question',
  className,
  textareaClassName,
  sendButtonClassName,
  handle,
  onRedactingChange,
}: HomeComposerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useV2Session();
  const fileInputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(handle, () => ({ attach: () => fileInputRef.current?.click() }), []);

  const [uploads, setUploads] = useState<FileUploadEntry[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [redacted, setRedacted] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<JurisdictionChoice>({ mode: 'auto' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** When Send was pressed (epoch ms), for the redaction wait's clock. */
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A server BLOCK (message cap / plan gate) is not a failure — it gets its own
  // reason-aware banner with the upgrade path, mirroring v1's MessageBlockBanner
  // semantics (v2-native rendering; the v1 banner component is boundary-blocked).
  const [blocked, setBlocked] = useState<IBlockedReason | null>(null);

  const workflow = useWorkflowSelection(role);

  const uploadedFiles = uploads.filter((u) => u.status === 'uploaded');
  const isUploading = uploads.some((u) => u.status === 'uploading');
  // v1 parity: the message text is required to send. (v1's files-only path is a
  // dead click — its `fullMessage` guard returns on empty text — so v2 makes the
  // send button honestly reflect that instead of enabling a no-op.)
  const canSend = value.trim().length > 0;

  /* The private mode that limits files, and the files it refuses. Here a mode
     can be switched on AFTER files were attached, so the pick-time check
     alone would let a PDF through to a redacted chat. The refusal is derived,
     not stored: switching the mode off, or removing the file, clears it. */
  const privateMode = privateModeOf(redacted, confidential);
  const refusedByMode = uploads.filter(
    (u) => u.status !== 'failed' && !allowedInMode(u, privateMode),
  );
  const modeError =
    privateMode && refusedByMode.length > 0 ? privateModeFileError(privateMode) : null;
  const shownError = error ?? modeError;
  /** A refused file holds Send, as in the conversation composer: it used to
   *  be dropped from the message in silence. */
  const hasFailedUpload = uploads.some((u) => u.status === 'failed');

  // ── Attachments ──────────────────────────────────────────────────────────
  const handleFilesAdded = async (newFiles: File[]) => {
    if (!signedIn || newFiles.length === 0) return;
    if (error) setError(null);

    // Reserve slots — accept up to the remaining cap, dedupe by name+size against
    // anything already listed (uploading, done, or failed). v1's exact rules.
    const existingKeys = new Set(uploads.map((u) => `${u.file_name}::${u.file_size}`));
    const remainingSlots = MAX_FILES_PER_TURN - uploads.length;
    const accepted: { file: File; entry: FileUploadEntry }[] = [];
    let rejectedType = false;
    let rejectedByMode = false;
    let rejectedSize = false;
    let rejectedDuplicate = false;
    let rejectedCap = false;

    for (const file of newFiles) {
      if (!allowedTypesFor(privateMode).includes(file.type)) {
        if (privateMode && ALLOWED_FILE_TYPES.includes(file.type)) rejectedByMode = true;
        else rejectedType = true;
        continue;
      }
      if (file.size > maxSizeFor(file)) {
        rejectedSize = true;
        continue;
      }
      const dedupKey = `${file.name}::${file.size}`;
      if (existingKeys.has(dedupKey)) {
        rejectedDuplicate = true;
        continue;
      }
      if (accepted.length >= remainingSlots) {
        rejectedCap = true;
        break;
      }
      existingKeys.add(dedupKey);
      const slotKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      accepted.push({
        file,
        entry: {
          key: slotKey,
          file_name: file.name,
          file_size: file.size,
          status: 'uploading',
          preview: isImageAttachment(file) ? URL.createObjectURL(file) : undefined,
        },
      });
    }

    if (rejectedByMode && privateMode) {
      setError(privateModeFileError(privateMode));
    } else if (rejectedType) {
      setError(ATTACHMENT_TYPE_ERROR);
    } else if (rejectedSize) {
      setError(ATTACHMENT_SIZE_ERROR);
    } else if (rejectedCap) {
      setError(`You can attach at most ${MAX_FILES_PER_TURN} files per message.`);
    } else if (rejectedDuplicate && accepted.length === 0) {
      setError('That file is already attached.');
    }

    if (accepted.length === 0) return;

    setUploads((prev) => [...prev, ...accepted.map((a) => a.entry)]);

    // Upload in parallel — settle each independently so one failure never blocks
    // the others. Update each slot in place by key.
    await Promise.all(
      accepted.map(async ({ file, entry }) => {
        try {
          // From a space's box the file is the space's (attachment-upload.ts).
          const uploaded = await uploadAttachment(file, space?.uuid ?? null);
          setUploads((prev) =>
            prev.map((u) =>
              u.key === entry.key
                ? {
                    ...u,
                    status: 'uploaded',
                    file_id: uploaded.id,
                    file_name: uploaded.original_name,
                    file_size: uploaded.size,
                    mime_type: uploaded.mime_type,
                  }
                : u,
            ),
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.key === entry.key
                ? { ...u, status: 'failed', error: extractApiError(err).message }
                : u,
            ),
          );
        }
      }),
    );
  };

  // Play the exit animation, then drop the row. The timer (not an effect) commits
  // the removal, so it also fires under reduced motion where the visual exit is
  // suppressed — the chip still leaves, just without the animation.
  const removeUpload = (key: string) => {
    setRemoving((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    window.setTimeout(() => {
      setUploads((prev) => {
        const going = prev.find((u) => u.key === key);
        if (going?.preview) URL.revokeObjectURL(going.preview);
        return prev.filter((u) => u.key !== key);
      });
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, CHIP_EXIT_MS);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const message = value.trim();
    // A refusal for messages holds Send until the text changes (Enter alone
    // would only ask again and be refused again).
    if (
      !message ||
      blocked ||
      isSubmitting ||
      isUploading ||
      hasFailedUpload ||
      refusedByMode.length > 0
    ) {
      return;
    }

    // Guest: v1 opens an in-place auth modal (boundary-blocked). The v2-honest
    // equivalent routes to the real login page; the typed text is already saved in
    // the shared draft (`useComposerDraft`), so the home restores it after login.
    if (!signedIn) {
      router.push('/login');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setSubmittedAt(Date.now());
    if (redacted) onRedactingChange?.(true);
    try {
      const result = await startConversation(
        {
          message,
          attachments: uploadedFiles.map((u) => ({
            file_id: u.file_id!,
            file_name: u.file_name,
            file_size: u.file_size,
            mime_type: u.mime_type,
          })),
          jurisdiction,
          workflowId: workflow.value ? Number(workflow.value) : undefined,
          studyMode,
          confidential,
          redacted,
          references,
          spaceUuid: space?.uuid,
        },
        { queryClient },
      );

      // The turn is committed — clear the draft (removes it from storage) and the
      // attachment chips. We are navigating away, so no further local reset needed.
      onValueChange('');
      // Every thumbnail made for this turn is released as the tray empties.
      for (const u of uploads) if (u.preview) URL.revokeObjectURL(u.preview);
      setUploads([]);

      if (result.status === 'existing') {
        router.push(`/c/${result.conversationId}`);
        return;
      }

      const target = `/c/${result.conversationId}?init=1`;
      // The new chat is the reader's own and they may send in it, so the
      // chat's docked box (ChatDock) is the real one from the move's first
      // frame, held while the first answer streams, not a skeleton until the
      // chat's screen says so (message box B).
      if (!result.hardNavigate && userId !== null) {
        seedEarlyRuling(result.conversationId, {
          ownerId: userId,
          canSend: true,
          viewOnlyReason: 'shared',
          spaceUuid: space?.uuid ?? null,
          isConfidential: false,
        });
      }
      if (result.hardNavigate) {
        // Confidential / redacted: a fresh load so v1's session mode store hydrates
        // the mark we wrote, regardless of whether its module was already resident.
        window.location.assign(target);
      } else {
        router.push(target);
      }
      // Keep `isSubmitting` true through navigation so the button never re-arms for
      // a double-submit before the home unmounts.
    } catch (err) {
      // Failure: keep the draft + attachments so the user can simply retry.
      if (err instanceof RedactionUnavailableError) {
        setError(
          err.retryAfter
            ? `Redaction service is temporarily unavailable. Try again in ${err.retryAfter}s.`
            : 'Redaction service is temporarily unavailable. Please try again shortly.',
        );
      } else if (extractBlockedReason(err)) {
        // Server block (limits / plan gating) — the reason-aware banner, not a
        // raw error string (v1 parity: page.tsx branches the same way).
        setBlocked(extractBlockedReason(err));
        setError(null);
      } else if (err instanceof AxiosError) {
        // No answer at all: reported, and said with what the box still holds.
        // An answer: the API's message; in a space, a refusal in the space's
        // words (`home-send-failure`).
        const failure = homeSendFailure(err, { attachments: uploadedFiles.length, inSpace: Boolean(space) });
        if (failure.report) reportChatError(failure.report);
        setError(failure.message);
      } else if (err instanceof Error) {
        // A `success: false` body throws with the server's message — keep it.
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setIsSubmitting(false);
      onRedactingChange?.(false);
    }
  };

  // Keep clicks inside portaled menus from bubbling to PromptInput's root (see
  // the PORTAL-EVENT NOTE above).
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <FileUpload
      onFilesAdded={signedIn ? handleFilesAdded : () => {}}
      accept={acceptedTypesFor(privateMode)}
      multiple
      disabled={!signedIn}
    >
      {/* Hidden picker driven by the plus-menu's "Attach files". Resetting the
          value on change lets the same file be re-picked after removal. */}
      {signedIn ? (
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypesFor(privateMode)}
          multiple
          hidden
          onChange={(event) => {
            void handleFilesAdded(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      ) : null}

      {/* Create / upload error banner — distinct from the per-chip failed state
          below. Fades in/out (owner motion rule); cleared on the next keystroke. */}
      {shownError ? (
        <div
          role="alert"
          className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{shownError}</span>
        </div>
      ) : null}


      {/* The jurisdiction stands above the box, as on the chat screen, so the
          model name keeps the box's control row to itself on a narrow phone
          (owner, 3 October 2026). */}
      {signedIn ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
          <JurisdictionField
            signedIn={signedIn}
            value={jurisdiction}
            onChange={setJurisdiction}
            disabled={isSubmitting}
            stop={stop}
            label="Jurisdiction:"
          />
        </div>
      ) : null}

      {/* Confidential surface cue — a soft emerald ring that fades in/out with the
          mode (the primitive swaps its own outline; this animates the whole surface
          so the change never just snaps). */}
      <div
        className={cn(
          'rounded-3xl transition-shadow duration-300 ease-out motion-reduce:transition-none',
          confidential && 'ring-4 ring-emerald-500/15',
        )}
      >
        <PromptInput
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            if (error) setError(null);
            if (blocked) setBlocked(null);
          }}
          onSubmit={handleSubmit}
          disabled={isSubmitting}
          variant={confidential ? 'confidential' : 'default'}
          className={className}
        >
          {/* The send was refused for messages: a strip joined to the top of
              the box (C4, v2 Stage 1 item 6; Stay, 19 October 2026), from the
              refusal's own block. The question stays below it and Send waits.
              Cleared on the next keystroke. */}
          {blocked ? <OutOfMessagesStrip blocked={blocked} /> : null}

          {/* REDACTED MODE, THE WAIT BEFORE THE CHAT OPENS (Stay, 22 October
              2026, option A). A new redacted chat's first message is redacted
              inside the create request, on this screen, before the chat page
              opens: 5 s for 12 pages, up to about 20 s for 50. The box itself
              says so, in the strip a refused send uses, counting from Send; the
              host fades its prompts (`onRedactingChange`), and the strip stays
              through the move to the new chat (`isSubmitting` holds until this
              screen unmounts). */}
          {isSubmitting && redacted && submittedAt !== null ? (
            <div className="-mx-2.5 -mt-2.5 mb-2 rounded-t-3xl border-b border-border bg-secondary/50 px-4 py-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
              <ActivityStatus startTime={submittedAt} narration={REDACTING_LABEL} />
            </div>
          ) : null}

          {/* Attachment chips — one per selected file, with live upload status. */}
          {signedIn && uploads.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-2 pt-2">
              {uploads.map((upload) => {
                const isRemoving = removing.has(upload.key);
                const isFailed = upload.status === 'failed';
                const isRefused = refusedByMode.includes(upload);
                return (
                  <div
                    key={upload.key}
                    onClick={stop}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
                      isFailed || isRefused ? 'bg-destructive/10 text-destructive' : 'bg-secondary',
                      isFailed && 'max-w-full flex-wrap',
                      isRemoving
                        ? 'motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-95 motion-safe:duration-150'
                        : 'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150',
                    )}
                  >
                    {upload.status === 'uploading' ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                    ) : isFailed ? (
                      <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                    ) : (
                      <AttachmentIcon preview={upload.preview} />
                    )}
                    <span className="max-w-[140px] truncate" title={upload.file_name}>
                      {upload.file_name}
                    </span>
                    {upload.status === 'uploaded' ? (
                      <span className="text-muted-foreground">{formatBytes(upload.file_size)}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeUpload(upload.key)}
                      aria-label={`Remove ${upload.file_name}`}
                      className="v2-interactive rounded-full p-0.5 text-current transition-colors hover:bg-background/70"
                    >
                      <X className="size-3.5" />
                    </button>
                    {/* The server's whole message, on its own line: see the
                        conversation composer's chip. */}
                    {isFailed && upload.error ? (
                      <span className="basis-full break-words opacity-80">{upload.error}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <PromptInputTextarea
            placeholder={placeholder}
            className={cn('text-foreground placeholder:text-muted-foreground', textareaClassName)}
            /* Pasting a picture here does what the attach button does, and what
               pasting one into the conversation composer does. A screenshot
               landing in one box and vanishing in the other is the kind of
               difference somebody finds by accident. */
            onPasteFiles={(files) => void handleFilesAdded(files)}
          />

          <PromptInputActions className="flex items-center gap-2 px-2 pb-1">
            {signedIn ? (
              // Horizontally-scrollable toolbar keeps every control reachable at
              // 320px without wrapping the row. py-0.5: overflow-x-auto forces
              // overflow-y to auto, which would clip the + focus ring otherwise.
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {/* Plus-menu: Attach + consolidated privacy toggles. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Attach files and privacy options"
                      onClick={stop}
                      disabled={isSubmitting}
                      className="v2-interactive relative flex size-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="size-5" />
                      {/* Redacted dot — scales+fades both ways, never a hard pop. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute right-1 top-1 size-1.5 rounded-full bg-indigo-500 ring-2 ring-background transition-all duration-150 motion-reduce:transition-none',
                          redacted ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
                        )}
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="top"
                    sideOffset={8}
                    className="w-72"
                    onClick={stop}
                  >
                    <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                      <Paperclip className="text-muted-foreground" />
                      <span className="flex-1">Attach files</span>
                      <span className="text-xs text-muted-foreground">
                        {attachmentHintFor(privateMode)}
                      </span>
                    </DropdownMenuItem>

                    {/* No private modes in a space: the server refuses both there. */}
                    {space ? null : (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Privacy</DropdownMenuLabel>

                        <DropdownMenuCheckboxItem
                          checked={redacted}
                          onCheckedChange={setRedacted}
                          onSelect={(event) => event.preventDefault()}
                        >
                          <VenetianMask
                            className={redacted ? 'text-indigo-500' : 'text-muted-foreground'}
                          />
                          <span className="flex flex-col">
                            <span className="font-medium leading-tight">Redacted mode</span>
                            <span className="text-xs text-muted-foreground">
                              Hide names, addresses &amp; IDs from the model
                            </span>
                          </span>
                        </DropdownMenuCheckboxItem>

                        <DropdownMenuCheckboxItem
                          checked={confidential}
                          onCheckedChange={onConfidentialChange}
                          onSelect={(event) => event.preventDefault()}
                        >
                          <ShieldCheck
                            className={
                              confidential
                                ? 'text-emerald-600 dark:text-emerald-500'
                                : 'text-muted-foreground'
                            }
                          />
                          <span className="flex flex-col">
                            <span className="font-medium leading-tight">Confidential mode</span>
                            <span className="text-xs text-muted-foreground">
                              Stored only on this device until you delete it
                            </span>
                          </span>
                        </DropdownMenuCheckboxItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Role-aware workflow selector — v1's Lite/Expert or admin list. */}
                <WorkflowField
                  options={workflow.options}
                  value={workflow.value}
                  onChange={workflow.setValue}
                  isLoading={workflow.isLoading}
                  disabled={isSubmitting}
                  stop={stop}
                />

              </div>
            ) : (
              <span className="flex-1" />
            )}

            {/* Send — the primary action. ≥44px on mobile; spins while creating. */}
            <PromptInputAction tooltip="Send message">
              <Button
                type="button"
                size="icon"
                className={cn(
                  'v2-interactive size-11 shrink-0 rounded-full bg-primary hover:bg-primary/90',
                  sendButtonClassName,
                )}
                onClick={handleSubmit}
                disabled={
                  !canSend ||
                  blocked !== null ||
                  isUploading ||
                  isSubmitting ||
                  hasFailedUpload ||
                  refusedByMode.length > 0
                }
                aria-label="Send message"
              >
                {isSubmitting ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ArrowUp className="size-5" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>

      {/* Drag-and-drop overlay — signed-in only (guests get no attachments). */}
      {signedIn ? (
        <FileUploadContent>
          <div className="flex min-h-[200px] w-full items-center justify-center">
            <div className="bg-background/90 m-4 w-full max-w-md rounded-lg border p-8 shadow-lg">
              <div className="mb-4 flex justify-center">
                <FileUp className="size-8 text-muted-foreground" aria-hidden />
              </div>
              <h3 className="mb-2 text-center text-base font-medium">Drop to upload</h3>
              <p className="text-center text-sm text-muted-foreground">
                Release to attach a PDF, DOC, DOCX, RTF or a picture to your
                message
              </p>
            </div>
          </div>
        </FileUploadContent>
      ) : null}
    </FileUpload>
  );
}
