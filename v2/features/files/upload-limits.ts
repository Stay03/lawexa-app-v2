import type { SpaceUploadLimits } from '@/types/collab';
import type { IUserUploadLimits } from '@/types/message-pack';
import {
  isImageAttachment,
  MAX_DOCUMENT_SIZE,
  MAX_FILES_PER_TURN,
  MAX_IMAGE_SIZE,
  type PrivateMode,
} from '@/v2/features/conversations/attachment-rules';
import { MEDIA_MAX_SIZE_BYTES } from '@/v2/features/channels/model';

/**
 * upload-limits — the numbers the app checks a file against before it uploads
 * (techlead's go on Frontend's proposal, thread 1c93152c; Backend f2eb6ff9).
 *
 * Before plans had upload limits the app held fixed values (10 MB per
 * document, 5 MB per picture, 100 MB per video or audio file, 10 files per
 * message). Those are today's values still, but a plan an admin sets higher
 * would be refused here before the server ever saw the file. So the checks
 * read the person's own limits from `GET /users/limits` (`uploads`). An upload
 * into a space reads that space's sizes from its owner's plan
 * (`upload_limits`, Backend 2a209254). Any missing field falls back to today's
 * values (an older server, a guest, a read still on its way).
 *
 * The server still decides: a file over a limit the app could not know (a
 * PDF's page count, storage) comes back as `UPLOAD_LIMIT_REACHED`, which every
 * upload path shows (`extractUploadLimit`).
 */

/** What a file is checked against, in bytes, and how many files a message carries. */
export interface UploadLimits {
  documentBytes: number;
  imageBytes: number;
  mediaBytes: number;
  filesPerMessage: number;
}

/** Today's values: every plan's until an admin sets numbers, and the fallback. */
export const TODAY_UPLOAD_LIMITS: UploadLimits = {
  documentBytes: MAX_DOCUMENT_SIZE,
  imageBytes: MAX_IMAGE_SIZE,
  mediaBytes: MEDIA_MAX_SIZE_BYTES,
  filesPerMessage: MAX_FILES_PER_TURN,
};

const MB = 1024 * 1024;

/**
 * The most the server takes at all (Backend 527ce6a4: 500 MB documents and
 * media since uploads go straight to storage; 20 files per message). A
 * signed-in person's file is checked against these while their own limits are
 * still loading, so a file picked in the first moment is not refused at
 * today's 10 MB when their plan takes more; the server's start refuses
 * anything over the plan, with its own sentence and the plans link
 * (techlead, 31 October 2026). Pictures keep their own 5 MB.
 */
export const CEILING_UPLOAD_LIMITS: UploadLimits = {
  documentBytes: 500 * MB,
  imageBytes: MAX_IMAGE_SIZE,
  mediaBytes: 500 * MB,
  filesPerMessage: 20,
};

/**
 * The limits to check against: the person's own once read; the server's
 * ceilings while a signed-in person's read is on its way; today's values for
 * a guest or a server that sends none.
 */
export function pickUploadLimits(uploads: Partial<IUserUploadLimits> | null | undefined, loading: boolean): UploadLimits {
  if (uploads) return uploadLimitsFrom(uploads);
  return loading ? CEILING_UPLOAD_LIMITS : TODAY_UPLOAD_LIMITS;
}

/** A usable number from the server: positive and finite, else the fallback. */
function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** The server's `uploads` as the app's limits; any missing or odd field keeps today's value. */
export function uploadLimitsFrom(uploads: Partial<IUserUploadLimits> | null | undefined): UploadLimits {
  if (!uploads) return TODAY_UPLOAD_LIMITS;
  return {
    documentBytes: positive(uploads.upload_size_mb, MAX_DOCUMENT_SIZE / MB) * MB,
    imageBytes: positive(uploads.image_size_mb, MAX_IMAGE_SIZE / MB) * MB,
    mediaBytes: positive(uploads.media_size_mb, MEDIA_MAX_SIZE_BYTES / MB) * MB,
    filesPerMessage: Math.floor(positive(uploads.files_per_message, MAX_FILES_PER_TURN)),
  };
}

/**
 * An upload into a space: the space's own sizes (its owner's plan, Backend
 * 2a209254), and the person's own count of files per chat message, which the
 * server checks against the sender's plan. Pictures keep their own cap. A
 * missing or odd size keeps the person's value.
 */
export function spaceUploadLimitsFrom(
  space: Partial<SpaceUploadLimits> | null | undefined,
  personal: UploadLimits,
): UploadLimits {
  if (!space) return personal;
  return {
    ...personal,
    documentBytes: positive(space.upload_size_mb, personal.documentBytes / MB) * MB,
    mediaBytes: positive(space.media_size_mb, personal.mediaBytes / MB) * MB,
  };
}

/** How many files one pick may add to a space, or `null` for no limit. */
export function spaceFilesPerUpload(space: Partial<SpaceUploadLimits> | null | undefined): number | null {
  const value = space?.files_per_upload;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

/** Said when one pick or drop holds more files than a space takes at a time. */
export function spaceFilesPerUploadError(perUpload: number): string {
  return perUpload === 1
    ? 'This space takes one file at a time, so only the first was added.'
    : `This space takes ${perUpload} files at a time, so only the first ${perUpload} were added.`;
}

/** A size limit as people read it: "10" for 10 MB, "2.5" for 2.5 MB. */
export function megabytes(bytes: number): string {
  const value = bytes / MB;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The cap for a chat attachment: a picture's, else a document's. */
export function attachmentSizeLimit(file: Pick<File, 'type'>, limits: UploadLimits): number {
  return isImageAttachment(file) ? limits.imageBytes : limits.documentBytes;
}

/** The chat composers' refusal for a file over its cap, in the plan's numbers. */
export function attachmentSizeError(limits: UploadLimits): string {
  return `Documents must be ${megabytes(limits.documentBytes)}MB or less, and pictures ${megabytes(limits.imageBytes)}MB or less.`;
}

/** The chat composers' line under the box, in the plan's numbers. */
export function attachmentHint(limits: UploadLimits): string {
  return `PDF, DOC, RTF ${megabytes(limits.documentBytes)}MB · JPG, PNG, WEBP ${megabytes(limits.imageBytes)}MB`;
}

/** The chat composers' refusal for more files than a message carries. */
export function attachmentCapError(limits: UploadLimits): string {
  return `You can attach at most ${limits.filesPerMessage} files per message.`;
}

/**
 * The line under a chat box, in the plan's numbers. A private mode takes Word
 * and RTF only (`attachmentHintFor`'s rule), so its line names that.
 */
export function attachmentHintIn(mode: PrivateMode | null, limits: UploadLimits): string {
  if (mode === null) return attachmentHint(limits);
  return `DOC, DOCX, RTF ${megabytes(limits.documentBytes)}MB · no PDFs or pictures while ${mode}`;
}
