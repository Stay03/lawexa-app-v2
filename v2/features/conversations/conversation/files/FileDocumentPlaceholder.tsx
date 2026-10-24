'use client';

import { Download, ExternalLink, Loader2, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useOpenFileInNewTab, useShowFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { FileMark } from './FileMark';

/**
 * FileDocumentPlaceholder — what the chat's side panel shows for a PDF, a Word
 * file or any other document TODAY: the file's mark, its name, and Download
 * and Open in a new tab.
 *
 * THE ONE SWAP POINT FOR DOCUMENT PAGES. The Word pages (piece c,
 * `WordPages`) took `word` from it in `FilePanel`'s one switch on
 * `filePanelBody`; the PDF reader (piece b) takes `pdf` the same way.
 *
 * It is also where a document that could not show lands: Word pages that
 * failed pass their `reason`, and `onRetry` when asking again can help, so
 * Download stays the way out.
 */
export function FileDocumentPlaceholder({
  file,
  kind,
  reason,
  onRetry,
}: {
  file: { id: number; original_name: string; mime_type: string };
  /** "PDF", "Word", ... for the mark; `null` when unknown. */
  kind: string | null;
  /** Why the file is not shown here, in place of the default sentence. */
  reason?: string;
  /** Ask again, for a failure that may pass. */
  onRetry?: () => void;
}) {
  const download = useOpenFileInNewTab();
  const show = useShowFileInNewTab();
  const saveAs = { name: file.original_name, type: file.mime_type };
  const gone = download.gone || show.gone;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 py-12 text-center xl:py-16">
      <FileMark kind={kind} className="size-14 rounded-2xl" iconClassName="size-6" />
      <div className="min-w-0 space-y-1">
        <p className="text-[15px] leading-snug font-semibold break-words text-foreground">{file.original_name}</p>
        <p className="text-sm text-muted-foreground">
          {gone
            ? 'This file is no longer available.'
            : (reason ?? 'Open it in a new tab, or download it.')}
        </p>
      </div>
      {gone ? null : (
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry} className="rounded-full">
              <RotateCw aria-hidden className="size-4" />
              Try again
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => show.open(file.id)}
            disabled={show.opening}
            className="rounded-full disabled:cursor-progress"
          >
            {show.opening ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ExternalLink aria-hidden className="size-4" />}
            Open in a new tab
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => (download.ready ? download.save() : download.open(file.id, saveAs))}
            disabled={download.opening}
            className="rounded-full disabled:cursor-progress"
          >
            {download.opening ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
            {download.ready ? 'Save' : 'Download'}
          </Button>
        </div>
      )}
      {(show.failed || download.failed) && !gone ? (
        <p role="status" className="text-xs text-muted-foreground">
          Couldn&rsquo;t open it. Try again.
        </p>
      ) : null}
    </div>
  );
}
