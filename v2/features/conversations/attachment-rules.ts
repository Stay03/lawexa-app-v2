import type { MessageAttachment } from '@/types/chat';

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

const PICTURE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

/**
 * True for a SENT file the thread shows as a picture.
 *
 * The type when the message carries one; the extension only when it does not,
 * which is an older confidential transcript. The extension is a fair reading
 * there because the upload rule above admits no other picture types.
 */
export function isPictureAttachment(attachment: MessageAttachment): boolean {
  if (attachment.mime_type) {
    return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(attachment.mime_type.toLowerCase());
  }
  const extension = attachment.file_name.split('.').pop()?.toLowerCase();
  return extension !== undefined && PICTURE_EXTENSIONS.includes(extension);
}

/** One wording for both composers, so the two cannot describe different rules. */
export const ATTACHMENT_TYPE_ERROR =
  'Only PDF, DOC, DOCX, RTF, JPG, PNG and WEBP files are supported.';
export const ATTACHMENT_SIZE_ERROR =
  'Documents must be 10MB or less, and pictures 5MB or less.';
/** Shown at the point of CHOOSING, so nobody learns the limit from a refusal. */
export const ATTACHMENT_HINT = 'PDF, DOC, RTF 10MB · JPG, PNG, WEBP 5MB';

/* ── REDACTED AND CONFIDENTIAL CONVERSATIONS TAKE NO PDF AND NO PICTURE ────
 *
 * The owner's rule, 24 September 2026: "dont allow pdf or images in redacted
 * and confidential but this should be settable". Word and RTF stay, because
 * his words name PDFs and pictures only.
 *
 * WHY THOSE TWO. Redaction runs over TEXT (`RedactionClient::redact` takes a
 * string), so a picture reaches the model with every name still in it. A
 * scanned PDF is now read by OCR, which sends the pages unredacted to a
 * company that saw no document before (backend, 24 September 2026). Both
 * cross the line a private mode promises to hold.
 *
 * The server refuses these too. This exists so the person is told at the
 * composer instead, because a control that offers what the server refuses
 * makes them choose a file and watch it upload before it fails. The two are
 * not alternatives: the server refuses, the composer explains.
 *
 * "SETTABLE" IS THE SERVER'S HALF. The owner wants this rule changeable, so
 * it cannot stay hard-coded in the app. Backend is building the setting; when
 * it sends the allowed types per mode, this module reads them from there and
 * the lists below go. Until then this is the one place the rule lives.
 */
export type PrivateMode = 'redacted' | 'confidential';

/** The mode that limits files here, or `null`. Redacted is named first when
 *  both are on: its reason (names reach the model) is the one a person
 *  chose the mode for. */
export function privateModeOf(redacted: boolean, confidential: boolean): PrivateMode | null {
  if (redacted) return 'redacted';
  if (confidential) return 'confidential';
  return null;
}

const PRIVATE_MODE_TYPES: readonly string[] = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
];

export function acceptedTypesFor(mode: PrivateMode | null): string {
  return mode ? '.doc,.docx,.rtf' : ACCEPTED_FILE_TYPES;
}

export function allowedTypesFor(mode: PrivateMode | null): readonly string[] {
  return mode ? PRIVATE_MODE_TYPES : ALLOWED_FILE_TYPES;
}

/** True when a file already chosen may go in this mode. Reads the type the
 *  upload answered with; an entry without one is judged by its name. */
export function allowedInMode(
  file: { mime_type?: string; file_name: string },
  mode: PrivateMode | null,
): boolean {
  if (mode === null) return true;
  if (file.mime_type) return PRIVATE_MODE_TYPES.includes(file.mime_type.toLowerCase());
  const extension = file.file_name.split('.').pop()?.toLowerCase();
  return extension === 'doc' || extension === 'docx' || extension === 'rtf';
}

const MODE_NAME: Record<PrivateMode, string> = {
  redacted: 'redaction',
  confidential: 'confidential mode',
};

export function attachmentHintFor(mode: PrivateMode | null): string {
  if (mode === null) return ATTACHMENT_HINT;
  return `DOC, DOCX, RTF 10MB · no PDFs or pictures while ${mode}`;
}

/**
 * Said when a PDF or a picture is refused. It names the reason rather than the
 * rule, and the remedy matters as much as the reason.
 *
 * IT DOES NOT SAY "TURN THE MODE OFF". The mode belongs to the whole
 * conversation, so switching it off to send one file strips protection from
 * every message already in it, and a person who wants that file in will do
 * exactly what the error tells them. The remedy has to be the one that keeps
 * the mode where it is.
 */
export function privateModeFileError(mode: PrivateMode): string {
  return `PDFs and pictures cannot be attached while ${MODE_NAME[mode]} is on. Attach the text as a Word or RTF document, or start a new conversation for this file.`;
}

