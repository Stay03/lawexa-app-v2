'use client';

import { useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  FileText,
  FileUp,
  Loader2,
  Paperclip,
  Plus,
  ShieldCheck,
  Square,
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
import { FileUpload, FileUploadContent } from '@/components/ui/file-upload';
import {
  PromptInput,
  PromptInputAction,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import { cn, serializePastedContent } from '@/lib/utils';
import { chatApi } from '@/lib/api/chat';
import { extractApiError } from '@/lib/utils/api-error';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import type { MessageAttachment } from '@/types/chat';
import { JurisdictionField } from '@/v2/shell/designs/composer/JurisdictionField';
import { PastedContentCard } from './PastedContentCard';
import { usePastedContent } from './usePastedContent';

/**
 * ConversationComposer — the FLOATING PILL for the conversation screen. It is rendered
 * by ConversationScreen as an ABSOLUTE layer over the bottom of the content scroll
 * region (NOT the dock grid-row — the owner rejected that opaque-band look), so the
 * transcript genuinely scrolls BEHIND and UNDER it; the shell's dvh + `--keyboard-inset`
 * region keeps that layer above the keyboard — never `position: fixed`. This component
 * owns only the pill + its staging; the float/keyboard/no-CLS mechanics live in
 * ConversationScreen.
 *
 * COMPACT PILL (owner-chosen v1 scale — the collapsed floating-prompt bar on the
 * case/note/statute pages). Width comes from the CONTAINER (the `/c/{id}` overlay
 * carries the `max-w-xs sm:max-w-md` ≈448px cap; the case chat's card is its own
 * constraint), with a `min-h-9` (36px) textarea and `size-8` round `+` / Send/Stop
 * buttons — deliberately smaller than the home hero. The textarea FONT is NOT
 * shrunk (base stays 16px on mobile → no iOS zoom).
 * The pill's own solid `bg-background` face carries a DOWNWARD-biased soft shadow so it
 * casts no shade band up into the transcript. (Owner note: this 28–32px control scale is
 * an explicit, owner-preferred deviation from the 44px touch-target rule.)
 *
 * ANATOMY: ONE compact input row inside the `PromptInput` card — a round `+` menu on
 * the left (text-primary), the auto-grow textarea in the middle (rows=1, height-capped
 * then internal scroll), and the round Send/Stop button on the right. Everything that
 * "arms" the next turn FLOATS ABOVE the pill (the owner's screenshot has the jurisdiction
 * chip above the bar): the jurisdiction chip + redacted pill (the meta row), the
 * confidential file notice, the error banner, the attachment chips, and the
 * pasted-content cards stack ABOVE the card — the Slack/Grok staging tray. Each carries
 * its own SOLID surface (the jurisdiction chip is `bg-background`, not translucent, so
 * transcript text never shows through it while scrolling); the ones that appear mid-turn
 * animate symmetrically (persistent-collapse notice/error, removing-set attachment +
 * pasted chips). Overlays (the jurisdiction popover, tooltips, the +-menu) float above.
 *
 * EVERY capability is preserved: jurisdiction picker, real attachments (upload chips +
 * drag-drop, PDF/DOC/DOCX/RTF, 10MB × 10, dedup, symmetric add/remove animation),
 * pasted-content staging, the plus-menu (Attach + the conversation's STICKY privacy
 * modes shown locked, with honest confidential copy), the redacted pill, the
 * confidential file notice, per-conversation draft persistence, the Send/Stop toggle
 * with its cancelling state, the confidential `PromptInput` variant, the portal-event
 * `stop` guards, and the streaming/submitting disabled states. No workflow selector /
 * confidential toggle / study mode — those are turn-1 create concerns owned by the home
 * composer.
 */
const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.rtf';
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_TURN = 10;
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
];
/** Attachment exit window — must clear before the row leaves the DOM. */
const CHIP_EXIT_MS = 160;

interface FileUploadEntry {
  key: string;
  file_name: string;
  file_size: number;
  status: 'uploading' | 'uploaded' | 'failed';
  file_id?: number;
  error?: string;
}

/** Compact human file size — pure, safe in render. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Imperative staging handle — hosts (the case chat's opener chips) fill the
 *  draft through this so the composer keeps OWNING its input state. */
export interface ConversationComposerHandle {
  /** Replace the draft text (the "Start with" chips). Does not steal focus. */
  stage: (text: string) => void;
}

export interface ConversationComposerProps {
  /**
   * Namespace for draft + pasted-content persistence. The `/c/{id}` page passes
   * the conversation id (per-conversation drafts); an embedding surface passes
   * its own stable scope (e.g. `case:{slug}`) so ONE draft survives that
   * surface's list ⇄ conversation swaps.
   */
  draftScopeId: string;
  jurisdiction: JurisdictionChoice;
  onJurisdictionChange: (next: JurisdictionChoice) => void;
  isConfidential: boolean;
  isRedacted: boolean;
  isStreaming: boolean;
  isCancelling: boolean;
  onSubmit: (message: string, attachments: MessageAttachment[]) => Promise<void>;
  onStop: () => void;
  /** Textarea placeholder — embedding surfaces brand it ("Ask about this case"). */
  placeholder?: string;
  /** False hides the jurisdiction meta row and disables its jurisdictions query
   *  (guests). Default true — the `/c/{id}` composer only renders for owners. */
  signedIn?: boolean;
  /**
   * Collapses the meta row (jurisdiction + redacted) via the same grid-collapse
   * every other staged row uses — the case dock's CLOSED state, where only the
   * pill shows. Staged attachments/pastes stay visible: armed state is honest.
   */
  showMeta?: boolean;
  /** Extra hard-disable from the host (e.g. a conversation still wiring up). */
  disabled?: boolean;
  /** Focus the textarea on mount (the mobile sheet's opening gesture). */
  autoFocus?: boolean;
  /** Interactions that should open the host's panel (focus / click / typing). */
  onEngage?: () => void;
  /** The staging handle — see {@link ConversationComposerHandle}. */
  stageRef?: React.Ref<ConversationComposerHandle>;
}

export function ConversationComposer({
  draftScopeId,
  jurisdiction,
  onJurisdictionChange,
  isConfidential,
  isRedacted,
  isStreaming,
  isCancelling,
  onSubmit,
  onStop,
  placeholder = 'Ask a follow-up',
  signedIn = true,
  showMeta = true,
  disabled = false,
  autoFocus = false,
  onEngage,
  stageRef,
}: ConversationComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draft persistence per scope — lazy init + persist in the setter (React
  // Compiler-clean, mirrors useComposerDraft).
  const draftKey = `conversation_draft_${draftScopeId}`;
  const [input, setInputState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(draftKey) ?? '';
    } catch {
      return '';
    }
  });
  const setInput = useCallback(
    (next: string) => {
      setInputState(next);
      if (typeof window === 'undefined') return;
      try {
        if (next) window.localStorage.setItem(draftKey, next);
        else window.localStorage.removeItem(draftKey);
      } catch {
        // storage unavailable — in-memory only.
      }
    },
    [draftKey],
  );

  const { pastedItems, addPasted, removePasted, clearPasted } = usePastedContent(
    `conversation_draft_pasted_${draftScopeId}`,
  );

  // The staging handle — `setInput` persists, so a staged opener survives a
  // reload exactly like typed text. No focus steal (parity with the old chips).
  useImperativeHandle(stageRef, () => ({ stage: setInput }), [setInput]);
  const [uploads, setUploads] = useState<FileUploadEntry[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [removingPasted, setRemovingPasted] = useState<Set<string>>(new Set());
  // Error banner — a persistent COLLAPSE node: `errorText` persists through the exit
  // so the height + opacity animate BOTH directions (one system with the confidential
  // notice, which is likewise a persistent collapse of static copy). `errorOpen` drives
  // the grid-collapse; the text only changes when a NEW error is shown, so a dismiss
  // animates out with its own words still in place.
  const [errorText, setErrorText] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showError = (message: string) => {
    setErrorText(message);
    setErrorOpen(true);
  };
  const hideError = () => setErrorOpen(false);

  const uploadedFiles = uploads.filter((u) => u.status === 'uploaded');
  const isUploading = uploads.some((u) => u.status === 'uploading');
  const canSend =
    (input.trim().length > 0 || uploadedFiles.length > 0 || pastedItems.length > 0) &&
    !isUploading &&
    !isSubmitting &&
    !disabled;

  const handleFilesAdded = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    if (errorOpen) hideError();

    const existingKeys = new Set(uploads.map((u) => `${u.file_name}::${u.file_size}`));
    const remainingSlots = MAX_FILES_PER_TURN - uploads.length;
    const accepted: { file: File; entry: FileUploadEntry }[] = [];
    let rejectedType = false;
    let rejectedSize = false;
    let rejectedDuplicate = false;
    let rejectedCap = false;

    for (const file of newFiles) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        rejectedType = true;
        continue;
      }
      if (file.size > MAX_DOCUMENT_SIZE) {
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
        entry: { key: slotKey, file_name: file.name, file_size: file.size, status: 'uploading' },
      });
    }

    if (rejectedType) showError('Only PDF, DOC, DOCX, and RTF files are supported.');
    else if (rejectedSize) showError('Each file must be 10MB or less.');
    else if (rejectedCap) showError(`You can attach at most ${MAX_FILES_PER_TURN} files per message.`);
    else if (rejectedDuplicate && accepted.length === 0) showError('That file is already attached.');

    if (accepted.length === 0) return;
    setUploads((prev) => [...prev, ...accepted.map((a) => a.entry)]);

    await Promise.all(
      accepted.map(async ({ file, entry }) => {
        try {
          const res = await chatApi.uploadDocument(file);
          setUploads((prev) =>
            prev.map((u) =>
              u.key === entry.key
                ? {
                    ...u,
                    status: 'uploaded',
                    file_id: res.data.id,
                    file_name: res.data.original_name,
                    file_size: res.data.size,
                  }
                : u,
            ),
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.key === entry.key ? { ...u, status: 'failed', error: extractApiError(err).message } : u,
            ),
          );
        }
      }),
    );
  };

  // Play the exit animation, then drop the row. The timer (not an effect) commits the
  // removal, so it also fires under reduced motion where the visual exit is suppressed.
  const removeUpload = (key: string) => {
    setRemoving((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    window.setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.key !== key));
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, CHIP_EXIT_MS);
  };

  // Pasted-card removal mirrors the attachment chips: mark exiting, play the exit,
  // then the timer commits `removePasted` — symmetric, and it still leaves under
  // reduced motion where the visual exit is suppressed.
  const handleRemovePasted = (id: string) => {
    setRemovingPasted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      removePasted(id);
      setRemovingPasted((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, CHIP_EXIT_MS);
  };

  const handleSubmit = async () => {
    if (isStreaming || isSubmitting || isUploading || disabled) return;
    const fullMessage = serializePastedContent(pastedItems.map((i) => i.text), input);
    if (!fullMessage) return;

    const attachmentsSnapshot: MessageAttachment[] = uploadedFiles.map((u) => ({
      file_id: u.file_id!,
      file_name: u.file_name,
      file_size: u.file_size,
    }));

    setInput('');
    clearPasted();
    setUploads([]);
    setIsSubmitting(true);
    try {
      await onSubmit(fullMessage, attachmentsSnapshot);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    // Width comes from the CONTAINER (the /c/{id} overlay carries the compact
    // max-w; an embedding card is its own constraint) — so every host's pill
    // fills the same gutters and no two states can disagree about size.
    <div className="w-full px-4 pb-3 pt-2">
      <FileUpload onFilesAdded={handleFilesAdded} accept={ACCEPTED_FILE_TYPES} multiple>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          hidden
          onChange={(event) => {
            void handleFilesAdded(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />

        {/* ── Staging tray: everything that arms the next turn FLOATS ABOVE the pill
            (the Slack/Grok tray — reversed from the previous inside-the-card stack per
            the owner's floating-pill screenshot). Each block carries its own surface,
            so it stays legible on the transparent dock. ── */}

        {/* Jurisdiction + redacted pill (meta row). Guests never see it (no row,
            no jurisdictions query). `showMeta` collapses it with the same
            grid-collapse every staged row uses — the case dock's closed state,
            where the resting pill stands alone; `inert` keeps the collapsed
            chip out of the tab order. */}
        {signedIn ? (
          <div
            inert={!showMeta}
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              showMeta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div
                className={cn(
                  'mb-2 flex flex-wrap items-center gap-2 px-1 transition-opacity duration-200 motion-reduce:transition-none',
                  showMeta ? 'opacity-100' : 'opacity-0',
                )}
              >
                <JurisdictionField
                  signedIn={signedIn}
                  value={jurisdiction}
                  onChange={onJurisdictionChange}
                  disabled={isStreaming || isSubmitting || disabled}
                  stop={stop}
                />
                {isRedacted && (
                  <div
                    className="bg-background flex items-center gap-1.5 rounded-full border border-indigo-500/40 px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400"
                    aria-label="Redacted mode is on for this conversation"
                  >
                    <VenetianMask className="h-3.5 w-3.5" />
                    <span className="font-medium">Redacted</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Confidential file notice — a persistent-node collapse (grid-rows 0fr↔1fr +
            opacity) so it animates BOTH directions; the copy is static, so it fades +
            collapses cleanly when the last file leaves. Inert (aria-hidden) collapsed. */}
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
            isConfidential && uploads.length > 0 ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <p
              aria-hidden={!(isConfidential && uploads.length > 0)}
              className={cn(
                'text-muted-foreground mb-2 px-1 text-xs transition-opacity duration-200 ease-out motion-reduce:transition-none',
                isConfidential && uploads.length > 0 ? 'opacity-100' : 'opacity-0',
              )}
            >
              Files in confidential chats are kept for up to 24 hours, then permanently deleted.
              Make a local copy if you need to keep this file.
            </p>
          </div>
        </div>

        {/* Error banner — the SAME persistent-node collapse. `errorText` persists
            through the exit (it only changes when a new error is shown), so the height +
            opacity animate BOTH ways rather than the box vanishing. Inert + aria-hidden
            when collapsed; `role="alert"` announces when it opens. */}
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
            errorOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div
              role="alert"
              aria-hidden={!errorOpen}
              className={cn(
                'border-destructive/40 bg-destructive/10 text-destructive mb-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm transition-opacity duration-200 ease-out motion-reduce:transition-none',
                errorOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="flex-1">{errorText}</span>
            </div>
          </div>
        </div>

        {/* Attachment chips — symmetric add/remove animation (the exit plays before
            the row is dropped from the DOM). Height-capped at 40vh with a quiet internal
            scroll so a full tray of 10 chips can never squeeze the transcript on a small
            phone with the keyboard up; the meta row, notice, and error sit OUTSIDE this
            scroller so they always stay in view. */}
        {uploads.length > 0 && (
          <div className="mb-2 flex max-h-[40vh] flex-wrap gap-2 overflow-y-auto overscroll-contain px-1">
            {uploads.map((u) => {
              const isRemoving = removing.has(u.key);
              return (
                <div
                  key={u.key}
                  onClick={stop}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
                    u.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-secondary',
                    isRemoving
                      ? 'motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-95 motion-safe:duration-150'
                      : 'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150',
                  )}
                >
                  {u.status === 'uploading' ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                  ) : u.status === 'failed' ? (
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <FileText className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="max-w-[140px] truncate" title={u.file_name}>
                    {u.file_name}
                  </span>
                  {u.status === 'uploaded' && (
                    <span className="text-muted-foreground">{formatBytes(u.file_size)}</span>
                  )}
                  {u.status === 'failed' && u.error && (
                    <span className="max-w-[160px] truncate opacity-80" title={u.error}>
                      {u.error}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeUpload(u.key)}
                    aria-label={`Remove ${u.file_name}`}
                    className="v2-interactive hover:bg-background/70 rounded-full p-0.5 text-current transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pasted content staging — each card animates in on add and OUT on remove
            (the removing-set + timer mirror of the attachment chips), so removals are
            symmetric rather than an abrupt vanish. */}
        {pastedItems.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1">
            {pastedItems.map((item) => {
              const isRemoving = removingPasted.has(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'shrink-0',
                    isRemoving
                      ? 'motion-safe:animate-out motion-safe:fade-out motion-safe:zoom-out-95 motion-safe:duration-150'
                      : 'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150',
                  )}
                >
                  <PastedContentCard content={item.text} onRemove={() => handleRemovePasted(item.id)} />
                </div>
              );
            })}
          </div>
        )}

        {/* ── The pill: the PromptInput card holds ONLY the single input row. ── */}
        <PromptInput
          value={input}
          onValueChange={(next) => {
            setInput(next);
            if (errorOpen) hideError();
            onEngage?.();
          }}
          onSubmit={handleSubmit}
          disabled={isStreaming || isSubmitting || disabled}
          maxHeight={150}
          variant={isConfidential ? 'confidential' : 'default'}
          onClick={onEngage}
          // Downward-biased soft drop (not shadow-lg) so the floating pill casts NO
          // visible shade band UP into the transcript / jurisdiction chip (owner).
          className="shadow-[0_6px_16px_-8px_rgba(0,0,0,0.28)]"
        >
          {/* ── The single input row: + menu | textarea | Send/Stop. ── */}
          <div className="flex items-end gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Attach files and privacy options"
                  onClick={(event) => {
                    stop(event);
                    onEngage?.();
                  }}
                  disabled={isStreaming || isSubmitting || disabled}
                  className="v2-interactive text-primary hover:bg-secondary focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-72" onClick={stop}>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <Paperclip className="text-muted-foreground" />
                  <span className="flex-1">Attach files</span>
                  <span className="text-muted-foreground text-xs">PDF, DOC, RTF</span>
                </DropdownMenuItem>

                {(isRedacted || isConfidential) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Privacy (locked for this chat)</DropdownMenuLabel>
                    {isRedacted && (
                      <DropdownMenuCheckboxItem
                        checked
                        disabled
                        onSelect={(e) => e.preventDefault()}
                      >
                        <VenetianMask className="text-indigo-500" />
                        <span className="flex flex-col">
                          <span className="font-medium leading-tight">Redacted mode</span>
                          <span className="text-muted-foreground text-xs">
                            Names, addresses &amp; IDs hidden from the model
                          </span>
                        </span>
                      </DropdownMenuCheckboxItem>
                    )}
                    {isConfidential && (
                      <DropdownMenuCheckboxItem
                        checked
                        disabled
                        onSelect={(e) => e.preventDefault()}
                      >
                        <ShieldCheck className="text-emerald-600 dark:text-emerald-500" />
                        <span className="flex flex-col">
                          <span className="font-medium leading-tight">Confidential mode</span>
                          <span className="text-muted-foreground text-xs">
                            Stored only on this device until you delete it
                          </span>
                        </span>
                      </DropdownMenuCheckboxItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <PromptInputTextarea
              placeholder={pastedItems.length > 0 ? 'Add a message…' : placeholder}
              autoFocus={autoFocus}
              onFocus={onEngage}
              // Compact v1-floating-prompt scale (min-h-9 = 36px, py-2). Font size is
              // NOT shrunk — the base Textarea stays text-base on mobile (iOS zoom).
              className="text-foreground placeholder:text-muted-foreground min-h-9 flex-1 px-2 py-2"
              onLargePaste={addPasted}
            />

            {isStreaming ? (
              <PromptInputAction tooltip={isCancelling ? 'Cancelling' : 'Stop generating'}>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="v2-interactive size-8 shrink-0 rounded-full disabled:opacity-70"
                  onClick={onStop}
                  disabled={isCancelling}
                  aria-label={isCancelling ? 'Cancelling' : 'Stop generating'}
                >
                  {isCancelling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Square className="size-4" />
                  )}
                </Button>
              </PromptInputAction>
            ) : (
              <PromptInputAction tooltip="Send message">
                <Button
                  type="button"
                  size="icon"
                  className="v2-interactive bg-primary hover:bg-primary/90 size-8 shrink-0 rounded-full"
                  onClick={handleSubmit}
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              </PromptInputAction>
            )}
          </div>
        </PromptInput>

        <FileUploadContent>
          <div className="flex min-h-[200px] w-full items-center justify-center">
            <div className="bg-background/90 m-4 w-full max-w-md rounded-lg border p-8 shadow-lg">
              <div className="mb-4 flex justify-center">
                <FileUp className="text-muted-foreground size-8" aria-hidden />
              </div>
              <h3 className="mb-2 text-center text-base font-medium">Drop to upload</h3>
              <p className="text-muted-foreground text-center text-sm">
                Release to attach a PDF, DOC, DOCX or RTF to your message
              </p>
            </div>
          </div>
        </FileUploadContent>
      </FileUpload>
    </div>
  );
}

/**
 * The composer's RESOLVING visual lives in `./skeletons` (`ComposerSkeleton`), not
 * here. It was co-located with the real pill for lockstep, but the route boundary
 * (`app/v2/c/[id]/loading.tsx`) has to draw the same shape — and it is a SERVER
 * component, so importing it from this `'use client'` module would drag the whole
 * prompt-input tree into the loading payload. `./skeletons` is dependency-free and
 * server-safe, and it is now the ONE definition every consumer renders.
 *
 * LOCKSTEP STILL APPLIES: change the pill's geometry below and change
 * `ComposerSkeleton` in the same commit (its docblock names the three numbers that
 * must agree).
 */
