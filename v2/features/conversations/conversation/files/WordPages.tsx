'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { htmlToPlainText } from '@/lib/notes/plain-text';
import { extractApiError } from '@/lib/utils/api-error';
import { filesQueries } from '@/v2/features/files/queries';
import { NoteContent } from '@/v2/features/notes/reader/NoteContent';
import '../draft/draft-panel.css';
import { wordPagesFailure } from './chat-files';
import { FileDocumentPlaceholder } from './FileDocumentPlaceholder';

/**
 * WordPages — a Word or RTF file as a readable document in the chat's side
 * panel (the file list in chat, piece c; Stay, 23 October 2026: "Into
 * readable pages"). It takes `word` from `FileDocumentPlaceholder` in
 * `FilePanel`'s one switch.
 *
 * THE PAGES ARE THE SERVER'S (`GET /files/{id}/preview`, lawexa-api
 * f98f9d0c): a .docx or .rtf turned into HTML by pandoc on the call, a legacy
 * .doc as paragraphs of its extracted text, kept a day per file version.
 * Headings, lists, tables, bold and italics come through; page layout,
 * headers, footers and pictures do not. The call converts while it waits (up
 * to 30 s on a first open), so the wait says what is happening.
 *
 * THE HTML IS SANITISED HERE AS WELL. The server cleans it with its
 * NoteHtmlSanitizer, and the panel still renders it through `NoteContent`:
 * `parseNoteHtml` (lib/notes/note-html.ts) parses it in an inert document,
 * keeps an allowlist of tags and a handful of checked attributes, and returns
 * a node tree React builds elements from. No HTML string reaches the page.
 *
 * THE DOCUMENT LOOK IS THE DRAFT PANEL'S (take B): no frame, the document
 * measure, the draft's type on a computer (`.v2-draft-doc`), light and dark
 * from the app's prose colours. Download and Open in a new tab stay on the
 * slim line (FilePanel), and every failure keeps them in the body too.
 */

/** The draft panel's document column, without the room its floating bar takes. */
const DOCUMENT = 'mx-auto w-full max-w-[68ch] px-5 py-6 xl:px-10 xl:pt-7 xl:pb-30 xl:text-[15px]';

export function WordPages({ file }: { file: { id: number; original_name: string; mime_type: string } }) {
  const preview = useQuery(filesQueries.preview(file.id));
  const html = preview.data?.data?.html ?? null;
  const empty = useMemo(() => (html === null ? false : htmlToPlainText(html).trim() === ''), [html]);

  if (preview.isPending) {
    return (
      <div className={cn(DOCUMENT, 'flex flex-col gap-3')}>
        <p role="status" className="text-sm text-muted-foreground">
          Turning the file into pages…
        </p>
        <div aria-hidden className="flex flex-col gap-3 pt-2">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (preview.isError || html === null) {
    const error = extractApiError(preview.error);
    const failure = wordPagesFailure(error.status, error.status === 0 ? null : error.message);
    return (
      <FileDocumentPlaceholder
        file={file}
        kind="Word"
        reason={failure.message}
        onRetry={failure.retry ? () => void preview.refetch() : undefined}
      />
    );
  }

  if (empty) {
    return (
      <FileDocumentPlaceholder
        file={file}
        kind="Word"
        reason="This file has no text to show here. Download it to see it as it is."
      />
    );
  }

  return (
    <article
      aria-label={file.original_name}
      className={cn(DOCUMENT, 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300')}
    >
      <div className="v2-draft-doc prose prose-neutral max-w-none dark:prose-invert [&_.v2-note-table]:overflow-x-auto">
        <NoteContent html={html} />
      </div>
    </article>
  );
}
