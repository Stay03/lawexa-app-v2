import { chatApi } from '@/lib/api/chat';
import { spacesApi } from '@/lib/api/collab';

/** What a composer keeps of an uploaded attachment, from either upload. */
export interface UploadedAttachment {
  id: number;
  original_name: string;
  size: number;
  mime_type: string;
}

/** The two uploads, passed in so node:test can stand in for them. */
export interface AttachmentUploads {
  uploadDocument: (file: File) => Promise<{ data: UploadedAttachment }>;
  uploadSpaceFile: (spaceUuid: string, file: File) => Promise<{ data: UploadedAttachment }>;
}

const LIVE_UPLOADS: AttachmentUploads = {
  uploadDocument: (file) => chatApi.uploadDocument(file),
  uploadSpaceFile: (spaceUuid, file) => spacesApi.uploadFile(spaceUuid, file),
};

/**
 * Upload a file a composer attaches. In a space (a space chat, or a new chat
 * started from a space's message box) it goes to the space: POST
 * /spaces/{space}/files, so the file is the space's from the start and shows
 * in its Files tab, and not in the sender's own files (Stay, 15 October 2026:
 * "A file uploaded to a space should not be added to my files, it belongs to
 * the space"). Anywhere else it goes to the sender's own files, as before
 * (POST /files/documents). Both take the same multipart `file` and the same
 * upload rules, and both answer with the file's id, which the turn sends.
 */
export async function uploadAttachment(
  file: File,
  spaceUuid: string | null,
  uploads: AttachmentUploads = LIVE_UPLOADS,
): Promise<UploadedAttachment> {
  const response = spaceUuid
    ? await uploads.uploadSpaceFile(spaceUuid, file)
    : await uploads.uploadDocument(file);
  const { id, original_name, size, mime_type } = response.data;
  return { id, original_name, size, mime_type };
}
