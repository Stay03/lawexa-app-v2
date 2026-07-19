'use client';

import { useCallback, useRef, useState } from 'react';
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
  PromptInputActions,
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
 * ConversationComposer — the FLOATING dock composer for the conversation screen.
 * It lives in the AppShell dock grid-row (portaled there by ConversationScreen), so
 * it looks floating (rounded, shadowed, inset, transcript scrolling behind) while
 * the shell's dvh + `--keyboard-inset` grid keeps it above the iOS keyboard — never
 * `position: fixed` (v1's defect). Its width is matched to the transcript column
 * (`max-w-2xl`), fixing v1's far-too-narrow `max-w-xs sm:max-w-md`.
 *
 * SURFACE = v1's CONVERSATION composer (studied first-hand), NOT home's: a
 * jurisdiction picker, real attachments (upload chips + drag-drop, PDF/DOC/DOCX/RTF,
 * 10MB × 10, dedup), pasted-content staging, a plus-menu (Attach + the conversation's
 * STICKY privacy modes shown locked), a redacted pill, the confidential file notice,
 * and a Send/Stop toggle. No workflow selector / confidential toggle / study mode —
 * those are turn-1 create concerns owned by the home composer.
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

export interface ConversationComposerProps {
  conversationId: string;
  jurisdiction: JurisdictionChoice;
  onJurisdictionChange: (next: JurisdictionChoice) => void;
  isConfidential: boolean;
  isRedacted: boolean;
  isStreaming: boolean;
  isCancelling: boolean;
  onSubmit: (message: string, attachments: MessageAttachment[]) => Promise<void>;
  onStop: () => void;
}

export function ConversationComposer({
  conversationId,
  jurisdiction,
  onJurisdictionChange,
  isConfidential,
  isRedacted,
  isStreaming,
  isCancelling,
  onSubmit,
  onStop,
}: ConversationComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draft persistence per conversation — lazy init + persist in the setter (React
  // Compiler-clean, mirrors useComposerDraft).
  const draftKey = `conversation_draft_${conversationId}`;
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
    `conversation_draft_pasted_${conversationId}`,
  );
  const [uploads, setUploads] = useState<FileUploadEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadedFiles = uploads.filter((u) => u.status === 'uploaded');
  const isUploading = uploads.some((u) => u.status === 'uploading');
  const canSend =
    (input.trim().length > 0 || uploadedFiles.length > 0 || pastedItems.length > 0) &&
    !isUploading &&
    !isSubmitting;

  const handleFilesAdded = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    if (error) setError(null);

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

    if (rejectedType) setError('Only PDF, DOC, DOCX, and RTF files are supported.');
    else if (rejectedSize) setError('Each file must be 10MB or less.');
    else if (rejectedCap) setError(`You can attach at most ${MAX_FILES_PER_TURN} files per message.`);
    else if (rejectedDuplicate && accepted.length === 0) setError('That file is already attached.');

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

  const removeUpload = (key: string) => setUploads((prev) => prev.filter((u) => u.key !== key));

  const handleSubmit = async () => {
    if (isStreaming || isSubmitting || isUploading) return;
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
    <div className="mx-auto w-full max-w-2xl px-4 pb-3 pt-2">
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

        {/* Jurisdiction + redacted pill row. */}
        <div className="mb-2 flex items-center gap-2">
          <JurisdictionField
            signedIn
            value={jurisdiction}
            onChange={onJurisdictionChange}
            disabled={isStreaming || isSubmitting}
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

        {isConfidential && uploads.length > 0 && (
          <p className="text-muted-foreground mb-2 text-xs">
            Files in confidential chats are kept for up to 24 hours, then permanently deleted.
            Make a local copy if you need to keep this file.
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive mb-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <PromptInput
          value={input}
          onValueChange={(next) => {
            setInput(next);
            if (error) setError(null);
          }}
          onSubmit={handleSubmit}
          disabled={isStreaming || isSubmitting}
          maxHeight={150}
          variant={isConfidential ? 'confidential' : 'default'}
          className="shadow-lg"
        >
          {/* Attachment chips. */}
          {uploads.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pt-2">
              {uploads.map((u) => (
                <div
                  key={u.key}
                  onClick={stop}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
                    u.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-secondary',
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
              ))}
            </div>
          )}

          {/* Pasted content staging. */}
          {pastedItems.length > 0 && (
            <div className="mx-2 mt-2 flex gap-2 overflow-x-auto pb-1">
              {pastedItems.map((item) => (
                <PastedContentCard
                  key={item.id}
                  content={item.text}
                  onRemove={() => removePasted(item.id)}
                />
              ))}
            </div>
          )}

          <PromptInputTextarea
            placeholder={pastedItems.length > 0 ? 'Add a message…' : 'Ask a follow-up'}
            className="text-foreground placeholder:text-muted-foreground"
            onLargePaste={addPasted}
          />

          <PromptInputActions className="flex items-center gap-2 px-2 pb-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Attach files and privacy options"
                  onClick={stop}
                  disabled={isStreaming || isSubmitting}
                  className="v2-interactive text-primary hover:bg-secondary focus-visible:ring-ring relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-5" />
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
                            Not stored after your session
                          </span>
                        </span>
                      </DropdownMenuCheckboxItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="flex-1" />

            {isStreaming ? (
              <PromptInputAction tooltip={isCancelling ? 'Cancelling' : 'Stop generating'}>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="v2-interactive size-11 shrink-0 rounded-full disabled:opacity-70"
                  onClick={onStop}
                  disabled={isCancelling}
                  aria-label={isCancelling ? 'Cancelling' : 'Stop generating'}
                >
                  {isCancelling ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Square className="size-5" />
                  )}
                </Button>
              </PromptInputAction>
            ) : (
              <PromptInputAction tooltip="Send message">
                <Button
                  type="button"
                  size="icon"
                  className="v2-interactive bg-primary hover:bg-primary/90 size-11 shrink-0 rounded-full"
                  onClick={handleSubmit}
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </Button>
              </PromptInputAction>
            )}
          </PromptInputActions>
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
