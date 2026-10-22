/**
 * The marks the server writes into a user's message for the files it
 * attached, which the bubble never shows: the files already show under it
 * (`SentAttachments`).
 *
 * - `<attached_document name="lease.docx">…</attached_document>`: the
 *   document's whole text, wrapped. The message resource removes this form
 *   from a saved message, but a redacted chat's send answers with the
 *   redacted form of the turn (`user_message_content`), which the app draws
 *   in place of what was typed, and that form still carries the document
 *   (Lucy's live check, 22 October 2026: the bubble showed the document's
 *   text between the raw tags). It is removed from every message: a person
 *   never types it.
 * - `<attached_document name="scan.pdf" pages_as_images="3" />`: a scanned
 *   PDF sent as page images, a single tag the resource leaves (seen 24
 *   September 2026, and by backend again on 22 October). Removed from every
 *   message, as the wrapped form is.
 * - `<attached_image name="a1.png" />`: removed only on a message that has
 *   files, which is when the server writes it.
 */
const ATTACHED_DOCUMENT_BODY = /\s*<attached_document\b[^>]*(?<!\/)>[\s\S]*?<\/attached_document>/g;
const ATTACHED_DOCUMENT_TAG = /\s*<attached_document\b[^>]*\/>/g;
const ATTACHED_IMAGE_TAG = /\s*<attached_image\b[^>]*\/>/g;

/** A user message's text as its bubble shows it, without the attachment marks. */
export function withoutAttachmentMarks(content: string, hasFiles: boolean): string {
  const bodiless = content.replace(ATTACHED_DOCUMENT_BODY, '').replace(ATTACHED_DOCUMENT_TAG, '');
  const shown = hasFiles ? bodiless.replace(ATTACHED_IMAGE_TAG, '') : bodiless;
  // A document wrapped before the typed words leaves the line break between.
  return shown === content ? content : shown.trim();
}
