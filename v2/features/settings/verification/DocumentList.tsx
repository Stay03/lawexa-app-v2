'use client';

import { useId, useState, type Ref } from 'react';
import {
  CircleAlert,
  ExternalLink,
  File,
  FileImage,
  FileText,
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
import type { LawyerProfileDocument } from '@/lib/api/lawyerVerification';
import type { PresentedRow } from '@/v2/features/bookmarks/list/use-exiting-rows';
import { DOCUMENT_ACCEPT, documentKind, type DocumentKind } from './model';
import type { UploadEntry } from './use-document-uploads';

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

/**
 * How a row arrives and leaves, the presence pattern `BookmarkRow` set: a grid
 * whose one track folds from `1fr` to `0fr` while the row fades, so a removed
 * document closes its gap instead of vanishing between frames. The entrance
 * class is dropped while leaving, because a finished `animate-in` keeps
 * asserting `opacity: 1` and would win over the fade. `motion-reduce` settles
 * both at once; the unmount is committed by the holdover's timer either way.
 */
function presence(exiting: boolean): string {
  return cn(
    'grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none',
    exiting ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
    !exiting &&
      'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:fill-mode-both motion-safe:duration-200',
  );
}

/** The row body: `min-w-0` lets the name truncate inside the grid track, and
 *  the clip is applied only while leaving so a resting row never cuts off its
 *  buttons' focus rings. */
function rowBody(exiting: boolean): string {
  return cn('flex min-h-14 min-w-0 items-center gap-3.5 px-4 py-2.5', exiting && 'overflow-hidden');
}

/**
 * The uploaded documents and the uploads on their way, in one filled block.
 * Stored documents first, in the order the server returned them, then the
 * files still travelling, so a finished upload's document row appears exactly
 * where its progress row was.
 */
export function DocumentList({
  documents,
  uploads,
  editable,
  locked,
  removingIds,
  placesLeft,
  onRemove,
  onCancel,
  onRetry,
  onDismiss,
}: {
  documents: readonly PresentedRow<LawyerProfileDocument>[];
  uploads: readonly PresentedRow<UploadEntry>[];
  editable: boolean;
  /** True while the set is being sent: Remove stays drawn but cannot be
   *  pressed, so nothing disappears under the reader mid-submit. */
  locked: boolean;
  removingIds: ReadonlySet<number>;
  placesLeft: number;
  onRemove: (document: LawyerProfileDocument) => void;
  onCancel: (entry: UploadEntry) => void;
  onRetry: (entry: UploadEntry) => void;
  onDismiss: (entry: UploadEntry) => void;
}) {
  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-secondary">
      {documents.map(({ row, exiting }) => (
        <DocumentRow
          key={`document-${row.id}`}
          document={row}
          exiting={exiting}
          editable={editable}
          locked={locked}
          removing={removingIds.has(row.id)}
          onRemove={onRemove}
        />
      ))}
      {uploads.map(({ row, exiting }) => (
        <UploadRow
          key={`upload-${row.id}`}
          entry={row}
          exiting={exiting}
          canRetry={placesLeft > 0}
          onCancel={onCancel}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      ))}
    </ul>
  );
}

function DocumentRow({
  document,
  exiting,
  editable,
  locked,
  removing,
  onRemove,
}: {
  document: LawyerProfileDocument;
  exiting: boolean;
  editable: boolean;
  locked: boolean;
  removing: boolean;
  onRemove: (document: LawyerProfileDocument) => void;
}) {
  const kind = documentKind(document);
  const Icon = KIND_ICON[kind];
  const name = document.original_name;

  return (
    <li className={presence(exiting)}>
      <div className={cn(rowBody(exiting), removing && 'opacity-60')}>
        <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] leading-snug font-medium text-foreground" title={name}>
            {name}
          </span>
          <span className="truncate text-[13px] leading-snug text-muted-foreground">
            {`${KIND_LABEL[kind]} · ${formatBytes(document.size)}`}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {/* The link is signed and short-lived, so it opens in its own tab
              rather than replacing this page and its upload state. */}
          <Button asChild size="icon" variant="ghost" className="v2-interactive size-9 text-muted-foreground hover:text-foreground">
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
              disabled={removing || exiting || locked}
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
      </div>
    </li>
  );
}

function UploadRow({
  entry,
  exiting,
  canRetry,
  onCancel,
  onRetry,
  onDismiss,
}: {
  entry: UploadEntry;
  exiting: boolean;
  canRetry: boolean;
  onCancel: (entry: UploadEntry) => void;
  onRetry: (entry: UploadEntry) => void;
  onDismiss: (entry: UploadEntry) => void;
}) {
  const settled = entry.status === 'failed' || entry.status === 'rejected';
  const percent =
    entry.total > 0 ? Math.min(100, Math.round((entry.sent / entry.total) * 100)) : 0;

  return (
    <li className={presence(exiting)}>
      <div className={rowBody(exiting)}>
        {settled ? (
          <CircleAlert aria-hidden className="size-5 shrink-0 text-destructive" />
        ) : (
          <Upload aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] leading-snug font-medium text-foreground" title={entry.name}>
              {entry.name}
            </span>
            {entry.status === 'uploading' ? (
              <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{`${percent}%`}</span>
            ) : entry.status === 'finishing' ? (
              <span className="shrink-0 text-[13px] text-muted-foreground">Finishing…</span>
            ) : null}
          </div>
          {settled ? (
            // The reason is announced once, when it appears. The glyph carries
            // the colour; the sentence stays on the foreground so it reads.
            <p role="alert" className="mt-0.5 text-[13px] leading-snug text-foreground/80">
              {entry.message}
            </p>
          ) : (
            <div
              role="progressbar"
              aria-label={`Uploading ${entry.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              // Omitted while the server finishes: unknown, not complete.
              aria-valuenow={entry.status === 'uploading' ? percent : undefined}
              aria-valuetext={
                entry.status === 'finishing' ? 'Finishing' : `${percent}% of ${formatBytes(entry.total)}`
              }
              className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-background"
            >
              {entry.status === 'finishing' ? (
                <div className="h-full w-full rounded-full bg-primary/60 motion-safe:animate-pulse" />
              ) : (
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {entry.retryable ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRetry(entry)}
              disabled={!canRetry}
              className="v2-interactive h-8"
            >
              <RotateCcw aria-hidden className="size-3.5" />
              Retry
            </Button>
          ) : null}
          {entry.cancellable ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onCancel(entry)}
              aria-label={`Cancel upload of ${entry.name}`}
              className="v2-interactive size-9 text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </Button>
          ) : settled ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onDismiss(entry)}
              aria-label={`Dismiss ${entry.name}`}
              className="v2-interactive size-9 text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Where files come in: a dashed zone that is both a drop target and the label
 * of a real file input.
 *
 * The input is visually hidden, NOT `display: none`, so it keeps its place in
 * the tab order and its native keyboard behaviour (Enter or Space opens the
 * system picker). The zone draws the input's focus ring through `peer`, and it
 * is `relative` so the hidden input is positioned inside it rather than against
 * some far-off ancestor that the browser would scroll to on focus.
 *
 * Drag state is set from the drag events themselves, never from an effect.
 * `dragleave` fires when the pointer crosses into a child, so the zone only
 * clears when the pointer leaves for somewhere outside it.
 */
export function DropZone({
  placesLeft,
  disabled,
  onFiles,
  inputRef,
}: {
  placesLeft: number;
  disabled: boolean;
  onFiles: (files: File[]) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [dragging, setDragging] = useState(false);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple={placesLeft > 1}
        accept={DOCUMENT_ACCEPT}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => {
          const picked = event.target.files ? Array.from(event.target.files) : [];
          // Cleared so choosing the same file again still fires a change.
          event.target.value = '';
          if (picked.length > 0) onFiles(picked);
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          if (disabled) return;
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
          if (disabled) return;
          event.preventDefault();
          setDragging(false);
          const dropped = Array.from(event.dataTransfer.files);
          if (dropped.length > 0) onFiles(dropped);
        }}
        className={cn(
          'v2-interactive flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-6 text-center',
          'transition-colors duration-150 motion-reduce:transition-none',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
          dragging
            ? 'border-primary bg-primary/10'
            : 'border-foreground/15 hover:border-foreground/30 hover:bg-foreground/[0.03]',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-10 items-center justify-center rounded-xl transition-colors duration-150 motion-reduce:transition-none',
            dragging ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
          )}
        >
          <Upload className="size-5" />
        </span>
        <span className="text-[15px] leading-snug font-medium text-foreground">
          {dragging ? 'Drop to upload' : placesLeft > 1 ? 'Choose files or drop them here' : 'Choose a file or drop it here'}
        </span>
        <span id={hintId} className="text-[13px] leading-snug text-muted-foreground">
          {`PDF, JPG or PNG, up to 10 MB each · ${placesLeft} more to add`}
        </span>
      </label>
    </div>
  );
}
