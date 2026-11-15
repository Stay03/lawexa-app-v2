import type { ChatAttachmentRule, MessageAttachment } from '@/types/chat';

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
export function isImageAttachment(file: Pick<File, 'type'>): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

/** The cap that applies to THIS file, because the two genuinely differ. */
export function maxSizeFor(file: Pick<File, 'type'>): number {
  return isImageAttachment(file) ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
}

export const PICTURE_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png', 'webp'];

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
 * "SETTABLE" IS THE SERVER'S HALF, AND IT HAS LANDED (Backend's
 * ChatAttachmentRules, redaction-choices 76df483f; Fable's V3 review, 15
 * November 2026). The server holds the one list of files per chat mode and
 * sends it as `GET /chat/attachment-rules`, with its own sentence for a
 * refusal. The app keeps no list of its own for a private mode: until the
 * server's answer is in, a private chat takes no file and says why.
 */
export type PrivateMode = 'redacted' | 'confidential';

/** A chat's mode as the server keys its file rules. */
export type ChatMode = 'normal' | PrivateMode;

/**
 * The mode whose files apply here, read as the server reads it: a chat that
 * is both confidential and redacted reads as confidential (the two lists are
 * the same, so neither is looser).
 */
export function chatModeOf(redacted: boolean, confidential: boolean): ChatMode {
  if (confidential) return 'confidential';
  if (redacted) return 'redacted';
  return 'normal';
}

/** The private mode that limits files here, or `null` in a normal chat. */
export function privateModeOf(redacted: boolean, confidential: boolean): PrivateMode | null {
  const mode = chatModeOf(redacted, confidential);
  return mode === 'normal' ? null : mode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : null;
}

/**
 * One mode's rule as the server sends it; null for a shape this app does not
 * know, so a broken answer never widens what a chat takes. Extensions are
 * kept in the server's ".docx" form, lower case.
 */
export function readAttachmentRule(value: unknown): ChatAttachmentRule | null {
  if (!isRecord(value)) return null;
  const mimeTypes = stringList(value.mime_types);
  const extensions = stringList(value.extensions);
  if (!mimeTypes || !extensions || typeof value.refused !== 'string' || value.refused.trim() === '') return null;
  return {
    mime_types: mimeTypes.map((type) => type.toLowerCase()),
    extensions: extensions.map((extension) => `.${extension.replace(/^\./, '').toLowerCase()}`),
    max_bytes: typeof value.max_bytes === 'number' && value.max_bytes > 0 ? value.max_bytes : 0,
    images: value.images === true,
    refused: value.refused,
  };
}

/** `GET /chat/attachment-rules`'s `data`: each mode it sends and this app can read. */
export function readAttachmentRules(value: unknown): Partial<Record<ChatMode, ChatAttachmentRule>> {
  if (!isRecord(value)) return {};
  const rules: Partial<Record<ChatMode, ChatAttachmentRule>> = {};
  for (const mode of ['normal', 'redacted', 'confidential'] as const) {
    const rule = readAttachmentRule(value[mode]);
    if (rule) rules[mode] = rule;
  }
  return rules;
}

/** What a chat box checks a file against in one mode. */
export interface FileRule {
  /** For the file input's `accept`. Empty takes any file to the check, which then refuses it. */
  accept: string;
  mimeTypes: readonly string[];
  /** In the server's ".docx" form. */
  extensions: readonly string[];
  images: boolean;
  /** Said when a file of another type is refused here. */
  refused: string;
  /** False until the server's rule for this mode is in. */
  known: boolean;
}

/** Said while a private chat's rule is not in yet: it takes no file until then. */
export const FILE_RULE_PENDING = 'Checking which files this chat takes. Try again in a moment.';

/**
 * The rule a chat box uses: the server's for this mode when it has answered.
 * Before that, a normal chat uses the upload's own rule above, and a private
 * chat takes nothing: the app holds no private list to fall back on.
 */
export function fileRuleFor(mode: ChatMode, server: ChatAttachmentRule | null): FileRule {
  if (server) {
    return {
      accept: server.extensions.join(','),
      mimeTypes: server.mime_types,
      extensions: server.extensions,
      images: server.images,
      refused: server.refused,
      known: true,
    };
  }
  if (mode === 'normal') {
    return {
      accept: ACCEPTED_FILE_TYPES,
      mimeTypes: ALLOWED_FILE_TYPES,
      extensions: ACCEPTED_FILE_TYPES.split(','),
      images: true,
      refused: ATTACHMENT_TYPE_ERROR,
      known: false,
    };
  }
  return { accept: '', mimeTypes: [], extensions: [], images: false, refused: FILE_RULE_PENDING, known: false };
}

/** True when a file being picked may be attached under this rule. */
export function takesFile(rule: FileRule, file: Pick<File, 'type'>): boolean {
  return rule.mimeTypes.includes(file.type.toLowerCase());
}

/**
 * True when a file already chosen may stay (the home box: a mode can be
 * switched on after files were attached). Reads the type the upload answered
 * with; an entry without one is judged by its name.
 */
export function takesChosenFile(rule: FileRule, file: { mime_type?: string; file_name: string }): boolean {
  if (file.mime_type) return rule.mimeTypes.includes(file.mime_type.toLowerCase());
  const extension = file.file_name.split('.').pop()?.toLowerCase();
  return extension !== undefined && rule.extensions.includes(`.${extension}`);
}

