import {
  formatImageTarget,
  parseImageTarget,
  type ImageSet,
  type ViewerImage,
} from '@/v2/features/channels/feed/image-target';
import { isRenderableImage, playableKind } from '@/v2/features/channels/files/file-model';

/**
 * viewable — which files open IN the app, and as what (Stay, 21 October 2026:
 * "files that are viewable should have view/gallery/play ... images should
 * open a gallery, videos should open gallery with 'play', etc should work in
 * folders and space folders"). Pure: no JSX, no hooks, so the Folders page, a
 * folder and a space's files decide a tap the same way.
 *
 * A PICTURE, A VIDEO OR A RECORDING opens the one full-screen viewer over the
 * list (the channel's picture viewer), and a swipe moves between the viewable
 * files of THAT list; a video or a recording plays where a picture would sit
 * (Stay, 22 October 2026: the viewer and the player "looks like different
 * things ... There should be consistency"). Anything else keeps the open it
 * had: a new tab, or a space file's card.
 *
 * THE CLASSIFIERS ARE THE CHANNEL'S (`channels/files/file-model.ts`): the same
 * mime and extension rules that decide what a message shows rather than names,
 * so a file reads the same in a folder as in the room it was posted to.
 */

export type ViewKind = 'picture' | 'video' | 'audio';

/**
 * What the decision reads. Every field but the id is optional, because a
 * folder item's file content is the unprobed shape (`folders/types.ts`); a
 * `UserFile` and a `SpaceFile` carry them all.
 */
export interface ViewableFile {
  id: number;
  original_name?: string | null;
  mime_type?: string | null;
  size?: number | null;
  url?: string | null;
}

/**
 * How a tap on this file opens it here, or `null` for the open it had.
 *
 * NO MIME, NO CLAIM. The folder item's file content may arrive without one;
 * then the row keeps today's open rather than guess from the name alone. With
 * a mime, a generic one (`application/octet-stream`) still falls back to the
 * extension for video and audio, as the channel's player does.
 */
export function viewKind(file: ViewableFile): ViewKind | null {
  if (typeof file.mime_type !== 'string') return null;
  const named = { mime_type: file.mime_type, original_name: file.original_name ?? '' };
  if (isRenderableImage(named)) return 'picture';
  return playableKind(named);
}

/** Every viewable file of one list is one set, so the viewer needs no real message
 *  id (the AI chat's sent pictures do the same, `SentAttachments.tsx`). */
export const FILE_LIST_SET = 'files';

/** The viewer's place for one file, as the viewer spells it: the `?image=`
 *  encoding, held in state here rather than in the address. */
export function pictureTarget(fileId: number): string {
  return formatImageTarget(FILE_LIST_SET, fileId);
}

/**
 * One file as the viewer reads it. `url` is the payload's own signed link,
 * good for a first paint; empty when there is none, and the viewer's frame
 * then mints one before its first paint (`ViewerFrame`). A size the payload
 * did not carry is 0, which the file lists' picture source leaves unsaid
 * rather than print "0 B". A video or a recording carries its `kind`, so the
 * viewer plays it rather than paints it.
 */
export function viewerImage(file: ViewableFile, name: string, kind: ViewKind = 'picture'): ViewerImage {
  const size = file.size;
  return {
    id: file.id,
    url: file.url ?? '',
    original_name: name,
    size: typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : 0,
    ...(kind !== 'picture' && { kind }),
  };
}

/** The list's viewable files (pictures, videos, recordings), in the list's
 *  order: the set a tap on one swipes through. `unnamed` names a file whose
 *  payload carries no name, in the list's own words. */
export function listViewable(files: readonly ViewableFile[], unnamed: string): ViewerImage[] {
  const viewable: ViewerImage[] = [];
  for (const file of files) {
    const kind = viewKind(file);
    if (kind) viewable.push(viewerImage(file, file.original_name?.trim() || unnamed, kind));
  }
  return viewable;
}

/**
 * Where the open file sits in the list's viewable files NOW. Found by id on every
 * render rather than kept as a number, so a page that loads behind the viewer,
 * or a row removed ahead of it, moves the index and not the picture. `null`
 * for no target, a malformed one, another set's, or a picture that is no
 * longer in the list (the viewer then says so).
 */
export function pictureSetAt(pictures: readonly ViewerImage[], target: string | null): ImageSet | null {
  if (target === null) return null;
  const parsed = parseImageTarget(target);
  if (parsed === null || parsed.messageUuid !== FILE_LIST_SET) return null;
  const index = pictures.findIndex((picture) => picture.id === parsed.attachmentId);
  if (index === -1) return null;
  return { messageUuid: FILE_LIST_SET, images: pictures, index };
}

