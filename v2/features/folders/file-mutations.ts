'use client';

import { useMutation } from '@tanstack/react-query';

import { filesApi } from '@/lib/api/files';
import { foldersQueries } from './queries';

/**
 * The writes on the viewer's own loose files (build 6: the Folders page is the
 * top level, and its files that sit in no folder are listed under the
 * folders). Filing one in a folder is the picker's add, which already
 * invalidates this list (`FOLDER_ITEM_INVALIDATES`).
 */

/**
 * Upload one file to the viewer's own files, in no folder, by
 * `POST /files/documents`, pictures included: the server files a picture
 * there as an image, which the Folders page lists. `POST /files` is the note
 * editor's picture store; a picture sent there saved as a content image and
 * showed nowhere (backend's local run, 22 October 2026). The caller uses
 * `mutateAsync`, one promise per file: with several files in flight,
 * `mutate`'s per-call callbacks fire only for the last
 * (`useUploadChannelFile`'s note).
 */
export function useUploadLooseFile() {
  return useMutation({
    mutationFn: (file: File) => filesApi.uploadDocument(file),
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
