import { filesApi } from '@/lib/api/files';
import type { ViewerImage } from './image-target';

/**
 * picture-source — where the picture viewer gets a fresh link, and how it
 * names what the pictures belong to.
 *
 * The viewer was built for channel files and is shared by the AI chat; the
 * print notes on a statute open their page pictures in it too (10 October
 * 2026). The three differ in exactly these places: a channel file mints its
 * link through `GET /files/{id}/download`, a print note's picture gets one by
 * fetching the notes again, and only channel files offer Download. Everything
 * else a reader sees is the same viewer.
 */
export interface PictureSource {
  /** A link that works now, or null when none can be had. */
  freshUrl: (image: ViewerImage) => Promise<string | null>;
  /** Offer Download in the bar. */
  download: boolean;
  /** The bar's line under the title, after "2 of 3 · ". The file's size when
   *  omitted, as channel files have always shown it. */
  detail?: (image: ViewerImage) => string;
  /** The viewer's sentences about where the pictures come from. */
  words: {
    /** "Picture 2 of 3 in this {set}." */
    set: string;
    /** "Press Escape or Back to return to {returnTo}." */
    returnTo: string;
    /** Said when the picture named is not there. */
    missing: string;
    /** The button under that sentence. */
    back: string;
  };
}

/** Channel files and the AI chat's sent pictures: the viewer as it always was. */
export const CHANNEL_FILE_SOURCE: PictureSource = {
  freshUrl: async (image) => (await filesApi.getDownloadUrl(image.id)).data?.url ?? null,
  download: true,
  words: {
    set: 'message',
    returnTo: 'the conversation',
    missing:
      'It may have been removed from the message, or it belongs further back in the conversation than we’ve loaded. Go back to the conversation and scroll up to look for it.',
    back: 'Back to the conversation',
  },
};
