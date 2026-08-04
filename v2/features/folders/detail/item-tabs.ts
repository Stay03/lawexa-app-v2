import {
  FOLDER_ITEM_TAB_LABEL,
  FOLDER_ITEM_TYPES,
  type FolderItemFilter,
} from '../item-row-model';

/**
 * The folder page's type filter, as PURE data — the tab ids, their labels and
 * the URL parser.
 *
 * Kept out of the component so the screen can read the tab from the URL without
 * importing the tablist, and so the ids can only ever come from
 * `FOLDER_ITEM_TYPES`: adding a fifth rendered type gives it a tab
 * automatically, and a type that is NOT rendered can never acquire one.
 */

export type FolderItemTab = 'all' | FolderItemFilter;

export const FOLDER_ITEM_TABS: readonly { id: FolderItemTab; label: string }[] = [
  { id: 'all', label: 'All' },
  ...FOLDER_ITEM_TYPES.map((type) => ({
    id: type,
    label: FOLDER_ITEM_TAB_LABEL[type],
  })),
];

/** The set behind {@link parseFolderItemTab} — built from the same source. */
const KNOWN_TABS = new Set<string>(FOLDER_ITEM_TYPES);

/**
 * Read the tab out of `?type=`. Anything unrecognised — including v1's
 * `conversation` and `subfolder` values, which old links still carry — resolves
 * to All, so a stale URL shows the whole folder instead of the empty list the
 * server returns for an unknown type (measured: `?type=bogus` is a 200 with no
 * rows, not an error, which is exactly how a filter silently lies).
 */
export function parseFolderItemTab(raw: string | null): FolderItemTab {
  return raw && KNOWN_TABS.has(raw) ? (raw as FolderItemFilter) : 'all';
}
