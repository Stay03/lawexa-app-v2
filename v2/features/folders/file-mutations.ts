'use client';

import { useMutation } from '@tanstack/react-query';

import { filesApi } from '@/lib/api/files';
import { isImageAttachment } from '@/v2/features/conversations/attachment-rules';
import { foldersQueries } from './queries';

/**
 * The writes on the viewer's own loose files (build 6: the Folders page is the
 * top level, and its files that sit in no folder are listed under the
 * folders). Filing one in a folder is the picker's add, which already
 * invalidates this list (`FOLDER_ITEM_INVALIDATES`).
 */

/**
 * Upload one file to the viewer's own files, in no folder: a picture to
 * `POST /files`, anything else to `POST /files/documents`, as a folder's own
 * upload sends it. The caller uses `mutateAsync`, one promise per file: with
 * several files in flight, `mutate`'s per-call callbacks fire only for the
 * last (`useUploadChannelFile`'s note).
 */
export function useUploadLooseFile() {
  return useMutation({
    mutationFn: (file: File) =>
      isImageAttachment(file) ? filesApi.uploadImage(file) : filesApi.uploadDocument(file),
    meta: { silentError: true, invalidates: [foldersQueries.looseFilesKey()] },
  });
}

/**
 * Delete one of the viewer's own files (`DELETE /files/{id}`). The file goes
 * from every folder that held it, so the folder caches re-ask with the list.
 */
export function useDeleteOwnFile() {
  return useMutation({
    mutationFn: (fileId: number) => filesApi.deleteFile(fileId),
    meta: {
      silentError: true,
      invalidates: [
        foldersQueries.looseFilesKey(),
        foldersQueries.lists(),
        foldersQueries.details(),
        foldersQueries.itemLists(),
      ],
    },
  });
}
