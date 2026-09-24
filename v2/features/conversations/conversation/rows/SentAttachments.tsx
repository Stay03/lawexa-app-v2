'use client';

import { useCallback, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { FileText, ImageOff } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { filesApi } from '@/lib/api/files';
import { cn } from '@/lib/utils';
import { isNotFoundError } from '@/lib/utils/api-error';
import { formatFileSize } from '@/lib/validations/admin-cases';
import type { MessageAttachment } from '@/types/chat';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { PictureViewer } from '@/v2/features/channels/feed/MessageImageViewer';
import {
  formatImageTarget,
  parseImageTarget,
  type ImageSet,
} from '@/v2/features/channels/feed/image-target';
import { useOpenFileInNewTab } from '@/v2/features/channels/feed/use-file-url';
import { useHeldValue } from '@/v2/features/channels/use-held-value';
import { isPictureAttachment } from '../../attachment-rules';

/**
 * SentAttachments — the files under a message the person sent to the AI.
 *
 * The owner, 24 September 2026, said yes to "picture previews and
 * tap-to-open". Until then every file was the same flat chip, a picture
 * included, and nothing opened: a person could not look again at what they
 * had sent.
 *
 * ── A PICTURE IS SHOWN, A DOCUMENT IS NAMED ────────────────────────────────
 * The split the channel feed already makes. A picture opens in the channel's
 * own viewer ({@link PictureViewer}), over the conversation; a document opens
 * in a new tab, because a tab is where a PDF belongs.
 *
 * ── THE CHAT PAYLOAD CARRIES NO LINK ───────────────────────────────────────
 * A message names its files by id. The link comes from
 * `GET /files/{id}/download` (backend, 24 September 2026: signed, short-lived,
 * gated on the `download` policy). A thumbnail asks for it only when its
 * message comes near the screen, so opening a long conversation does not
 * fire one request per picture it ever held. The answer is cached for less
 * than the link's life, and a thumbnail whose link died asks once more.
 *
 * ── A FILE CAN BE GONE ─────────────────────────────────────────────────────
 * A confidential chat's files are deleted after 24 hours and the download
 * then answers 404. The thread still names the file, so the tile or chip says
 * "No longer available" and stops offering to open it.
 *
 * ── A SCANNED PDF SHOWS AS ITS PAGES ───────────────────────────────────────
 * The server turns a scan with no text into page pictures and records ONLY
 * the pages on the message (`rendered_from_file_id` names the PDF, but the PDF
 * itself is not listed; measured on this account's own scan, 24 September
 * 2026). The pages are what the AI was sent, each named "scan.pdf (page 1)",
 * so they show as pictures. Naming the PDF instead would mean guessing its
 * name from theirs.
 *
 * ── SEVERAL PICTURES SHARE ONE ROW ─────────────────────────────────────────
 * One picture gets a wide tile. Several get square tiles in a strip that
 * scrolls sideways, so a twenty-page scan costs the height of one tile, the
 * channel feed's own answer to the same problem.
 */

/** The link is signed for an hour; a cached one is replaced well before. */
const LINK_FRESH_MS = 45 * 60 * 1000;

/** Every picture of one message is one set, so the viewer needs no real id. */
const SET_ID = 'sent';

function fileLinkQuery(fileId: number, enabled: boolean) {
  return {
    queryKey: ['v2', 'file-link', fileId] as const,
    queryFn: async () => {
      const response = await filesApi.getDownloadUrl(fileId);
      const url = response.data?.url;
      if (!url) throw new Error('The download link came back empty.');
      return url;
    },
    enabled,
    staleTime: LINK_FRESH_MS,
    gcTime: LINK_FRESH_MS,
    // A 404 is an answer, not a hiccup: the file was deleted.
    retry: (failureCount: number, error: Error) => !isNotFoundError(error) && failureCount < 1,
    meta: { silentError: true },
  };
}

/**
 * True once the element has come within reach of the screen, and it stays
 * true. A callback ref, so the observer lives exactly as long as the node.
 */
function useSeenOnce(): [(node: HTMLElement | null) => (() => void) | undefined, boolean] {
  const [seen, setSeen] = useState(false);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (!node || seen) return undefined;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          setSeen(true);
          observer.disconnect();
        },
        { rootMargin: '300px' },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [seen],
  );
  return [ref, seen];
}

export function SentAttachments({ attachments }: { attachments: readonly MessageAttachment[] }) {
  const pictures = attachments.filter(isPictureAttachment);
  const documents = attachments.filter((attachment) => !isPictureAttachment(attachment));

  const [nearRef, near] = useSeenOnce();
  const links = useQueries({
    queries: pictures.map((picture) => fileLinkQuery(picture.file_id, near)),
  });

  /* The viewer's place, as the viewer spells it. Held through the close so
     the set does not vanish under Radix's exit. */
  const [target, setTarget] = useState<string | null>(null);
  const heldTarget = useHeldValue(target);
  const set = pictureSet(pictures, links.map((link) => link.data), heldTarget);

  if (attachments.length === 0) return null;

  return (
    <div
      ref={nearRef}
      // Taps here are about a file, never the row's timestamp reveal, and the
      // viewer's portal bubbles its events through this subtree too.
      onClick={(event) => event.stopPropagation()}
      className="mt-1 flex max-w-full flex-col items-end gap-1.5"
    >
      {pictures.length > 0 && (
        /* The strip scrolls inside the message's width. `ml-auto` keeps a
           short strip at the right edge, under the bubble, and resolves to
           zero once the strip overflows, so its start is never cut off. */
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <div className="ml-auto flex w-max gap-1.5">
            {pictures.map((picture, index) => {
              const link = links[index];
              return (
                <PictureTile
                  key={picture.file_id}
                  picture={picture}
                  url={link?.data ?? null}
                  gone={link?.isError === true && isNotFoundError(link.error)}
                  failed={link?.isError === true && !isNotFoundError(link.error)}
                  single={pictures.length === 1}
                  onOpen={() => setTarget(formatImageTarget(SET_ID, picture.file_id))}
                  onRelink={async () => (await link?.refetch())?.data}
                />
              );
            })}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="flex max-w-full flex-wrap justify-end gap-1.5">
          {documents.map((document) => (
            <DocumentChip key={document.file_id} document={document} />
          ))}
        </div>
      )}

      {pictures.length > 0 && (
        <PictureViewer
          open={target !== null}
          set={set}
          resolving={false}
          onSelect={setTarget}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

/** The viewer's set: this message's pictures, seeded with the links the tiles
 *  already hold so an open paints at once instead of minting again. */
function pictureSet(
  pictures: readonly MessageAttachment[],
  urls: readonly (string | undefined)[],
  target: string | null,
): ImageSet | null {
  if (target === null) return null;
  const parsed = parseImageTarget(target);
  if (parsed === null) return null;
  const index = pictures.findIndex((picture) => picture.file_id === parsed.attachmentId);
  if (index === -1) return null;
  return {
    messageUuid: SET_ID,
    index,
    images: pictures.map((picture, position) => ({
      id: picture.file_id,
      // Empty when the tile never asked: the viewer's frame then fails its
      // first paint and mints the link itself.
      url: urls[position] ?? '',
      original_name: picture.file_name,
      size: picture.file_size,
    })),
  };
}

function PictureTile({
  picture,
  url,
  gone,
  failed,
  single,
  onOpen,
  onRelink,
}: {
  picture: MessageAttachment;
  url: string | null;
  gone: boolean;
  failed: boolean;
  /** One picture gets a wider 4:3 tile; several share square ones. The box is
   *  fixed either way, so nothing moves when the bytes land. */
  single: boolean;
  onOpen: () => void;
  /** Ask for a new link after this one failed to paint; resolves to it. */
  onRelink: () => Promise<string | undefined>;
}) {
  const openInTab = useOpenFileInNewTab();
  const [paintedUrl, setPaintedUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  /** One new link per failure. A paint re-arms it, and that cannot loop: an
   *  `<img>` that loaded a src never fires `onError` for the same src. */
  const [armed, setArmed] = useState(true);

  const box = cn(
    'relative flex shrink-0 overflow-hidden rounded-2xl bg-muted',
    single ? 'aspect-[4/3] w-60 max-w-full' : 'size-28',
  );

  if (gone) {
    return (
      <div className={cn(box, 'flex-col items-center justify-center gap-1.5 px-3 text-center')}>
        <ImageOff aria-hidden className="size-5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">No longer available</span>
      </div>
    );
  }

  if (failed || broken) {
    return (
      <button
        type="button"
        onClick={() => openInTab.open(picture.file_id)}
        disabled={openInTab.opening}
        className={cn(
          box,
          'v2-interactive flex-col items-center justify-center gap-1.5 px-3 text-center',
          FOCUS_RING,
        )}
      >
        <ImageOff aria-hidden className="size-5 text-muted-foreground" />
        <span className="w-full truncate text-xs text-foreground">{picture.file_name}</span>
        <span className="text-xs text-muted-foreground">
          {openInTab.opening
            ? 'Opening…'
            : openInTab.gone
              ? 'No longer available'
              : openInTab.failed
                ? 'Couldn’t open. Try again'
                : 'Didn’t load. Open it'}
        </span>
      </button>
    );
  }

  const painted = url !== null && paintedUrl === url;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open picture ${picture.file_name}`}
      className={cn(box, 'v2-interactive', FOCUS_RING)}
    >
      {!painted && <Skeleton aria-hidden className="absolute inset-0 rounded-none" />}
      {url !== null && (
        /* eslint-disable-next-line @next/next/no-img-element -- a signed link on the file host; next/image has no remotePatterns for it. */
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => {
            setArmed(true);
            setPaintedUrl(url);
          }}
          onError={() => {
            if (!armed) {
              setBroken(true);
              return;
            }
            setArmed(false);
            void onRelink().then((next) => {
              // The same link again cannot paint differently.
              if (!next || next === url) setBroken(true);
            });
          }}
          className={cn(
            'size-full object-cover transition-opacity duration-200 motion-reduce:transition-none',
            painted ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </button>
  );
}

function DocumentChip({ document }: { document: MessageAttachment }) {
  const openInTab = useOpenFileInNewTab();

  if (openInTab.gone) {
    return (
      <div className="flex w-fit items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
        <FileText aria-hidden className="size-3" />
        <span className="max-w-[150px] truncate">{document.file_name}</span>
        <span>No longer available</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openInTab.open(document.file_id)}
      disabled={openInTab.opening}
      aria-label={`Open ${document.file_name}`}
      className={cn(
        'v2-interactive flex w-fit items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground',
        'transition-colors duration-150 hover:bg-muted hover:text-foreground motion-reduce:transition-none',
        FOCUS_RING,
      )}
    >
      <FileText aria-hidden className="size-3" />
      <span className="max-w-[150px] truncate">{document.file_name}</span>
      <span>
        {openInTab.opening
          ? 'Opening…'
          : openInTab.failed
            ? 'Couldn’t open. Try again'
            : formatFileSize(document.file_size)}
      </span>
    </button>
  );
}
