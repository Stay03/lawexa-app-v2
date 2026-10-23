import { extractApiError } from '@/lib/utils/api-error';
import { uploadPrecheck } from '@/v2/features/spaces/content-model';

/**
 * folder-upload — one picked file into a folder from the folder's own page
 * (`FolderAdd`'s "Upload a file"), without React, so the toast rules are
 * tested here.
 */

/** The folder an upload adds to, as the page knows it (`AddTarget`'s shape). */
export interface UploadFolder {
  name: string;
  space: { uuid: string; name: string } | null;
}

/** The file reached its store but the folder refused it: the reader keeps the file. */
export class FiledAfterUploadError extends Error {
  readonly reason: unknown;

  constructor(reason: unknown) {
    super('The file uploaded but was not added to the folder.');
    this.reason = reason;
  }
}

/** The toast calls a folder upload makes, so a test can stand in for sonner. */
export interface UploadNotices {
  loading(message: string): string | number;
  success(message: string, options: { id: string | number }): unknown;
  error(message: string, options?: { id: string | number }): unknown;
}

/**
 * One picked file into the folder: checked against the upload rules, then its
 * own "Uploading" toast, which turns into that file's outcome in place.
 *
 * EACH FILE AWAITS ITS OWN PROMISE (the caller passes `mutateAsync`). The
 * callbacks handed to `mutate(file, { onSuccess })` run only for the LAST call
 * while several are in flight, so with two files picked at once the first
 * toast stayed on "Uploading" for good (Lucy, live, 23 October 2026). The
 * personal Folders page and a space's upload queue already await each file
 * this way.
 */
export async function sendFolderUpload(
  file: File,
  {
    folder,
    upload,
    notices,
  }: {
    folder: UploadFolder;
    upload: (file: File) => Promise<unknown>;
    notices: UploadNotices;
  },
): Promise<void> {
  const refusal = uploadPrecheck(file, folder.space ? 'a space' : 'a folder');
  if (refusal) {
    notices.error(refusal);
    return;
  }
  const id = notices.loading(`Uploading “${file.name}”`);
  try {
    await upload(file);
    notices.success(`Added “${file.name}” to ${folder.name}`, { id });
  } catch (error) {
    if (error instanceof FiledAfterUploadError) {
      const where = folder.space ? `It is in ${folder.space.name}` : 'It is in your files';
      notices.error(`“${file.name}” uploaded, but couldn’t be added to ${folder.name}. ${where}.`, { id });
      return;
    }
    notices.error(`Couldn’t upload “${file.name}”. ${extractApiError(error).message}`, { id });
  }
}
