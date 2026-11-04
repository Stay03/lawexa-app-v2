'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils/format-bytes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUploadTemplates } from '@/lib/hooks/useAdminTemplates';
import type { AdminTemplateUploadResult } from '@/types/admin-templates';
import { precheckUpload, refusalSentence, TEMPLATE_ACCEPT, TEMPLATE_UPLOAD, type TemplateRefusal } from './template-model';

/**
 * Upload several files at once (Arthur loads his library in batches): pick
 * or drop Word, RTF and PDF files, see which go and which are held back and
 * why, then upload. Each file becomes a draft while Lawexa reads it, and the
 * answer says which the server turned down (a type, the size, or a file
 * already uploaded).
 */
export function TemplateUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<AdminTemplateUploadResult | null>(null);
  const upload = useUploadTemplates();
  const { send, refused } = precheckUpload(picked);

  const add = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    setPicked((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [...current, ...incoming.filter((file) => !seen.has(`${file.name}:${file.size}`))];
    });
    setResult(null);
  };

  const close = (next: boolean) => {
    if (!next && upload.isPending) return;
    onOpenChange(next);
    if (!next) {
      setPicked([]);
      setResult(null);
      upload.reset();
    }
  };

  const submit = () => {
    if (send.length === 0) return;
    upload.mutate(send, {
      onSuccess: (answer) => {
        setResult(answer.data ?? { created: [], refused: [] });
        setPicked([]);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload templates</DialogTitle>
          <DialogDescription>
            Word, RTF or PDF, up to {TEMPLATE_UPLOAD.maxFiles} files at a time and 20 MB each. Each one becomes a draft while Lawexa
            blanks out names, dates and amounts and suggests its labels.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              {result.created.length === 1 ? '1 file uploaded.' : `${result.created.length} files uploaded.`}{' '}
              {result.created.length > 0 ? 'Lawexa is reading them now; each shows as a draft when it is ready to review.' : null}
            </p>
            {result.refused.length > 0 ? (
              <RefusedList items={result.refused.map((item) => ({ name: item.original_name, reason: item.reason }))} title="Not uploaded" />
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                add(event.dataTransfer.files);
              }}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50',
                dragging && 'border-primary bg-muted/50',
              )}
            >
              <Upload aria-hidden className="size-5" />
              <span>Drop files here, or click to choose</span>
            </button>
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
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={upload.isPending}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={send.length === 0 || upload.isPending} className="gap-1.5">
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

function RefusedList({ items, title }: { items: readonly { name: string; reason: TemplateRefusal }[]; title: string }) {
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
