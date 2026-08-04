import type { FolderItemType, FolderRecord } from '../types';

/**
 * picker-model.ts — the picker's pure half: the words on a destination row and
 * the shape of the browse trail. No hooks, no JSX, nothing that reads the
 * clock, so every string below can be reasoned about (and read back) without
 * rendering anything.
 */

/** One step of the trail the picker walked to get where it is. */
export interface PickerCrumb {
  uuid: string;
  name: string;
}

/** How the dialog names the thing being filed, in a sentence. */
const TYPE_NOUN: Record<FolderItemType, string> = {
  case: 'case',
  note: 'note',
  statute: 'statute',
  file: 'file',
};

export function folderItemNoun(type: FolderItemType): string {
  return TYPE_NOUN[type];
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The row's meta line: what is inside this folder, said once.
 *
 * "Empty" rather than "0 items · 0 subfolders" — a destination with nothing in
 * it is a fact worth one word, and both counts are always present on an owned
 * folder row (the 17-key payload), so neither number is ever invented.
 */
export function folderContentsLine(folder: FolderRecord): string {
  const parts: string[] = [];
  if (folder.items_count > 0) parts.push(plural(folder.items_count, 'item', 'items'));
  if (folder.children_count > 0) {
    parts.push(plural(folder.children_count, 'subfolder', 'subfolders'));
  }
  return parts.length > 0 ? parts.join(' · ') : 'Empty';
}

/**
 * The ANCESTOR address of a nested folder, for a search result that could
 * otherwise be any of three folders called "Cases".
 *
 * `slug_path` is the only ancestry a search row carries, and it is made of
 * SLUGS — the ancestors' real display names are not in the payload. So this
 * renders the address as an address: hyphens opened out to spaces, case left
 * exactly as the server sent it (lower), never title-cased. Title-casing would
 * turn `law-of-torts-damages` into "Law Of Torts Damages" and quietly claim to
 * be a folder name that reads "Law of Torts — Damages". Returns `null` for a
 * root folder, which has no ancestors to name.
 */
export function folderAncestorAddress(slugPath: string): string | null {
  const segments = slugPath.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  return segments
    .slice(0, -1)
    .map((segment) => segment.replace(/-+/g, ' '))
    .join(' / ');
}

/**
 * Where a new folder would land, named — the create row's second line.
 *
 * It says PRIVATE out loud because that is the whole story: v2 mints every
 * folder private and shows no toggle (owner decision 3, reversing v1's public
 * default), so the one place a reader can be told is the moment they create one.
 */
export function createDestinationLabel(trail: readonly PickerCrumb[]): string {
  const current = trail[trail.length - 1];
  return current
    ? `New private folder in ${current.name}`
    : 'New private folder in your folders';
}
