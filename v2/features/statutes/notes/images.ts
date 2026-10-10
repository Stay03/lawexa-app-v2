import type { StatuteAnnotation, StatuteAnnotationImage } from '@/types/statute';
import type { ViewerImage } from '@/v2/features/channels/feed/image-target';

/**
 * Pictures of the print on a researcher's note: the rules the screens follow,
 * kept apart from them so they can be tested. The contract is backend's:
 *
 *   POST   /statute-annotations/{uuid}/images             images[] (png, jpg, webp; 5 MB each)
 *   PATCH  /statute-annotations/{uuid}/images/{id}        caption (max 120) and/or position
 *   DELETE /statute-annotations/{uuid}/images/{id}
 *
 * Each answers the note. A note holds at most 10 pictures, and each `url` is
 * signed for one hour.
 */

/** The most pictures one note holds. */
export const NOTE_IMAGE_MAX = 10;

/** The server's limit on one picture. */
export const NOTE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** The server's limit on a caption. */
export const NOTE_IMAGE_CAPTION_MAX = 120;

const ACCEPTED_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];

/** Some systems hand over a file with no type at all; its name decides then. */
const ACCEPTED_EXTENSIONS: readonly string[] = ['png', 'jpg', 'jpeg', 'webp'];

/** What the file picker offers. */
export const NOTE_IMAGE_ACCEPT = [...ACCEPTED_TYPES, '.png', '.jpg', '.jpeg', '.webp'].join(',');

/** The three things the check reads from a picked file. */
export interface PickedFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export interface RefusedFile {
  readonly name: string;
  readonly reason: string;
}

export interface CheckedFiles<T extends PickedFile> {
  readonly accepted: readonly T[];
  readonly refused: readonly RefusedFile[];
}

function isAcceptedType(file: PickedFile): boolean {
  if (file.type) return ACCEPTED_TYPES.includes(file.type);
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_EXTENSIONS.includes(extension);
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sort the picked files into those to send and those to refuse, each refusal
 * with its reason in plain words. Files are taken in the order picked until
 * the note is full; the rest are refused as over the limit.
 */
export function checkImageFiles<T extends PickedFile>(files: readonly T[], existing: number): CheckedFiles<T> {
  const accepted: T[] = [];
  const refused: RefusedFile[] = [];
  let room = Math.max(0, NOTE_IMAGE_MAX - existing);
  for (const file of files) {
    if (!isAcceptedType(file)) {
      refused.push({ name: file.name, reason: `${file.name} was not added. Use a PNG, JPG or WebP image.` });
    } else if (file.size > NOTE_IMAGE_MAX_BYTES) {
      refused.push({
        name: file.name,
        reason: `${file.name} was not added. It is ${megabytes(file.size)} and the limit is 5 MB.`,
      });
    } else if (room === 0) {
      refused.push({
        name: file.name,
        reason: `${file.name} was not added. A print note holds at most ${NOTE_IMAGE_MAX} images.`,
      });
    } else {
      accepted.push(file);
      room -= 1;
    }
  }
  return { accepted, refused };
}

/** How many more pictures the note can take. */
export function roomForImages(existing: number): number {
  return Math.max(0, NOTE_IMAGE_MAX - existing);
}

/** A caption as it is sent: trimmed, and null when nothing is left. */
export function normalizeCaption(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

/** Longer than the server takes, once trimmed. */
export function isCaptionTooLong(text: string): boolean {
  return text.trim().length > NOTE_IMAGE_CAPTION_MAX;
}

/** The draft would change what is stored. */
export function isCaptionChanged(draft: string, saved: string | null): boolean {
  return normalizeCaption(draft) !== (saved ?? null);
}

/** The words that stand for a picture: its caption, or else its file name. */
export function imageAlt(image: Pick<StatuteAnnotationImage, 'caption' | 'original_name'>): string {
  return image.caption?.trim() || image.original_name;
}

/**
 * Move one picture a step up (-1) or down (+1). Answers the new order and the
 * 1-based position to send, or null when the step would leave the list.
 */
export function moveImage(
  ids: readonly number[],
  id: number,
  step: -1 | 1,
): { readonly ids: readonly number[]; readonly position: number } | null {
  const from = ids.indexOf(id);
  const to = from + step;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return { ids: next, position: to + 1 };
}

/**
 * The pictures in a local order while a move is on its way to the server.
 * Pictures the order does not name (added meanwhile) keep the server's order
 * after it; names that are gone are skipped.
 */
export function orderImages<T extends { readonly id: number }>(images: readonly T[], order: readonly number[] | null): readonly T[] {
  if (order === null) return images;
  const byId = new Map(images.map((image) => [image.id, image]));
  const placed = order.flatMap((id) => {
    const image = byId.get(id);
    return image ? [image] : [];
  });
  const named = new Set(order);
  return [...placed, ...images.filter((image) => !named.has(image.id))];
}

/** A note's pictures in the shape the picture viewer reads. */
export function toViewerImages(images: readonly StatuteAnnotationImage[]): ViewerImage[] {
  return images.map((image) => ({
    id: image.id,
    url: image.url,
    original_name: image.original_name,
    size: image.size_bytes,
    caption: image.caption,
  }));
}

/** Where an open viewer is: the picture on screen, and its place in the note. */
export interface ViewerPlace {
  readonly imageId: number;
  readonly index: number;
}

/**
 * Where the viewer is after the note's pictures change under it, as they do
 * when the notes are fetched again for fresh links. The picture is followed
 * by its id, never by the array it came in: a refetch builds a new array with
 * new urls, and the reader stays on the same picture. If that picture was
 * deleted, the viewer stays at the same place in the list (or the last one).
 * Null when the note has no pictures left.
 */
export function placeInImages(images: readonly { readonly id: number }[], place: ViewerPlace | null): ViewerPlace | null {
  if (place === null || images.length === 0) return null;
  const index = images.findIndex((image) => image.id === place.imageId);
  if (index !== -1) return { imageId: place.imageId, index };
  const kept = Math.min(Math.max(place.index, 0), images.length - 1);
  return { imageId: images[kept].id, index: kept };
}

/** The current link for one picture in a fresh notes list, or null. */
export function freshImageUrl(
  notes: readonly Pick<StatuteAnnotation, 'uuid' | 'images'>[] | undefined,
  noteUuid: string,
  imageId: number,
): string | null {
  const note = notes?.find((row) => row.uuid === noteUuid);
  return note?.images?.find((image) => image.id === imageId)?.url ?? null;
}

/**
 * A thumbnail's paint, and its one retry. A thumbnail keeps the link it was
 * first given, so a background refetch (every minute, and on focus) does not
 * reload pictures that are already on screen. When the link fails (the shape
 * an expired link takes in an `<img>`) the notes are fetched again ONCE, and
 * the fresh link is tried. A second failure is the end: the tile says so. A
 * picture that paints re-arms the retry, so a tab left open for hours
 * recovers each time its link runs out.
 */
export interface ThumbPaint {
  readonly src: string;
  readonly status: 'pending' | 'shown' | 'failed';
  readonly retried: boolean;
}

export function initialThumbPaint(url: string): ThumbPaint {
  return { src: url, status: 'pending', retried: false };
}

export function thumbLoaded(paint: ThumbPaint): ThumbPaint {
  return { ...paint, status: 'shown', retried: false };
}

/** The `<img>` failed. `refetch` says whether to fetch fresh links now. */
export function thumbFailed(paint: ThumbPaint): { readonly paint: ThumbPaint; readonly refetch: boolean } {
  if (paint.retried) return { paint: { ...paint, status: 'failed' }, refetch: false };
  return { paint: { ...paint, status: 'pending', retried: true }, refetch: true };
}

/**
 * The refetch answered. A link equal to the one that failed is a failure
 * too: the `<img>` would not rebuild for it, so nothing would ever paint.
 */
export function thumbRefetched(paint: ThumbPaint, freshUrl: string | null): ThumbPaint {
  if (freshUrl === null || freshUrl === paint.src) return { ...paint, status: 'failed' };
  return { src: freshUrl, status: 'pending', retried: true };
}
