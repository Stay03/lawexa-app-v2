/**
 * attachment-rules — what the chat will accept on a message, in ONE place.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────
 * These constants lived twice, identically, in `ConversationComposer.tsx` and
 * `HomeComposer.tsx`. Two composers, two copies, one set of rules. On 21
 * September 2026 the country picker broke across the whole app for exactly
 * that reason: two copies of one fetcher, a provider retired underneath both,
 * and fixing one would have left the other dead. Adding image support here was
 * about to create the same pair, so the pair is gone instead.
 *
 * ── THE RULES ARE THE SERVER'S, NOT OURS ──────────────────────────────────
 * Every value below matches the validation on `POST /files/documents`, agreed
 * with backend on 21 September 2026 and read off the rule rather than assumed:
 *
 *     mimes:pdf,docx,doc,rtf,jpg,jpeg,png,webp
 *
 * A picker that offers what the server refuses is worse than one that offers
 * less: the person chooses a file, watches it upload, and gets a 422. So this
 * list may only ever widen after the server's has.
 */

/** Documents, unchanged since the attachment feature shipped. */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
] as const;

/**
 * Pictures. NO GIF, AND THAT IS DELIBERATE.
 *
 * The channels composer does take gif and this one does not, because this
 * list matches the server rule above and that rule has no gif in it. Matching
 * a sibling surface is not worth offering a type the endpoint rejects, and an
 * animated gif reaching a vision model is a single still frame anyway.
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_FILE_TYPES: readonly string[] = [
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_IMAGE_TYPES,
];

/** `accept` for the hidden file input, in the same order as the lists above. */
export const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.rtf,.jpg,.jpeg,.png,.webp';

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Pictures are capped lower than documents, and the reason is arithmetic.
 *
 * An image is base64'd into the model request, which adds about a third, so
 * 5MB leaves here as roughly 6.7MB on the wire where 10MB would leave as 13MB.
 *
 * IT REFUSES A TYPICAL PHONE PHOTO AND WE KNOW IT. A camera produces 4 to
 * 12MB, and somebody photographing a page of a judgment is exactly who this
 * feature is for. The answer is downscaling before upload — a 3000px photo
 * carries no more legible text at 1600px — not a larger cap that makes the
 * model request fail instead. Nobody has asked for the downscaling yet.
 */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export const MAX_FILES_PER_TURN = 10;

/** True for a file this composer treats as a picture rather than a document. */
export function isImageAttachment(file: File): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

/** The cap that applies to THIS file, because the two genuinely differ. */
export function maxSizeFor(file: File): number {
  return isImageAttachment(file) ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
}

/** One wording for both composers, so the two cannot describe different rules. */
export const ATTACHMENT_TYPE_ERROR =
  'Only PDF, DOC, DOCX, RTF, JPG, PNG and WEBP files are supported.';
export const ATTACHMENT_SIZE_ERROR =
  'Documents must be 10MB or less, and pictures 5MB or less.';
/** Shown at the point of CHOOSING, so nobody learns the limit from a refusal. */
export const ATTACHMENT_HINT = 'PDF, DOC, RTF 10MB · JPG, PNG, WEBP 5MB';
