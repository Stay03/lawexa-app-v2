'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, ExternalLink, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { isNotFoundError } from '@/lib/utils/api-error';
import type { UserFileDetail } from '@/types/file';
import { useOpenFileInNewTab, useShowFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { fileKind, fileSize } from '@/v2/features/folders/item-row-model';
import { MediaPlayer } from '@/v2/features/files/MediaPlayer';
import { PdfReader } from '@/v2/features/files/pdf/PdfReader';
import { pageCountLabel } from '@/v2/features/files/pdf/pdf-model';
import { filesQueries } from '@/v2/features/files/queries';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { ChatSidePanel } from '../side-panel/ChatSidePanel';
import { chatFileLine, filePanelBody } from './chat-files';
import { FileDocumentPlaceholder } from './FileDocumentPlaceholder';
import { FileMark } from './FileMark';
import { WordPages } from './WordPages';

/**
 * FilePanel — one file in the chat's side panel (`?side=file:ID`), opened
 * from the file list card (the file list in chat, piece a; Stay, 23 October
 * 2026). It uses the side panel's own header: the file's mark, its name and
 * "PDF · 1.2 MB · Ada", then Download, Open in a new tab and the close; below
 * xl it is the sheet. (It was built on the draft panel's slim line, which the
 * draft panel's bar replaced, 9c51e145.)
 *
 * THE FILE IS READ BY ITS ID (`GET /files/{id}`), so a reload or a shared
 * address opens the same file the card did, under the server's own `view`
 * rule. A file the reader may not open, or one that is gone, says so.
 *
 * WHAT IT SHOWS TODAY (`filePanelBody`): a picture, drawn from a link that
 * shows it; a video or a recording in the one player (`MediaPlayer`); a Word
 * or RTF file as readable pages (`WordPages`, piece c); a PDF in the app's
 * one PDF reader (`PdfReader`, piece b), its zoom over the pages and its
 * page count in the header's facts; anything else as `FileDocumentPlaceholder`.
 */
export function FilePanel({ fileId }: { fileId: number }) {
  const detail = useQuery(filesQueries.detail(fileId));
  const file = detail.data?.data ?? null;
  // A PDF's page count, once its reader has opened it: "· 12 pages" in the header's facts line.
  const [pageCount, setPageCount] = useState<number | null>(null);

  if (detail.isPending) {
    return (
      <ChatSidePanel label="File" title="Opening the file…" icon={<PanelMark kind={null} />}>
        <div aria-hidden className="mx-auto w-full max-w-[68ch] space-y-3 px-5 py-6 xl:px-10 xl:pt-7">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        </div>
      </ChatSidePanel>
    );
  }

  if (!file) {
    return (
      <ChatSidePanel label="File" title="File" icon={<PanelMark kind={null} />}>
        {isNotFoundError(detail.error) ? (
          <p className="px-5 py-8 text-sm text-muted-foreground xl:px-10">This file is no longer available.</p>
        ) : (
          <p className="px-5 py-8 text-sm text-muted-foreground xl:px-10">
            This file did not open. It may be in a space you are no longer in.{' '}
            <button
              type="button"
              onClick={() => void detail.refetch()}
              className={cn('v2-interactive rounded font-medium text-foreground underline underline-offset-2', FOCUS_RING)}
            >
              Try again
            </button>
          </p>
        )}
      </ChatSidePanel>
    );
  }

  const kind = fileKind(file.mime_type);
  const facts = chatFileLine({ kind, size: fileSize(file.size), by: file.uploader?.name ?? null });
  const line = pageCount === null ? facts : `${facts} · ${pageCountLabel(pageCount)}`;

  return (
    <ChatSidePanel
      label="File"
      title={file.original_name}
      subtitle={line}
      icon={<PanelMark kind={kind} />}
      actions={<FileActions file={file} />}
    >
      <FileBody file={file} kind={kind} onPageCount={setPageCount} />
    </ChatSidePanel>
  );
}

/** The switch on what the file is: the one place a new kind of page goes in. */
function FileBody({
  file,
  kind,
  onPageCount,
}: {
  file: UserFileDetail;
  kind: string | null;
  onPageCount: (count: number) => void;
}) {
  const body = filePanelBody(file);
  switch (body) {
    case 'picture':
      return (
        <div className="flex justify-center px-5 py-6 xl:px-8 xl:pt-4">
          <PanelPicture file={file} />
        </div>
      );
    case 'video':
    case 'audio':
      return (
        <div className="mx-auto w-full max-w-[68ch] px-5 py-6 xl:px-8 xl:pt-4">
          <MediaPlayer
            file={file}
            kind={body}
            failure={<FileDocumentPlaceholder file={file} kind={kind} />}
            className={body === 'video' ? 'max-h-[70dvh]' : undefined}
          />
        </div>
      );
    case 'word':
      return <WordPages file={file} />;
    case 'pdf':
      return (
        <div className="mx-auto w-full max-w-[68ch] px-5 pt-4 pb-24 xl:px-10 xl:pt-5">
          <PdfReader
            fileId={file.id}
            name={file.original_name}
            onPageCount={onPageCount}
            fallback={(reason, retry) => (
              <FileDocumentPlaceholder file={file} kind={kind} reason={reason} onRetry={retry ?? undefined} />
            )}
          />
        </div>
      );
    case 'other':
      return <FileDocumentPlaceholder file={file} kind={kind} />;
  }
}

/**
 * A picture from a link that shows it (`filesQueries.inlineUrl`). A link
 * that fails to paint is asked for once more, since it can expire while the
 * panel is open; a second failure, or the same link again, gives the
 * placeholder, which opens the file in a tab.
 *
 * `unoptimized`: the bytes are a signed link on the file host, drawn as they
 * are, at the picture's own size up to the panel's width.
 */
function PanelPicture({ file }: { file: UserFileDetail }) {
  const link = useQuery(filesQueries.inlineUrl(file.id));
  const [src, setSrc] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const minted = link.data?.data?.url ?? null;
  if (src === null && minted !== null) setSrc(minted);

  const onError = () => {
    if (retried) {
      setFailed(true);
      return;
    }
    setRetried(true);
    void link.refetch().then((result) => {
      const fresh = result.data?.data?.url ?? null;
      if (fresh === null || fresh === src) {
        setFailed(true);
        return;
      }
      setSrc(fresh);
    });
  };

  if (failed || link.isError) return <FileDocumentPlaceholder file={file} kind={fileKind(file.mime_type)} />;
  return (
    <div className={cn('relative w-full', !painted && 'min-h-64')}>
      {!painted ? <Skeleton aria-hidden className="absolute inset-0 rounded-xl" /> : null}
      {src === null ? (
        <div aria-hidden className="aspect-[4/3] w-full" />
      ) : (
        <Image
          key={src}
          src={src}
          alt={file.original_name}
          width={1600}
          height={1200}
          unoptimized
          draggable={false}
          onLoad={() => setPainted(true)}
          onError={onError}
          className={cn(
            'mx-auto h-auto max-h-[75dvh] w-auto max-w-full rounded-xl object-contain transition-opacity duration-200 motion-reduce:transition-none',
            painted ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}

/** Download and Open in a new tab, in the panel's header beside the close. */
function FileActions({ file }: { file: UserFileDetail }) {
  const download = useOpenFileInNewTab();
  const show = useShowFileInNewTab();
  return (
    <>
      <HeaderButton
        label={download.ready ? `Save ${file.original_name}` : `Download ${file.original_name}`}
        busy={download.opening}
        failed={download.failed}
        onClick={() =>
          download.ready ? download.save() : download.open(file.id, { name: file.original_name, type: file.mime_type })
        }
      >
        <Download aria-hidden className="size-4" />
      </HeaderButton>
      <HeaderButton
        label={`Open ${file.original_name} in a new tab`}
        busy={show.opening}
        failed={show.failed}
        onClick={() => show.open(file.id)}
      >
        <ExternalLink aria-hidden className="size-4" />
      </HeaderButton>
    </>
  );
}

/**
 * A header control drawn like the panel's close button, on both shapes. A
 * press that failed shows the alert mark and says so in its name, so the
 * failure is seen where it was pressed; the next press tries again.
 */
function HeaderButton({
  label,
  busy,
  failed,
  onClick,
  children,
}: {
  label: string;
  busy: boolean;
  failed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const name = failed ? `Couldn't open it. ${label}, try again` : label;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={name}
      title={name}
      className={cn(
        'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-progress',
        'xl:size-7.5 xl:rounded-lg xl:text-foreground/62 xl:hover:bg-foreground/6 dark:xl:hover:bg-white/7',
        FOCUS_RING,
      )}
    >
      {busy ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : failed ? (
        <AlertCircle aria-hidden className="size-4 text-destructive" />
      ) : (
        children
      )}
    </button>
  );
}

/** The file's mark: a tile on the phone sheet, a small glyph in the computer's header (the draft's rule). */
function PanelMark({ kind }: { kind: string | null }) {
  return (
    <FileMark
      kind={kind}
      className="xl:size-auto xl:rounded-none xl:bg-transparent"
      iconClassName="xl:size-3.5"
    />
  );
}
