'use client';

import { useRef, useState } from 'react';
import { FileText, FolderOpen, FolderUp, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import { extractApiError } from '@/lib/utils/api-error';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUploadTemplateFolder, useUploadTemplates } from '@/lib/hooks/useAdminTemplates';
import { droppedEntries, dropName, filesOfEntries, filesOfPickedFolder } from './folder-files';
import {
  batchesFor,
  folderAreas,
  foldersLabel,
  precheckUpload,
  refusalSentence,
  sortFolderFiles,
  TEMPLATE_ACCEPT,
  TEMPLATE_UPLOAD,
  type BatchProgress,
  type FolderFile,
  type TemplateRefusal,
  type UploadBatch,
} from './template-model';

type Refused = { name: string; reason: TemplateRefusal };

/** A folder the admin picked or dropped, sorted (`sortFolderFiles`). */
interface FolderPick {
  name: string;
  take: FolderFile[];
  skipped: number;
  tooBig: Refused[];
  folders: number;
}

const NOTHING_YET = { created: 0, refused: [] as Refused[] };

const fileCount = (batches: readonly UploadBatch<File>[]) => batches.reduce((sum, batch) => sum + batch.files.length, 0);

/** "Leases, Property and Corporate", "Leases, Property, Corporate and 4 more". */
function areasLine(areas: readonly string[]): string {
  if (areas.length <= 3) return areas.length > 1 ? `${areas.slice(0, -1).join(', ')} and ${areas[areas.length - 1]}` : areas.join('');
  return `${areas.slice(0, 3).join(', ')} and ${areas.length - 3} more`;
}

/**
 * Upload templates (Arthur loads his library, over 300 files in folders with
 * subfolders): pick or drop up to 20 Word, RTF and PDF files, or a whole
 * folder. A folder's files, all the way down its subfolders, go 20 to a
 * request, one after another, with one progress line; other files in it are
 * skipped and counted. Each file becomes a draft while Lawexa reads it, and
 * the answer says which the server turned down (a type, the size, or a file
 * already uploaded).
 */
export function TemplateUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [folder, setFolder] = useState<FolderPick | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [stopped, setStopped] = useState<{ remaining: UploadBatch<File>[]; message: string } | null>(null);
  /** Each folder's name as its files' practice area (Arthur's yes, 4 November 2026); on unless turned off. */
  const [byFolder, setByFolder] = useState(true);
  /** What runs before a stop uploaded, added to the run that finishes the folder. */
  const [earlier, setEarlier] = useState(NOTHING_YET);
  const [result, setResult] = useState<{ created: number; refused: Refused[] } | null>(null);
  const upload = useUploadTemplates();
  const folderUpload = useUploadTemplateFolder();
  const { send, refused } = precheckUpload(picked);
  const busy = upload.isPending || folderUpload.isPending || reading;

  const add = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    setPicked((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [...current, ...incoming.filter((file) => !seen.has(`${file.name}:${file.size}`))];
    });
    setResult(null);
  };

  const openFolder = (name: string, found: FolderFile[]) => {
    setFolder({ name, ...sortFolderFiles(found) });
    setByFolder(true);
    setPicked([]);
    setResult(null);
    setProgress(null);
    setStopped(null);
    setEarlier(NOTHING_YET);
  };

  const readDropped = async (entries: FileSystemEntry[]) => {
    setReading(true);
    try {
      openFolder(dropName(entries), await filesOfEntries(entries));
    } catch {
      toast.error('The folder could not be read. Try "Choose a folder" instead.');
    } finally {
      setReading(false);
    }
  };

  const close = (next: boolean) => {
    if (!next && busy) return;
    onOpenChange(next);
    if (!next) {
      setPicked([]);
      setFolder(null);
      setProgress(null);
      setStopped(null);
      setEarlier(NOTHING_YET);
      setResult(null);
      upload.reset();
      folderUpload.reset();
    }
  };

  const submit = () => {
    if (send.length === 0) return;
    upload.mutate(send, {
      onSuccess: (answer) => {
        const data = answer.data ?? { created: [], refused: [] };
        setResult({ created: data.created.length, refused: data.refused.map((item) => ({ name: item.original_name, reason: item.reason })) });
        setPicked([]);
      },
    });
  };

  const sendFolder = (batches: UploadBatch<File>[]) => {
    if (batches.length === 0) return;
    setStopped(null);
    setProgress({ total: fileCount(batches), sent: 0, created: 0, refused: [] });
    folderUpload.mutate(
      { batches, onProgress: setProgress },
      {
        onSuccess: (outcome) => {
          const sofar = { created: earlier.created + outcome.created, refused: [...earlier.refused, ...outcome.refused] };
          if (outcome.stoppedAt === null) {
            setResult(sofar);
            setFolder(null);
            setProgress(null);
            setEarlier(NOTHING_YET);
            return;
          }
          setEarlier(sofar);
          setStopped({
            remaining: batches.slice(outcome.stoppedAt),
            message: (extractApiError(outcome.error).message || 'the connection dropped').replace(/\.$/, ''),
          });
        },
      },
    );
  };

  const areas = folder ? folderAreas(folder.take) : [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload templates</DialogTitle>
          <DialogDescription>
            Word, RTF or PDF, 20 MB each. Choose up to {TEMPLATE_UPLOAD.maxFiles} files, or a whole folder: every file in it and its
            subfolders goes, {TEMPLATE_UPLOAD.maxFiles} at a time. Each one becomes a draft while Lawexa blanks out names, dates and
            amounts and suggests its labels.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              {result.created === 1 ? '1 file uploaded.' : `${result.created} files uploaded.`}{' '}
              {result.created > 0 ? 'Lawexa is reading them now; each shows as a draft when it is ready to review.' : null}
            </p>
            {result.refused.length > 0 ? <RefusedList items={result.refused} title="Not uploaded" /> : null}
          </div>
        ) : folder ? (
          <div className="space-y-3">
            <div className="space-y-3 rounded-lg border px-4 py-3 text-sm">
              <div className="flex items-start gap-3">
                <FolderOpen aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{folder.name}</p>
                  <p className="text-muted-foreground">
                    {folder.take.length === 1 ? '1 file' : `${folder.take.length} files`} to upload, in {foldersLabel(folder.folders)}.
                    {folder.skipped > 0
                      ? ` ${folder.skipped === 1 ? '1 other file is' : `${folder.skipped} other files are`} skipped (not a Word, RTF or PDF document).`
                      : null}
                  </p>
                </div>
                {!busy && !progress ? (
                  <button
                    type="button"
                    aria-label="Choose another folder"
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setFolder(null)}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              {areas.length > 0 ? (
                <div className="flex items-start gap-3 border-t pt-3">
                  <Switch
                    id="template-folder-areas"
                    checked={byFolder}
                    onCheckedChange={setByFolder}
                    disabled={busy || progress !== null}
                    className="mt-0.5"
                  />
                  <label htmlFor="template-folder-areas" className="min-w-0 flex-1 cursor-pointer">
                    <span className="block font-medium">Use each folder&rsquo;s name as the practice area</span>
                    <span className="block text-muted-foreground">
                      {areasLine(areas)}. A name that is not one of Lawexa&rsquo;s practice areas is left out, and Lawexa works the
                      practice area out from the document, as it does for files in {folder.name} itself.
                    </span>
                  </label>
                </div>
              ) : null}
              {progress ? <UploadProgress progress={progress} running={folderUpload.isPending} /> : null}
              {stopped ? (
                <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                  The upload stopped: {stopped.message}. The files sent before it are uploaded; {fileCount(stopped.remaining)} are left.
                </p>
              ) : null}
            </div>
            {folder.tooBig.length > 0 ? <RefusedList items={folder.tooBig} title="Held back" /> : null}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              disabled={reading}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const entries = droppedEntries(event.dataTransfer.items);
                if (entries) void readDropped(entries);
                else add(event.dataTransfer.files);
              }}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50',
                dragging && 'border-primary bg-muted/50',
              )}
            >
              {reading ? (
                <>
                  <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
                  <span>Reading the folder</span>
                </>
              ) : (
                <>
                  <Upload aria-hidden className="size-5" />
                  <span>Drop files or a folder here, or click to choose files</span>
                </>
              )}
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              disabled={reading}
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp aria-hidden className="size-4" />
              Choose a folder
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={TEMPLATE_ACCEPT}
              className="hidden"
              onChange={(event) => {
                add(event.target.files);
                event.target.value = '';
              }}
            />
            <input
              ref={(element) => {
                folderInputRef.current = element;
                // The folder picker: React has no prop for it.
                element?.setAttribute('webkitdirectory', '');
              }}
              type="file"
              className="hidden"
              onChange={(event) => {
                const files = event.target.files;
                if (files && files.length > 0) {
                  const found = filesOfPickedFolder(files);
                  openFolder(found[0].path.split('/')[0] || 'Folder', found);
                }
                event.target.value = '';
              }}
            />

            {send.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {send.map((file) => (
                  <li key={`${file.name}:${file.size}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm odd:bg-muted/40">
                    <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setPicked((current) => current.filter((item) => item !== file))}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {refused.length > 0 ? <RefusedList items={refused} title="Held back" /> : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={() => setResult(null)}>
                Upload more
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </>
          ) : folder ? (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={() => sendFolder(stopped ? stopped.remaining : batchesFor(folder.take, byFolder && areas.length > 0))}
                disabled={busy || folder.take.length === 0}
                className="gap-1.5"
              >
                {folderUpload.isPending ? (
                  <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Upload aria-hidden className="size-4" />
                )}
                {folderUpload.isPending
                  ? 'Uploading'
                  : stopped
                    ? `Upload the remaining ${fileCount(stopped.remaining)}`
                    : folder.take.length > 1
                      ? `Upload ${folder.take.length} files`
                      : 'Upload'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={send.length === 0 || busy} className="gap-1.5">
                {upload.isPending ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden className="size-4" />}
                {send.length > 1 ? `Upload ${send.length} files` : 'Upload'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "120 of 312 sent", with a bar; the files the server turned down so far are counted. */
function UploadProgress({ progress, running }: { progress: BatchProgress; running: boolean }) {
  const share = progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.sent}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${share}%` }}
        />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {running ? 'Uploading: ' : null}
        {progress.sent} of {progress.total} sent
        {progress.refused.length > 0 ? `, ${progress.refused.length} not uploaded` : null}
      </p>
    </div>
  );
}

function RefusedList({ items, title }: { items: readonly Refused[]; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="max-h-36 space-y-1 overflow-y-auto">
        {items.map((item, index) => (
          <li key={`${item.name}:${index}`} className="rounded-md bg-muted/40 px-2 py-1.5 text-sm">
            <span className="block truncate">{item.name}</span>
            <span className="text-xs text-muted-foreground">{refusalSentence(item.reason)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
