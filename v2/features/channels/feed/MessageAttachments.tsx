'use client';

import { useRef, useState } from 'react';
import { Download, ImageOff, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/utils/format-bytes';
import type { MessageAttachment } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { isRenderableImage } from '../files/file-model';
import { FileMark } from '../files/FileMark';
import { ARCHIVE_NOTE, isArchiveFile } from '../model';
import { useFreshFileUrl, useOpenFileInNewTab } from './use-file-url';

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
 * system that is fresh by construction. Both halves live in `./use-file-url.ts`
 * now, because the picture viewer needs them too and two copies of the popup
 * rule below would be two copies to keep true.
 *
 * ── A PICTURE OPENS IN THE APP; EVERYTHING ELSE OPENS IN A TAB ─────────────
 * Owner, 2026-08-06: "when i click on these images in channels it take me to
 * new tab thats not good ui/ux." A photo is part of the message, so tapping a
 * TILE now raises {@link MessageImageViewer} over the conversation — no round
 * trip, no spinner, no lost place — and swiping there moves between the
 * pictures of this same message. A document still opens in a tab, because a tab
 * is where a PDF belongs; that path is untouched.
 *
 * THE FAILED TILE KEEPS THE TAB, deliberately. Its picture has already been
 * refused once, minted afresh and refused again, so offering to open it
 * full-screen would be offering a second black rectangle. "Open it" hands the
 * reader out to the browser, which is the only thing left that might work.
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
 * ── PICTURES SHARE ONE ROW, THE X TREATMENT ────────────────────────────────
 * Owner, 2026-08-14: attachments used to stack one per row, so a message with
 * six photos was six tiles tall and pushed the conversation off the screen.
 * Pictures now group ahead of the named files and spend ONE row of the feed:
 * one picture keeps the capped single tile, two split the row at equal width
 * and equal height, three or more become a fixed-height strip that scrolls
 * sideways. The strip's cap is deliberately narrower than three tiles, so the
 * last visible tile is always cut mid-image; a cut tile reads as "there is
 * more" where a row that just fits reads as all of them (the argument
 * CountryTabs already makes for its chips). However many pictures a message
 * carries, it spends the height of one.
 *
 * `overscroll-x-contain` on the strip is load-bearing: a fling past the last
 * tile would otherwise hand the gesture to the browser, and in a WebView that
 * gesture is the system back-swipe, so flicking through photos could navigate
 * away from the channel (the trap CountryTabs documents). The scrollbar hides
 * behind the inline pair the composer's chip row already uses; this repo has
 * no global utility for that. The strip pads itself by the focus ring's reach
 * and pulls the same amount back in margin, so tabbing tile to tile shows a
 * whole ring instead of a clipped one, and that tabbing is also how a
 * keyboard scrolls the strip: every tile is a button, and focusing one brings
 * it into view.
 *
 * THE FIRST TILES LOAD EAGERLY. `loading="lazy"` judges visibility, and
 * inside a horizontal scrollport it judges the clipped tiles off screen, so a
 * strip arrived as a row of grey squares that only painted once the reader
 * scrolled it (filmed, 2026-08-14): the exact opposite of "there are pictures
 * here". The first three strip tiles are eager because two and a half fit at
 * the cap, so three covers the widest case, where the third is half visible;
 * the rest stay lazy and paint as they scroll in. The single tile and the
 * pair are always fully visible, so they are always eager. Vertical laziness
 * loses nothing: a message far up the transcript is not rendered at all.
 *
 * TWO LISTS, NOT ONE: HTML cannot wrap some of a ul's items in a row, so the
 * pictures are one list and the files below are another, each preserving the
 * message's order within its own group.
 *
 * ── GEOMETRY IS FIXED BEFORE THE BYTES ARRIVE ──────────────────────────────
 * The attachment payload carries no width or height, so a tile cannot be
 * sized from its image: every tile is a fixed box, and the feed does not jump
 * as images decode, which is the trade the skeleton-first rule already makes
 * everywhere else. How the picture MEETS its box then splits by intent. The
 * single tile CONTAINS: that case is "here is my screenshot, read it", so the
 * whole image must be visible, and letterboxing on the neutral ground is the
 * price. The pair and the strip COVER: those are "there are pictures here,
 * tap one", and a channel of portrait phone screenshots contained in a
 * landscape box was two thirds grey field per tile, a row of grey boxes
 * rather than a row of pictures (filmed, 2026-08-14). Cover crops, but the
 * box is fixed either way so nothing can jump, and the viewer a tap opens
 * shows the full image. The single box is also capped, so a portrait scan
 * cannot take the screen. The contain/cover split is deliberate: unifying it
 * either way re-breaks one of the two cases.
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
  onOpenImage,
  className,
}: {
  attachments: readonly MessageAttachment[];
  /** Raise the full-screen viewer on one picture of this message. Required, so
   *  a future caller cannot quietly fall back to the tab behaviour the owner
   *  asked us to take away. */
  onOpenImage: (attachmentId: number) => void;
  className?: string;
}) {
  if (attachments.length === 0) return null;
  const images = attachments.filter((attachment) => isRenderableImage(attachment));
  const files = attachments.filter((attachment) => !isRenderableImage(attachment));
  const layout: ImageRowLayout =
    images.length === 1 ? 'single' : images.length === 2 ? 'pair' : 'strip';
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {images.length > 0 && (
        <ul className={IMAGE_ROW[layout]}>
          {images.map((attachment, index) => (
            <li
              key={attachment.id}
              className={layout === 'strip' ? STRIP_TILE_BOX : undefined}
            >
              <ImageAttachment
                attachment={attachment}
                layout={layout}
                eager={layout !== 'strip' || index < EAGER_STRIP_TILES}
                onOpen={() => onOpenImage(attachment.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((attachment) => (
            <li key={attachment.id}>
              <FileAttachment attachment={attachment} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The tile's frame, shaped before anything loads. Size belongs to the row
 *  layout, so each one adds its own. */
const TILE = 'overflow-hidden rounded-xl border';

/** How many pictures the message carries decides the row they share. */
type ImageRowLayout = 'single' | 'pair' | 'strip';

/**
 * The row per layout. The single tile needs no row plan. The pair's cap is
 * two single tiles and the gap between them (2 x 15rem + 0.375rem), so a pair
 * never outgrows the one-picture messages around it. The strip's content cap
 * is two and a half square tiles (2.5 x 10rem + 2 x 0.375rem = 25.75rem; the
 * max-w adds the 0.25rem ring padding on each side, border box), so on any
 * feed wide enough to reach the cap the third tile is cut mid-image at the
 * right edge, and the cut is the scroll affordance. The negative margin buys
 * the padding back, so the tiles stay flush with the message's text while the
 * scrollport keeps room to paint the offset focus ring it would otherwise
 * clip.
 */
const IMAGE_ROW: Record<ImageRowLayout, string | undefined> = {
  single: undefined,
  pair: 'grid w-full max-w-[30.375rem] grid-cols-2 gap-1.5',
  strip: cn(
    '-m-1 flex max-w-[26.25rem] gap-1.5 p-1',
    'overflow-x-auto overscroll-x-contain',
    '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  ),
};

/** The strip's box lives on the `li`: every tile must hold this footprint
 *  before any image loads, or the row would re-shape as bytes arrive. Square,
 *  because the row mixes portrait screenshots with landscape photos and a
 *  square punishes neither orientation; it is where chat apps settle. */
const STRIP_TILE_BOX = 'size-40 shrink-0';

/** How many strip tiles load eagerly. Lazy loading judges the scrollport's
 *  clipped tiles off screen, so the tiles a reader actually sees must say
 *  eager themselves (see the module docblock). Two and a half fit at the cap,
 *  so three covers the widest case, where the third is half visible; from the
 *  fourth on a tile genuinely is off screen, and lazy is honest again. */
const EAGER_STRIP_TILES = 3;

/** The loaded tile's size per layout: the strip's `li` owns the box, so its
 *  tile just fills it. */
const TILE_SIZE: Record<ImageRowLayout, string> = {
  single: 'aspect-[4/3] w-full max-w-[15rem]',
  pair: 'aspect-[4/3] w-full',
  strip: 'size-full',
};

/** The failed tile takes whatever box its layout grants: content-sized on its
 *  own, cell-filling in a row, so a refused picture cannot re-shape the row
 *  its neighbours are holding. */
const FAILED_SIZE: Record<ImageRowLayout, string> = {
  single: 'w-full max-w-[15rem]',
  pair: 'size-full',
  strip: 'size-full',
};

/**
 * How the picture meets its box, and the split is DELIBERATE. The single tile
 * is "here is my screenshot, read it": contain, whole image visible, the
 * letterbox is the price. The row tiles are "there are pictures here, tap
 * one": cover fills the tile edge to edge, and the crop costs nothing because
 * the viewer a tap opens shows the full image. Unifying these either way
 * re-breaks a case: cover on the single hides the thing being shown, contain
 * in the row turns a channel of portrait screenshots into a strip of grey
 * boxes (filmed, 2026-08-14).
 *
 * COVER KEEPS THE TOP, NOT THE CENTRE. This channel is mostly phone
 * screenshots, and a screenshot carries its identity (the title, the header,
 * the first rows) at the top; the middle of a tall image is the part that
 * most often says nothing, and a centre-cropped tile arrived on film as a
 * pure white square (2026-08-14). Top is not a style preference here, it is
 * where the information is. The cost is near zero: `object-top` only moves
 * the crop on images TALLER than the box, because a landscape photo crops
 * left and right, where top keeps the horizontal centre anyway. Position
 * does nothing under contain, so the single tile carries none.
 */
const TILE_FIT: Record<ImageRowLayout, string> = {
  single: 'object-contain',
  pair: 'object-cover object-top',
  strip: 'object-cover object-top',
};

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

/** A picture, shown. */
function ImageAttachment({
  attachment,
  layout,
  eager,
  onOpen,
}: {
  attachment: MessageAttachment;
  layout: ImageRowLayout;
  /** Whether this tile is on screen without horizontal scrolling. Decided by
   *  the parent, which knows the layout and the tile's place in it; lazy
   *  loading cannot decide it, because it judges the strip's clipped tiles
   *  off screen (module docblock). */
  eager: boolean;
  onOpen: () => void;
}) {
  const refresh = useFreshFileUrl();
  const { open, opening, failed: openFailed } = useOpenFileInNewTab();
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
        // A MINT THAT HANDS BACK THE URL THAT JUST FAILED IS A FAILURE. `src` is
        // the `<img>`'s key, so an identical value changes nothing: the element
        // is never rebuilt, no `onLoad` and no `onError` can arrive, and `paint`
        // would sit at 'pending' behind a skeleton that pulses for ever with no
        // way out.
        if (url === src) {
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
      <div className={cn(TILE, FAILED_SIZE[layout], 'bg-secondary/40 px-3 py-3')}>
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

  // NO ROUND TRIP ON THE PRESS. The viewer opens from state the row already
  // holds, so the tile has no pending state and no way to fail: the picture is
  // on screen in the frame the finger lifts. Minting is the VIEWER's business,
  // and only if its own paint expires. No pending veil and no failure line
  // either: `opening` / `openFailed` belong to the FAILED branch above, which
  // returns before this one. The button is the branch's whole tree, and that
  // is load-bearing in the strip: `size-full` must resolve against the `li`
  // that owns the box, and a classless wrapper between them would hand it an
  // auto height to collapse into.
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${attachment.original_name}`}
      title={`${attachment.original_name} · ${formatBytes(attachment.size)}`}
      className={cn(
        TILE,
        TILE_SIZE[layout],
        'v2-interactive relative block bg-secondary',
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
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => {
          // A picture that painted has spent nothing: the next expiry, an
          // hour from now, gets its own refresh.
          refreshedRef.current = false;
          setPaint('shown');
        }}
        onError={handleError}
        className={cn(
          'absolute inset-0 size-full',
          TILE_FIT[layout],
          'transition-opacity duration-200 motion-reduce:transition-none',
          paint === 'shown' ? 'opacity-100' : 'opacity-0',
        )}
      />
    </button>
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
  const { open, opening, failed } = useOpenFileInNewTab();
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
