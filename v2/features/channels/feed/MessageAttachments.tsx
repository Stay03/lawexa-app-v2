'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, ImageOff, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { filesApi } from '@/lib/api/files';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { MessageAttachment } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { isRenderableImage } from '../files/file-model';
import { FileMark } from '../files/FileMark';
import { ARCHIVE_NOTE, isArchiveFile } from '../model';

/**
 * MessageAttachments — the files a message carries, under its words (backend,
 * 2026-08-05). Two shapes and no third: a picture is shown, everything else is
 * named.
 *
 * ── NOTHING HERE EVER FOLLOWS `attachment.url` ─────────────────────────────
 * That URL is pre-signed for ONE HOUR (measured: `X-Amz-Expires=3600`), and a
 * chat tab lives longer than an hour without anyone thinking about it. A link
 * built from it is therefore a link that works this morning and 403s this
 * afternoon, with nothing on screen to say why — the worst kind of broken,
 * because it looks fine until it is pressed.
 *
 * So `url` is used for exactly one thing: PAINTING a thumbnail at the moment
 * the row arrives, where a failure is visible and recoverable. Every OPENING
 * goes through `GET /files/{id}/download`, minted at click time, which is the
 * same gated endpoint the Files tab downloads through and the only URL in this
 * system that is fresh by construction.
 *
 * ── AND THE THUMBNAIL RECOVERS ONCE PER EXPIRY ─────────────────────────────
 * An `<img>` whose src expired fires `onError` and then does nothing forever.
 * The tile answers that error by minting a fresh URL and trying again — ONE
 * time per failure, because a second attempt on the same dead URL is the same
 * request with the same answer — and if that fails too it becomes a designed
 * tile with the file's name and a way to open it. Never a broken-image glyph,
 * never a silent blank. (Current practice for expiring pre-signed URLs in an
 * image element is exactly this: refresh from the origin on error rather than
 * retrying the dead URL.)
 *
 * ONCE PER FAILURE, NOT ONCE PER TILE. The minted URL is signed for an hour
 * too, so a tab left open long enough expires a second time — and a guard that
 * only ever armed once sent that second expiry straight to the permanent
 * failure tile, on a picture that was one request away from loading. A
 * successful paint re-arms it. That cannot loop: an `<img>` that has fired
 * `onLoad` for a src does not fire `onError` for the same src, so a re-arm can
 * only ever be spent by a genuinely new failure.
 *
 * ── GEOMETRY IS FIXED BEFORE THE BYTES ARRIVE ──────────────────────────────
 * The attachment payload carries no width or height, so the tile cannot be
 * sized from the image — it is an aspect box, and the picture is contained
 * inside it on the neutral ground. That costs letterboxing on a very tall or
 * very wide photo and buys a feed that does not jump as images decode, which
 * is the trade the skeleton-first rule already makes everywhere else. The box
 * is also capped, so a portrait scan cannot take the screen.
 *
 * ── THE IMAGE TEST IS THE LIBRARY'S, NOT `startsWith('image/')` ────────────
 * `isRenderableImage` admits only the formats the upload allow-list accepts and
 * every engine paints, which is what stops a future `image/tiff` becoming a
 * permanently empty tile. Anything else with an image mime falls to the named
 * row and gets the image glyph there — the same rule `FileMark` was built on.
 *
 * ── FAILURES STAY ON THE ROW ───────────────────────────────────────────────
 * The feed raises no toasts (W2 house rule), so a download that will not start
 * says so under the row that asked, with the verb to try again.
 */

export function MessageAttachments({
  attachments,
  className,
}: {
  attachments: readonly MessageAttachment[];
  className?: string;
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          {isRenderableImage(attachment) ? (
            <ImageAttachment attachment={attachment} />
          ) : (
            <FileAttachment attachment={attachment} />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Mint a FRESH signed URL for a file. `silentError` because the feed's
 * refusals are inline — see the module docblock.
 */
function useFreshFileUrl() {
  return useMutation({
    mutationFn: (id: number) => filesApi.getDownloadUrl(id),
    meta: { silentError: true },
  });
}

/** The tile's box: capped, and shaped before anything loads. */
const TILE = 'w-full max-w-[15rem] overflow-hidden rounded-xl border';

/** One inline failure line, shared by both shapes. */
function AttachmentFailure({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <p
      role="status"
      className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'rounded font-medium text-foreground underline underline-offset-2',
          FOCUS_RING,
        )}
      >
        Try again
      </button>
    </p>
  );
}

/**
 * Open a file in a new tab through a freshly minted URL. Kept as one hook so
 * the tile and the named row cannot drift on what "open" means.
 *
 * `window.open` runs after the round trip rather than in the click itself,
 * which is how the Files tab has always opened a file. That is deliberate
 * consistency, not an oversight: the same operation must not behave one way in
 * the library and another in the feed.
 *
 * IT IS ALSO THE ONE CASE THAT FAILS WITHOUT FAILING. A `window.open` outside
 * the click's own synchronous frame is a popup by every engine's rules, and iOS
 * Safari in particular simply returns `null` — no exception, no navigation.
 * Tapping an attachment on a phone would then do NOTHING AT ALL, which on
 * touch is the whole feature. So the return value is read, and a blocked open
 * lands in the same inline failure line as a refused mint: the reader is told,
 * and "Try again" is a fresh gesture the engine will honour.
 */
function useOpenAttachment() {
  const fresh = useFreshFileUrl();
  const [failed, setFailed] = useState(false);
  const open = (id: number) => {
    setFailed(false);
    fresh.mutate(id, {
      onSuccess: (response) => {
        const url = response.data?.url;
        if (!url) {
          setFailed(true);
          return;
        }
        if (!window.open(url, '_blank', 'noopener')) setFailed(true);
      },
      onError: () => setFailed(true),
    });
  };
  return { open, opening: fresh.isPending, failed };
}

/** A picture, shown. */
function ImageAttachment({ attachment }: { attachment: MessageAttachment }) {
  const refresh = useFreshFileUrl();
  const { open, opening, failed: openFailed } = useOpenAttachment();
  /**
   * The URL being painted. Seeded from the row and thereafter owned by the
   * refresh — deliberately NOT following a later `attachment.url`. A refetched
   * page can legitimately carry the ORIGINAL signed URL, which by then is the
   * one that already expired, so following the prop would let a background
   * refetch overwrite a freshly minted working URL with a dead one and pay for
   * a mint again every time. The error path already recovers a stale seed in a
   * single round trip, which is the same outcome one request sooner.
   */
  const [src, setSrc] = useState(attachment.url);
  const [paint, setPaint] = useState<'pending' | 'shown' | 'failed'>('pending');
  /** One refresh per FAILURE — see the module docblock. Held in a ref because
   *  it must survive the re-render the refreshed src causes, and nothing
   *  renders from it. */
  const refreshedRef = useRef(false);

  const handleError = () => {
    if (refreshedRef.current) {
      setPaint('failed');
      return;
    }
    refreshedRef.current = true;
    refresh.mutate(attachment.id, {
      onSuccess: (response) => {
        const url = response.data?.url;
        if (!url) {
          setPaint('failed');
          return;
        }
        setSrc(url);
        setPaint('pending');
      },
      onError: () => setPaint('failed'),
    });
  };

  if (paint === 'failed') {
    // The designed end state. It names the file, because the picture that
    // would have identified it is the thing that is missing.
    return (
      <div className={cn(TILE, 'bg-secondary/40 px-3 py-3')}>
        <div className="flex items-center gap-2">
          <ImageOff aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p
            className="min-w-0 truncate text-xs font-medium text-foreground"
            title={attachment.original_name}
          >
            {attachment.original_name}
          </p>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          This image didn&rsquo;t load.
        </p>
        <button
          type="button"
          onClick={() => open(attachment.id)}
          disabled={opening}
          className={cn(
            'v2-interactive mt-1.5 rounded text-[11px] font-medium text-foreground underline underline-offset-2',
            'disabled:opacity-60',
            FOCUS_RING,
          )}
        >
          {opening ? 'Opening…' : 'Open it'}
        </button>
        {openFailed && (
          <AttachmentFailure
            text="Couldn't open it."
            onRetry={() => open(attachment.id)}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => open(attachment.id)}
        disabled={opening}
        aria-label={`Open ${attachment.original_name}`}
        title={`${attachment.original_name} — ${formatBytes(attachment.size)}`}
        className={cn(
          TILE,
          'v2-interactive relative block aspect-[4/3] bg-secondary',
          'transition-opacity duration-150 hover:opacity-90 motion-reduce:transition-none',
          FOCUS_RING,
        )}
      >
        {paint === 'pending' && (
          <Skeleton className="absolute inset-0 size-full rounded-none" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- remote URL on the API host; the app declares no images.remotePatterns, so next/image would throw at runtime. The aspect box means no CLS either way. */}
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onLoad={() => {
            // A picture that painted has spent nothing: the next expiry, an
            // hour from now, gets its own refresh.
            refreshedRef.current = false;
            setPaint('shown');
          }}
          onError={handleError}
          className={cn(
            'absolute inset-0 size-full object-contain',
            'transition-opacity duration-200 motion-reduce:transition-none',
            paint === 'shown' ? 'opacity-100' : 'opacity-0',
          )}
        />
        {opening && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 aria-hidden className="size-4 animate-spin text-foreground" />
          </span>
        )}
      </button>
      {openFailed && (
        <AttachmentFailure
          text="Couldn't open it."
          onRetry={() => open(attachment.id)}
        />
      )}
    </div>
  );
}

/**
 * Everything else, named. The mark, the name and the size are the file row's
 * grammar from the Files tab — one vocabulary for one file, whichever screen
 * it is seen on — at the transcript's density.
 *
 * THE NAME TRUNCATES AT THE END, not in the middle. Channel files are named by
 * people rather than generated, so the front of the name is where the meaning
 * is; the full string is one hover (or one screen-reader pass) away in `title`.
 */
function FileAttachment({ attachment }: { attachment: MessageAttachment }) {
  const { open, opening, failed } = useOpenAttachment();
  const isArchive = isArchiveFile(attachment.mime_type, attachment.original_name);

  return (
    <div>
      <button
        type="button"
        onClick={() => open(attachment.id)}
        disabled={opening}
        aria-label={`Open ${attachment.original_name}`}
        className={cn(
          'v2-interactive group/att flex w-full max-w-sm items-center gap-2.5 rounded-xl border bg-background px-2 py-2 text-left',
          'transition-colors duration-150 hover:bg-secondary/50 motion-reduce:transition-none',
          FOCUS_RING,
        )}
      >
        <FileMark file={attachment} />

        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-sm font-medium text-foreground"
            title={attachment.original_name}
          >
            {attachment.original_name}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {formatBytes(attachment.size)}
          </span>
          {/* The zip obligation, said in full and in place. It is plain text
              rather than the library's chip-with-a-tooltip because this row is
              itself the open affordance, and an interactive disclosure nested
              inside a button is not a thing a browser will honour. */}
          {isArchive && (
            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
              {ARCHIVE_NOTE}
            </span>
          )}
        </span>

        {opening ? (
          <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Download
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-muted-foreground opacity-0',
              'transition-opacity duration-150 group-hover/att:opacity-100 motion-reduce:transition-none',
              '[@media(hover:none)]:opacity-100',
            )}
          />
        )}
      </button>
      {failed && (
        <AttachmentFailure
          text="Couldn't open it."
          onRetry={() => open(attachment.id)}
        />
      )}
    </div>
  );
}
