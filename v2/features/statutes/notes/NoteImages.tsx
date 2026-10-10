'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { StatuteAnnotation, StatuteAnnotationImage } from '@/types/statute';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { PictureViewer } from '@/v2/features/channels/feed/MessageImageViewer';
import { parseImageTarget, type ImageSet } from '@/v2/features/channels/feed/image-target';
import type { PictureSource } from '@/v2/features/channels/feed/picture-source';
import { useHeldValue } from '@/v2/features/channels/use-held-value';
import {
  freshImageUrl,
  imageAlt,
  initialThumbPaint,
  placeInImages,
  thumbFailed,
  thumbLoaded,
  thumbRefetched,
  toViewerImages,
  type ViewerPlace,
} from './images';
import { useFetchFreshNotes } from './mutations';

/**
 * The pictures of the print under a note: a row of page thumbnails, and a tap
 * on one opens it full size in the picture viewer, where the reader can step
 * through the note's pictures. Researchers and up only, like the notes
 * themselves: the panel that holds this is never rendered for anyone else.
 *
 * ── LINKS LAST ONE HOUR ────────────────────────────────────────────────────
 * Each `url` is signed for an hour. A thumbnail keeps the link it first
 * painted, so the notes' background refetch does not reload pictures already
 * on screen; when a link fails, the notes are fetched again once and the
 * fresh link is tried (`./images.ts`, ThumbPaint). The viewer does the same
 * per picture, through the source passed to it.
 *
 * ── THE VIEWER FOLLOWS THE PICTURE, NOT THE ARRAY ─────────────────────────
 * The open viewer is held as a picture id and its place. A refetch builds a
 * new array with new links, and the place is found again by id each render
 * (`placeInImages`), so the reader stays on the picture they were looking at.
 */

const VIEWER_WORDS: PictureSource['words'] = {
  set: 'print note',
  returnTo: 'the print notes',
  missing: 'It may have been deleted from this print note. Go back to the print notes to see the pictures it has now.',
  back: 'Back to the print notes',
};

/** A fresh link for one picture of one note, by fetching the notes again. */
export function useFreshImageUrl(slug: string, noteUuid: string) {
  const fetchFresh = useFetchFreshNotes(slug);
  return async (imageId: number): Promise<string | null> => freshImageUrl(await fetchFresh(), noteUuid, imageId);
}

export function NoteImages({ note, slug }: { note: StatuteAnnotation; slug: string }) {
  const images = note.images ?? [];
  const freshUrl = useFreshImageUrl(slug, note.uuid);
  const [place, setPlace] = useState<ViewerPlace | null>(null);
  // Held through the viewer's exit, so it does not blank as it fades.
  const shownPlace = useHeldValue(place);
  const current = placeInImages(images, shownPlace);
  const viewerImages = toViewerImages(images);
  const set: ImageSet | null = current
    ? { messageUuid: note.uuid, images: viewerImages, index: current.index }
    : null;

  const source: PictureSource = {
    freshUrl: (image) => freshUrl(image.id),
    download: false,
    words: VIEWER_WORDS,
  };

  return (
    <>
      {images.length > 0 ? (
        <div className="flex flex-col gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
            Print pages · {images.length}
          </span>
          <ul className="-m-1 flex snap-x gap-2.5 overflow-x-auto p-1 [scrollbar-width:none]">
            {images.map((image, index) => (
              <li key={image.id} className="snap-start">
                <button
                  type="button"
                  onClick={() => setPlace({ imageId: image.id, index })}
                  aria-label={`${imageAlt(image)}, page image ${index + 1} of ${images.length}`}
                  title={imageAlt(image)}
                  className={cn(
                    'v2-interactive block h-24 w-[4.5rem] overflow-hidden rounded-md border border-border',
                    'transition-colors duration-150 hover:border-foreground/30',
                    FOCUS_RING,
                  )}
                >
                  <NoteThumb image={image} freshUrl={freshUrl} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Mounted while the note has no pictures too, so a viewer open on the
          last picture as it is deleted can still play its exit. */}
      <PictureViewer
        open={place !== null}
        set={set}
        resolving={false}
        onSelect={(value) => {
          const target = parseImageTarget(value);
          if (!target) return;
          const index = images.findIndex((image) => image.id === target.attachmentId);
          if (index !== -1) setPlace({ imageId: target.attachmentId, index });
        }}
        onClose={() => setPlace(null)}
        source={source}
      />
    </>
  );
}

/**
 * One page picture filling its box: a skeleton until the bytes land, then a
 * fade in. Keyed by the picture's id where it is used, so its paint and its
 * one retry belong to that picture.
 */
export function NoteThumb({
  image,
  freshUrl,
  className,
}: {
  image: StatuteAnnotationImage;
  freshUrl: (imageId: number) => Promise<string | null>;
  className?: string;
}) {
  const [paint, setPaint] = useState(() => initialThumbPaint(image.url));

  const handleError = () => {
    const failed = thumbFailed(paint);
    setPaint(failed.paint);
    if (!failed.refetch) return;
    freshUrl(image.id).then(
      (url) => setPaint((current) => thumbRefetched(current, url)),
      () => setPaint((current) => thumbRefetched(current, null)),
    );
  };

  return (
    <span className={cn('relative block size-full bg-muted', className)}>
      {paint.status === 'pending' ? <Skeleton aria-hidden className="absolute inset-0 rounded-none" /> : null}
      {paint.status === 'failed' ? (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOff aria-hidden className="size-5" />
          <span className="sr-only">This picture did not load.</span>
        </span>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- signed link on the API's storage host; the app declares no images.remotePatterns, so next/image would throw. */
        <img
          key={paint.src}
          src={paint.src}
          alt={imageAlt(image)}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setPaint((current) => thumbLoaded(current))}
          onError={handleError}
          className={cn(
            'absolute inset-0 size-full object-cover object-top',
            'transition-opacity duration-200 motion-reduce:transition-none',
            paint.status === 'shown' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </span>
  );
}
