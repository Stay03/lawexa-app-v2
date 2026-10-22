'use client';

import { useMemo } from 'react';

import { filesApi } from '@/lib/api/files';
import { formatBytes } from '@/lib/utils/format-bytes';
import { PictureViewer } from '@/v2/features/channels/feed/MessageImageViewer';
import type { ViewerImage } from '@/v2/features/channels/feed/image-target';
import type { PictureSource } from '@/v2/features/channels/feed/picture-source';
import { useHeldValue } from '@/v2/features/channels/use-held-value';
import type { FileViewer } from './use-file-viewer';
import { ViewerMedia } from './ViewerMedia';
import { pictureSetAt } from './viewable';

/**
 * FileViewers — a file list's one viewer, drawn once under the list from what
 * `useFileViewer` holds. Pictures, videos and recordings open in it alike, and
 * a swipe moves through all of them (Stay, 22 October 2026: "There should be
 * consistency"); a video or a recording plays where a picture sits
 * (`ViewerMedia`). The Folders page's loose files, a
 * folder (personal or a space's) and a space's files each render one.
 *
 * THE PICTURE VIEWER IS THE CHANNEL'S (`PictureViewer`): the same swipe, the
 * same Download and Open original, the same one-mint-per-expiry frames. What
 * differs is where a fresh link comes from, and the words, which is what a
 * `PictureSource` is for. The set is the list's loaded pictures, resolved by
 * id on every render (`pictureSetAt`), so a page that loads behind the viewer
 * adds pictures to swipe to without moving the one on screen.
 *
 * IT IS HELD IN STATE, not in the address, so Back leaves the page rather
 * than the viewer; the viewer's words say Escape alone. And it returns focus
 * to where the open came from (`viewer.returnTo`): the row's button, or the
 * row a space file card hung from, since the card's View or Play closes with
 * the card.
 */

/** A video or a recording, drawn where a picture would sit. */
const renderMedia: PictureSource['renderMedia'] = (file) => <ViewerMedia file={file} />;

/** Which list the viewers stand under, for the viewer's sentences. */
export type FileListPlace = 'files' | 'folder' | 'space';

/** A link that SHOWS the file (`?inline=1`), so Open original shows the
 *  picture in its tab rather than downloading it (the file row's rule). The
 *  frame paints it the same. */
async function freshInlineUrl(image: ViewerImage): Promise<string | null> {
  return (await filesApi.getDownloadUrl(image.id, { inline: true })).data?.url ?? null;
}

/** The bar's detail: the size, or nothing for a payload that carried none. */
function sizeDetail(image: ViewerImage): string {
  return image.size > 0 ? formatBytes(image.size) : '';
}

/** The inline links' own cache, apart from the channel's plain ones. */
const INLINE_LINK_KEY = 'file-inline';

const PICTURE_SOURCE: Record<FileListPlace, PictureSource> = {
  files: {
    freshUrl: freshInlineUrl,
    linkKey: INLINE_LINK_KEY,
    download: true,
    detail: sizeDetail,
    renderMedia,
    words: {
      set: 'list',
      returnTo: 'your files',
      missing:
        'It may have been deleted, or it is further down your files than has loaded. Go back and scroll down to look for it.',
      back: 'Back to your files',
    },
  },
  folder: {
    freshUrl: freshInlineUrl,
    linkKey: INLINE_LINK_KEY,
    download: true,
    detail: sizeDetail,
    renderMedia,
    words: {
      set: 'folder',
      returnTo: 'the folder',
      missing:
        'It may have been taken out of this folder, or it is further down the folder than has loaded. Go back and scroll down to look for it.',
      back: 'Back to the folder',
    },
  },
  space: {
    freshUrl: freshInlineUrl,
    linkKey: INLINE_LINK_KEY,
    download: true,
    detail: sizeDetail,
    renderMedia,
    words: {
      set: 'space',
      returnTo: 'the space',
      missing:
        'It may have been removed from the space, or it is further down the list than has loaded. Go back and scroll down to look for it.',
      back: 'Back to the space',
    },
  },
};

export function FileViewers({
  viewer,
  pictures,
  place,
}: {
  viewer: FileViewer;
  /** The list's loaded viewable files, in its order (`listViewable`). */
  pictures: readonly ViewerImage[];
  place: FileListPlace;
}) {
  // Held through the viewer's exit, so it does not blank as it fades.
  const shown = useHeldValue(viewer.picture);
  const set = useMemo(() => pictureSetAt(pictures, shown), [pictures, shown]);

  return (
    <PictureViewer
      open={viewer.picture !== null}
      set={set}
      resolving={false}
      onSelect={viewer.setPicture}
      onClose={() => viewer.setPicture(null)}
      source={PICTURE_SOURCE[place]}
      returnFocusTo={viewer.returnTo}
    />
  );
}
