import type { FolderFile } from './template-model';

/**
 * The files in a folder the admin picked or dropped, with where each sits in
 * it, for a folder upload (`sortFolderFiles`). A picked folder lists its files
 * itself (`webkitRelativePath`); a dropped one is read entry by entry, all the
 * way down its subfolders.
 */

/** The files of a picked folder (an input with `webkitdirectory`). */
export function filesOfPickedFolder(files: FileList): FolderFile[] {
  return Array.from(files, (file) => ({ file, path: file.webkitRelativePath || file.name }));
}

/**
 * What was dropped, as entries, or `null` when no folder is among them (the
 * plain file drop takes it then). Read during the drop event: the browser
 * empties the list once the event is over.
 */
export function droppedEntries(items: DataTransferItemList): FileSystemEntry[] | null {
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry();
    if (entry) entries.push(entry);
  }
  return entries.some((entry) => entry.isDirectory) ? entries : null;
}

/** The name a drop is shown under: the folder's, or how many things came. */
export function dropName(entries: readonly FileSystemEntry[]): string {
  return entries.length === 1 ? entries[0].name : `${entries.length} dropped items`;
}

/** Every file under the dropped entries, subfolders included. */
export async function filesOfEntries(entries: readonly FileSystemEntry[]): Promise<FolderFile[]> {
  const found: FolderFile[] = [];
  for (const entry of entries) await collect(entry, found);
  return found;
}

async function collect(entry: FileSystemEntry, found: FolderFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    found.push({ file, path: entry.fullPath.replace(/^\//, '') });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // A directory reader hands its entries over a batch at a time (about 100 in
  // Chrome) and an empty batch at the end.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return;
    for (const child of batch) await collect(child, found);
  }
}
