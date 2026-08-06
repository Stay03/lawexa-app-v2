import type { Message, MessageAttachment } from '@/types/collab';
import { isRenderableImage } from '../files/file-model';

/**
 * image-target — the vocabulary of `?image=`, the URL state behind the
 * full-screen picture viewer. Pure: no JSX, no hooks, so the feed, the viewer
 * and anything that later needs to build one of these links agree on the
 * encoding by importing it rather than by re-deriving it.
 *
 * ── THE ENCODING IS `{messageUuid}:{attachmentId}`, AND BOTH HALVES EARN IT ──
 * The viewer has to answer two questions from the address bar alone: WHICH
 * picture is on screen, and WHAT ELSE the reader can swipe to. The attachment
 * id alone answers only the first — the siblings would have to be found by
 * scanning every loaded message for the file, which is both slower and wrong
 * (the same file can be attached to two messages, and the reader is looking at
 * one of them). The message uuid alone answers only the second.
 *
 * So the message uuid NAMES THE SET and the attachment id NAMES THE PLACE IN
 * IT. That is also exactly the set the owner asked for: the pictures in the
 * message being read, not every picture in the channel — the honest scope,
 * because it is the one the reader can see the edges of.
 *
 * THE SEPARATOR IS SAFE. A uuid never contains `:` — the same argument the
 * channel screen's `?panel=ai:{uuid}` already rests on — so the FIRST colon is
 * unambiguously the split, and the id after it is a plain positive integer.
 * Neither half needs escaping, so the param stays readable in the address bar
 * and shareable as typed.
 *
 * ── EVERY MALFORMED VALUE RESOLVES TO `null`, NEVER TO A GUESS ─────────────
 * `?image=` can arrive hand-edited, truncated by a chat client, or pointing at
 * a message that was deleted or is older than the pages this session has
 * loaded. {@link resolveImageSet} answers all of those the same way — nothing —
 * and the viewer renders its designed refusal. Nothing here throws, and nothing
 * falls back to "the first picture we could find", which would silently show a
 * reader something other than what their link said.
 */

/** Splits the message uuid from the attachment id. See the module docblock. */
const SEPARATOR = ':';

export interface ImageTarget {
  messageUuid: string;
  attachmentId: number;
}

/** The `?image=` value for one picture of one message. */
export function formatImageTarget(
  messageUuid: string,
  attachmentId: number,
): string {
  return `${messageUuid}${SEPARATOR}${attachmentId}`;
}

/** The inverse. `null` for anything that is not two well-formed halves. */
export function parseImageTarget(value: string): ImageTarget | null {
  const cut = value.indexOf(SEPARATOR);
  // `cut === 0` is an empty uuid, `-1` is no separator at all.
  if (cut <= 0) return null;
  const messageUuid = value.slice(0, cut);
  // `Number` is the strict reading on purpose: it rejects `''`, `'12abc'` and
  // `'1e3'`-style surprises that `parseInt` would happily truncate into a
  // plausible-looking id pointing at somebody else's file.
  const attachmentId = Number(value.slice(cut + 1));
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) return null;
  return { messageUuid, attachmentId };
}

/** What the viewer shows: the message's pictures, and where in them to start. */
export interface ImageSet {
  /** Needed to write the URL for a sibling — the set's own identity. */
  messageUuid: string;
  /** Every picture in the message, IN THE ORDER IT WAS SENT (the server
   *  preserves `attachment_ids`), so swiping right moves the way the eye
   *  already read the tiles. */
  images: readonly MessageAttachment[];
  /** Where the target sits in {@link ImageSet.images}; never `-1`. */
  index: number;
}

/**
 * Resolve a `?image=` value against the transcript on screen.
 *
 * The messages passed in are the feed's OWN array — cache pages merged with the
 * outbox — so a picture in a message that has not been acknowledged yet opens
 * exactly like one that has. `null` whenever the value is malformed, the
 * message is not among them, or the file it names is no longer attached to it.
 *
 * ONLY RENDERABLE IMAGES ARE SIBLINGS. `isRenderableImage` is the same test the
 * tile uses to decide what gets shown rather than named, so a message carrying
 * two photos and a PDF is a two-picture set — the reader can never swipe onto
 * a frame that was always going to be empty.
 */
export function resolveImageSet(
  messages: readonly Message[],
  value: string | null,
): ImageSet | null {
  if (value === null) return null;
  const target = parseImageTarget(value);
  if (target === null) return null;

  const message = messages.find((row) => row.uuid === target.messageUuid);
  if (!message) return null;

  const images = (message.attachments ?? []).filter(isRenderableImage);
  const index = images.findIndex((image) => image.id === target.attachmentId);
  if (index === -1) return null;

  return { messageUuid: target.messageUuid, images, index };
}
