import type { ContentSpaceStub } from '@/types/collab';
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

/**
 * A destination row, whichever list it came from: the viewer's own folders
 * (`FolderRecord`, 17 keys) or a space's (`SpaceFolder`, which carries no
 * required `user`). The fields the rows and the picker read, and no more, so
 * both shapes satisfy it and neither is cast.
 */
export type PickerFolder = Pick<
  FolderRecord,
  'uuid' | 'name' | 'slug_path' | 'is_private' | 'children_count' | 'items_count'
> & {
  space?: FolderRecord['space'];
};

/**
 * The words that name where the picker browses: the viewer's own folders, or
 * one space's (Stay, 22 October 2026: a space's file is filed among the
 * space's folders, which are every member's, so the viewer's own list is the
 * wrong one to offer). `space` is the space being browsed, or `undefined`.
 */
export interface PickerWords {
  /** The trail's first step, where a drilled trail leads back to. */
  root: string;
  /** The field's name at the top level; inside a folder the folder names it. */
  field: string;
  loading: string;
  failed: string;
  /** The way out of an empty drilled search. */
  searchAll: string;
  /** Nothing at the top level, and no search on. */
  none: { title: string; detail: string };
}

export function pickerWords(space: ContentSpaceStub | undefined): PickerWords {
  if (space) {
    return {
      root: space.name,
      field: `Search folders in ${space.name}`,
      loading: `Loading the folders in ${space.name}`,
      failed: `The folders in ${space.name} could not be loaded`,
      searchAll: `Search all folders in ${space.name}`,
      none: {
        title: `No folders in ${space.name} yet.`,
        detail: `A folder made here is open to everyone in ${space.name}.`,
      },
    };
  }
  return {
    root: 'Your folders',
    field: 'Search your folders',
    loading: 'Loading your folders',
    failed: 'Your folders could not be loaded',
    searchAll: 'Search all your folders',
    none: {
      title: 'You have no folders yet.',
      detail: 'Group the cases, statutes and notes for one matter in one place.',
    },
  };
}

/**
 * The line under the picker's title. Filing is an add ("it can sit in more
 * than one"); in a space the sentence names the space, since its folders are
 * the only ones offered.
 */
export function pickerDescription(noun: string, options: { space?: ContentSpaceStub } = {}): string {
  if (options.space) {
    return `Pick a folder in ${options.space.name} for this ${noun}. It can sit in more than one.`;
  }
  return `Pick a folder for this ${noun}. It can sit in more than one.`;
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
export function folderContentsLine(folder: Pick<PickerFolder, 'items_count' | 'children_count'>): string {
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
 *
 * In a space the word is left out: a space's folder is open to everyone in
 * the space (`FolderNameDialog` says the same), so "private" would be false.
 */
export function createDestinationLabel(
  trail: readonly PickerCrumb[],
  space?: ContentSpaceStub,
): string {
  const current = trail[trail.length - 1];
  if (space) {
    return current ? `New folder in ${current.name}` : `New folder in ${space.name}`;
  }
  return current
    ? `New private folder in ${current.name}`
    : 'New private folder in your folders';
}
