import { apiClient } from '@/lib/api/client';
import { batches, mergeResults, type BulkResult } from './model';

/**
 * Bulk actions (backend bulk-actions-part1): `POST /bulk/{screen}` acts on 1
 * to 50 items and answers each as its own route would. These calls take any
 * number of items and send them in batches of 50, one after another, so the
 * server sees no more than one batch at a time; the answers come back as one.
 */

type FolderItemRef = { type: string; id: string | number };

interface BulkEnvelope {
  data: BulkResult;
}

async function inBatches<T>(items: readonly T[], send: (batch: T[]) => Promise<BulkResult>): Promise<BulkResult> {
  const parts: BulkResult[] = [];
  for (const batch of batches(items)) parts.push(await send(batch));
  return mergeResults(parts);
}

const post = async (path: string, body: Record<string, unknown>): Promise<BulkResult> =>
  (await apiClient.post<BulkEnvelope>(path, body)).data.data;

export type FolderBulkAction =
  | { action: 'delete' }
  /** Into another folder, or to the top level with `parentId: null`. */
  | { action: 'move'; parentId: string | null }
  /** Into a Space, or out of one with `spaceUuid: null`. */
  | { action: 'space'; spaceUuid: string | null }
  | { action: 'privacy'; isPrivate: boolean };

export type FileBulkAction =
  | { action: 'delete' }
  | { action: 'space'; spaceUuid: string | null }
  | { action: 'add_to_folder'; folder: string };

export type NoteBulkAction =
  | { action: 'delete' }
  | { action: 'publish' }
  /** Back to a draft. */
  | { action: 'unpublish' }
  | { action: 'privacy'; isPrivate: boolean };

export const bulkApi = {
  /** The Folders page's folders (uuids). */
  folders: (ids: readonly string[], action: FolderBulkAction) =>
    inBatches(ids, (batch) => {
      const body: Record<string, unknown> = { action: action.action, ids: batch };
      if (action.action === 'move') body.parent_id = action.parentId;
      if (action.action === 'space') body.space_uuid = action.spaceUuid;
      if (action.action === 'privacy') body.is_private = action.isPrivate;
      return post('/bulk/folders', body);
    }),

  /** A folder's items: taken out of it, or added to another folder. */
  folderItems: (folder: string, items: readonly FolderItemRef[], action: 'add' | 'remove') =>
    inBatches(items, (batch) => post('/bulk/folder-items', { action, folder, items: batch })),

  /** The reader's own files (ids). */
  files: (ids: readonly number[], action: FileBulkAction) =>
    inBatches(ids, (batch) => {
      const body: Record<string, unknown> = { action: action.action, ids: batch };
      if (action.action === 'space') body.space_uuid = action.spaceUuid;
      if (action.action === 'add_to_folder') body.folder = action.folder;
      return post('/bulk/files', body);
    }),

  /** The reader's own notes (ids). */
  notes: (ids: readonly number[], action: NoteBulkAction) =>
    inBatches(ids, (batch) => {
      const body: Record<string, unknown> = { action: action.action, ids: batch };
      if (action.action === 'privacy') body.is_private = action.isPrivate;
      return post('/bulk/notes', body);
    }),
};
