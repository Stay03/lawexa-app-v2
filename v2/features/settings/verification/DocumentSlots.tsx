'use client';

import { useId, useState, type Ref } from 'react';
import {
  Award,
  CircleAlert,
  ExternalLink,
  File,
  FileBadge,
  FileImage,
  FileText,
  FileUser,
  IdCard,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { LawyerDocumentType, LawyerProfileDocument } from '@/lib/api/lawyerVerification';
import type { PresentedRow } from '@/v2/features/bookmarks/list/use-exiting-rows';
import { DOCUMENT_ACCEPT, documentKind, type DocumentKind, type DocumentSlot } from './model';
import type { UploadEntry } from './use-document-uploads';

const SLOT_ICON: Record<LawyerDocumentType, LucideIcon> = {
  id: IdCard,
  certificate: Award,
  license: FileBadge,
  cv: FileUser,
};

const KIND_ICON: Record<DocumentKind, LucideIcon> = {
  pdf: FileText,
  image: FileImage,
  other: File,
};

const KIND_LABEL: Record<DocumentKind, string> = {
  pdf: 'PDF',
  image: 'Image',
  other: 'File',
};

const ROW = 'flex min-h-14 min-w-0 items-center gap-3.5 px-4 py-2.5';
const ROW_LABEL = 'truncate text-[13px] leading-snug font-medium text-muted-foreground';
const ROW_VALUE = 'truncate text-[15px] leading-snug font-medium text-foreground';
const ICON_BUTTON = 'v2-interactive size-9 text-muted-foreground hover:text-foreground';

/**
 * How a slot's content arrives when it changes (empty → uploading → stored,
 * or back to empty on removal). The slot keeps its height through every
 * change, so the new content fades in IN PLACE over the old one's spot and
 * nothing below it moves. `motion-safe` only.
 */
const SWAP = 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200';

function documentMeta(document: LawyerProfileDocument): string {
  return `${KIND_LABEL[documentKind(document)]} · ${formatBytes(document.size)}`;
}

/** Open and Remove for a stored file, shared by the slots and Other documents. */
function DocumentActions({
  document,
  editable,
  disabled,
  removing,
  onRemove,
}: {
  document: LawyerProfileDocument;
  editable: boolean;
  disabled: boolean;
  removing: boolean;
  onRemove: (document: LawyerProfileDocument) => void;
}) {
  const name = document.original_name;
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {/* The link is signed and short-lived, so it opens in its own tab rather
          than replacing this page and its upload state. */}
      <Button asChild size="icon" variant="ghost" className={ICON_BUTTON}>
        <a href={document.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${name}`}>
          <ExternalLink aria-hidden className="size-4" />
        </a>
      </Button>
      {editable ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => onRemove(document)}
          disabled={removing || disabled}
          aria-label={`Remove ${name}`}
          aria-busy={removing || undefined}
          className="v2-interactive size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          {removing ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Trash2 aria-hidden className="size-4" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * ONE NAMED SLOT: Means of ID, Call to Bar certificate, Practising licence or
 * CV or résumé. It is in exactly one of four states, each the same height:
 *
 *  - stored    the slot's name over the file's name, with Open and Remove;
 *  - uploading the slot's name and the percentage over the file's name, with
 *              a thin bar along the row's foot and Cancel (none once every
 *              byte is sent, see `use-document-uploads.ts`);
 *  - failed    the reason in place of the file's name, with Retry when trying
 *              again could work and Dismiss always;
 *  - empty     the slot's name and what it wants, and the whole row is the
 *              label of a real file input and a drop target.
 *
 * The file input is visually hidden, NOT `display: none`, so it keeps its tab
 * stop and native keyboard behaviour (Enter or Space opens the picker). The
 * row draws the input's focus ring through `peer`, inset because the block
 * clips to its rounded corners. The `li` is `relative` so the hidden input is
 * positioned inside it, not against an ancestor the browser would scroll to.
 *
 * Drag state is set by the drag events themselves, never by an effect, and
 * clears only when the pointer leaves for somewhere outside the row.
 */
export function SlotRow({
  slot,
  document,
  upload,
  editable,
  locked,
  removing,
  inputRef,
  onFile,
  onRemove,
  onCancel,
  onRetry,
  onDismiss,
}: {
  slot: DocumentSlot;
  document: LawyerProfileDocument | null;
  upload: UploadEntry | undefined;
  editable: boolean;
  /** True while the set is being sent: controls stay drawn, unpressable. */
  locked: boolean;
  removing: boolean;
  inputRef: Ref<HTMLInputElement>;
  onFile: (type: LawyerDocumentType, file: File) => void;
  onRemove: (document: LawyerProfileDocument) => void;
  onCancel: (type: LawyerDocumentType) => void;
  onRetry: (type: LawyerDocumentType) => void;
  onDismiss: (type: LawyerDocumentType) => void;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const SlotIcon = SLOT_ICON[slot.type];

  // The stored file wins over a stale upload entry: once the server holds a
  // file for this type, that is what the slot is.
  const mode = document ? 'stored' : upload ? upload.status : 'empty';
  const settled = mode === 'failed' || mode === 'rejected';
  const percent =
    upload && upload.total > 0 ? Math.min(100, Math.round((upload.sent / upload.total) * 100)) : 0;

  if (document) {
    return (
      <li>
        <div className={cn(ROW, SWAP, removing && 'opacity-60')}>
          <SlotIcon aria-hidden className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={ROW_LABEL}>{`${slot.label} · ${documentMeta(document)}`}</span>
            <span className={ROW_VALUE} title={document.original_name}>
              {document.original_name}
            </span>
          </span>
          <DocumentActions
            document={document}
            editable={editable}
            disabled={locked}
            removing={removing}
            onRemove={onRemove}
          />
        </div>
      </li>
    );
  }

  if (upload) {
    return (
      <li className="relative">
        {/* Keyed by settled-or-not, so a failure fades in over the progress
            but the step from uploading to finishing does not replay. */}
        <div key={settled ? 'settled' : 'active'} className={cn(ROW, SWAP)}>
          {settled ? (
            <CircleAlert aria-hidden className="size-5 shrink-0 text-destructive" />
          ) : (
            <SlotIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={ROW_LABEL}>
              {mode === 'uploading'
                ? `${slot.label} · ${percent}%`
                : mode === 'finishing'
                  ? `${slot.label} · Finishing…`
                  : slot.label}
            </span>
            {settled ? (
              // Announced once, when it appears. The glyph carries the colour;
              // the sentence stays on the foreground so it reads.
              <span role="alert" className="text-[13px] leading-snug text-foreground/85">
                {upload.message}
              </span>
            ) : (
              <span className={ROW_VALUE} title={upload.name}>
                {upload.name}
              </span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {upload.retryable ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRetry(slot.type)}
                className="v2-interactive h-8"
              >
                <RotateCcw aria-hidden className="size-3.5" />
                Retry
              </Button>
            ) : null}
            {upload.cancellable ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onCancel(slot.type)}
                aria-label={`Cancel upload of ${upload.name}`}
                className={ICON_BUTTON}
              >
                <X aria-hidden className="size-4" />
              </Button>
            ) : settled ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onDismiss(slot.type)}
                aria-label={`Dismiss the problem with ${upload.name}`}
                className={ICON_BUTTON}
              >
                <X aria-hidden className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
        {settled ? null : (
          <div
            role="progressbar"
            aria-label={`Uploading ${upload.name} as ${slot.label}`}
            aria-valuemin={0}
            aria-valuemax={100}
            // Omitted while the server finishes: unknown, not complete.
            aria-valuenow={mode === 'uploading' ? percent : undefined}
            aria-valuetext={mode === 'finishing' ? 'Finishing' : `${percent}% of ${formatBytes(upload.total)}`}
            className="absolute inset-x-4 bottom-1 h-0.5 overflow-hidden rounded-full bg-background"
          >
            {mode === 'finishing' ? (
              <div className="h-full w-full rounded-full bg-primary/60 motion-safe:animate-pulse" />
            ) : (
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="relative">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={DOCUMENT_ACCEPT}
        disabled={!editable || locked}
        onChange={(event) => {
          const picked = event.target.files?.[0];
          // Cleared so choosing the same file again still fires a change.
          event.target.value = '';
          if (picked) onFile(slot.type, picked);
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          if (!editable || locked) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          if (!editable || locked) return;
          event.preventDefault();
          setDragging(false);
          // One slot, one file: the first of a multi-file drop is taken.
          const dropped = event.dataTransfer.files[0];
          if (dropped) onFile(slot.type, dropped);
        }}
        className={cn(
          ROW,
          SWAP,
          'v2-interactive cursor-pointer transition-colors duration-150 motion-reduce:transition-none',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-inset',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
          dragging ? 'bg-primary/10' : 'hover:bg-foreground/[0.04]',
        )}
      >
        <SlotIcon
          aria-hidden
          className={cn(
            'size-5 shrink-0 transition-colors duration-150 motion-reduce:transition-none',
            dragging ? 'text-primary' : 'text-muted-foreground',
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={ROW_VALUE}>{slot.label}</span>
          <span className="truncate text-[13px] leading-snug text-muted-foreground">
            {dragging ? 'Drop to upload' : slot.detail}
          </span>
        </span>
        {/* Drawn like a button; it is the label's own text, so the input's
            accessible name is "<slot> Upload". */}
        <span
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium',
            'border-border bg-background text-foreground',
          )}
        >
          <Upload aria-hidden className="size-3.5" />
          Upload
        </span>
      </label>
    </li>
  );
}

/**
 * A row under Other documents: a stored file with no slot (sent before files
 * had a type, or a second file of a type). It folds in and out with the
 * presence holdover, the `BookmarkRow` pattern: the grid track goes from `1fr`
 * to `0fr` while the row fades, the entrance class is dropped while leaving
 * (a finished `animate-in` keeps asserting `opacity: 1`), and the clip is on
 * only while leaving so a resting row never cuts off its focus rings.
 */
export function OtherDocumentRow({
  presented: { row: document, exiting },
  editable,
  locked,
  removing,
  onRemove,
}: {
  presented: PresentedRow<LawyerProfileDocument>;
  editable: boolean;
  locked: boolean;
  removing: boolean;
  onRemove: (document: LawyerProfileDocument) => void;
}) {
  const Icon = KIND_ICON[documentKind(document)];
  return (
    <li
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none',
        exiting ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        !exiting &&
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:fill-mode-both motion-safe:duration-200',
      )}
    >
      <div className={cn(ROW, exiting && 'overflow-hidden', removing && 'opacity-60')}>
        <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={ROW_VALUE} title={document.original_name}>
            {document.original_name}
          </span>
          <span className="truncate text-[13px] leading-snug text-muted-foreground">
            {documentMeta(document)}
          </span>
        </span>
        <DocumentActions
          document={document}
          editable={editable}
          disabled={locked || exiting}
          removing={removing}
          onRemove={onRemove}
        />
      </div>
    </li>
  );
}
