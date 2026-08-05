'use client';

import { useState } from 'react';
import {
  File as FileIcon,
  FileArchive,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Presentation,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChannelFile } from '@/types/collab';
import { fileKind, isRenderableImage, type FileKind } from './file-model';

/**
 * FileMark — the 40px leading mark on a file row: a thumbnail when the file is
 * an image the browser can paint, a type glyph otherwise.
 *
 * ── WHY A PLAIN `<img>`, VERIFIED ─────────────────────────────────────────
 * `next.config.ts` declares no `images` block at all, so it configures no
 * `remotePatterns` — and `next/image` REFUSES a remote src that no pattern
 * admits, at runtime, per request. `ChannelFile.url` points at the API host,
 * so `next/image` here would be a guaranteed runtime error rather than an
 * optimisation. A plain `<img>` with explicit dimensions is the honest choice
 * until a remote-image policy is agreed, and it is the same call `NoteContent`
 * and `LawyerCard` already made for the same reason.
 *
 * The explicit `width`/`height` and the fixed box mean the mark NEVER causes
 * layout shift: the row's geometry is identical before the image decodes,
 * after it decodes, and if it never does.
 *
 * ── WHETHER THAT URL IS PUBLICLY FETCHABLE IS UNVERIFIED ──────────────────
 * `types/collab.ts` DESCRIBES `url` as "a time-limited signed URL for private
 * files (regenerated per response)", which would make it loadable by an `<img>`
 * carrying no Authorization header. That is a comment, not an observation, and
 * the separate `filesApi.getDownloadUrl(id)` endpoint exists precisely because
 * the DOWNLOAD path is gated — so the two could plausibly be the same gate.
 *
 * What was actually measured against prod (Aug 5, film account): `GET
 * /api/channels` → 200, and `GET /api/channels/{uuid}/files` → 200 on both of
 * that account's channels — with ZERO file rows. There was no file to inspect,
 * and creating one is a production write, which the sandbox declined. So the
 * claim is NOT asserted here, and this component is built to be correct either
 * way rather than to depend on the answer:
 *
 *  - if the URL is public, the thumbnail paints;
 *  - if it is auth-gated, the request fails, `onError` fires, and the row falls
 *    back to the IMAGE type glyph — which is exactly what this surface rendered
 *    before this wave. The degradation is to the previous behaviour, never to a
 *    broken-image icon or an empty box.
 *
 * A device pass with one real image in a channel settles it in a single look;
 * if it proves gated, the fix is a thumbnail URL from the backend, not a change
 * of shape here.
 *
 * ── THE ATTEMPT IS KEYED TO THE URL ───────────────────────────────────────
 * The load/error state lives in {@link ImageThumb}, mounted under
 * `key={file.url}`. A refetch that regenerates a signed URL is therefore a NEW
 * component instance with a fresh attempt, instead of a stale `failed` that
 * could never retry. Keying is the whole mechanism — there is no state-reset
 * effect, which the React Compiler rules forbid anyway.
 *
 * ── ONE ACCENT ────────────────────────────────────────────────────────────
 * Every type glyph sits on the SAME neutral ground. An earlier draft tinted
 * spreadsheets emerald and slides amber, which put a third and a fourth accent
 * into a system whose rule is that one accent carries all signal — and did it
 * one tab away from the gold-only Lists ring, in the same wave that deleted
 * emerald for exactly that reason. The glyph's SHAPE distinguishes the type,
 * which survives colour-blindness and a monochrome print; a colour per file
 * type survives neither, and costs the system its rule.
 *
 * ── IT IS DECORATIVE ──────────────────────────────────────────────────────
 * `alt=""` and `aria-hidden`: the file's name is right beside it, and "photo of
 * a document" announced before that name is noise. The row's controls carry the
 * accessible names.
 */

const BOX = 'size-10 shrink-0 overflow-hidden rounded-lg';
const GROUND = 'bg-secondary text-muted-foreground';

/** Concrete element per bucket — never a component reference picked in render. */
function KindGlyph({ kind }: { kind: FileKind }) {
  const className = 'size-[18px]';
  switch (kind) {
    case 'image':
      return <ImageIcon aria-hidden className={className} />;
    case 'spreadsheet':
      return <FileSpreadsheet aria-hidden className={className} />;
    case 'presentation':
      return <Presentation aria-hidden className={className} />;
    case 'archive':
      return <FileArchive aria-hidden className={className} />;
    case 'document':
      return <FileText aria-hidden className={className} />;
    default:
      return <FileIcon aria-hidden className={className} />;
  }
}

function GlyphMark({ kind }: { kind: FileKind }) {
  return (
    <span aria-hidden className={cn(BOX, GROUND, 'flex items-center justify-center')}>
      <KindGlyph kind={kind} />
    </span>
  );
}

/** The thumbnail attempt. Mounted under `key={url}`, so a regenerated URL is a
 *  fresh instance and a fresh try. */
function ImageThumb({ url }: { url: string }) {
  const [settled, setSettled] = useState<'pending' | 'shown' | 'failed'>('pending');

  if (settled === 'failed') return <GlyphMark kind="image" />;

  return (
    <span className={cn(BOX, 'relative block bg-secondary')}>
      {settled === 'pending' ? (
        <Skeleton className="absolute inset-0 size-full rounded-lg" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- remote URL on the API host; the app configures no images.remotePatterns, so next/image would throw at runtime. Explicit dimensions + a fixed box mean no CLS. */}
      <img
        src={url}
        alt=""
        aria-hidden
        width={40}
        height={40}
        loading="lazy"
        decoding="async"
        onLoad={() => setSettled('shown')}
        onError={() => setSettled('failed')}
        className={cn(
          'size-full object-cover transition-opacity duration-200 motion-reduce:transition-none',
          settled === 'shown' ? 'opacity-100' : 'opacity-0',
        )}
      />
    </span>
  );
}

/** Everything the mark actually reads. Typed as the fields rather than as
 *  `ChannelFile` so a {@link MessageAttachment} — the same row without an
 *  `uploader` — wears the same mark in the feed, with no cast and no second
 *  component. */
export type MarkableFile = Pick<ChannelFile, 'mime_type' | 'original_name' | 'url'>;

export function FileMark({ file }: { file: MarkableFile }) {
  const kind = fileKind(file);
  if (kind !== 'image' || !isRenderableImage(file) || !file.url) {
    return <GlyphMark kind={kind} />;
  }
  return <ImageThumb key={file.url} url={file.url} />;
}

/** The mark's reserved shape — same box and radius, so the swap moves nothing. */
export function FileMarkSkeleton() {
  return <Skeleton className={BOX} />;
}
