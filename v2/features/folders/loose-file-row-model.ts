import type { UserFile } from '@/types/file';
import { viewKind, type ViewKind } from '@/v2/features/files/viewable';
import { fileKind, fileSize } from './item-row-model';

/**
 * One of the viewer's loose files (in none of their folders) as the Folders
 * page draws it (build 6): the name, then "PDF · 1.2 MB", then when it was
 * added. The same kind and size words a file filed in a folder uses, so a file
 * reads the same in both places.
 */
export interface LooseFileRowModel {
  id: number;
  /** The file's own name, or the fallback when it has none. */
  title: string;
  hasTitle: boolean;
  kind: string | null;
  size: string | null;
  /** When it was uploaded: the list's sort key. */
  createdAt: string | null;
  /** How a tap opens it here (a picture in the viewer, media in the player),
   *  or `null` for a new tab (`files/viewable.ts`, 21 October 2026). */
  view: ViewKind | null;
}

export const UNNAMED_FILE = 'Unnamed file';

export function looseFileRow(file: UserFile): LooseFileRowModel {
  const name = file.original_name?.trim() ?? '';
  return {
    id: file.id,
    title: name || UNNAMED_FILE,
    hasTitle: name.length > 0,
    kind: fileKind(file.mime_type),
    size: fileSize(file.size),
    createdAt: file.created_at || null,
    view: viewKind(file),
  };
}
