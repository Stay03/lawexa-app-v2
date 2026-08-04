import type { FolderNode, FolderRecord } from './types';

/**
 * ONE row model for a folder, THREE sources — the folders list's edge
 * normalisation, the move `bookmark-row-model.ts` makes for bookmarks.
 *
 * A folder reaches the screen from three different payloads and they are NOT
 * the same object (probed, August 4 2026 — see the wave-5 study):
 *
 *   my-folders row   17 keys  (a full `FolderRecord`: user, description,
 *                              updated_at, both counts)
 *   detail.children  12 keys  (a `FolderNode`: NO user, NO description,
 *                              NO updated_at)
 *   detail.parent    12 keys  (the same reduced node)
 *
 * So the same folder is a different object depending on where it was read.
 * Mapping all three through this function makes a subfolder row and a root row
 * provably the same row.
 *
 * ── THE PARAMETER IS THE NODE, NOT THE RECORD ───────────────────────────────
 * `FolderRecord extends FolderNode`, so accepting the NODE accepts both — and
 * accepting the record would not accept a child. Nothing here reads `user`:
 * a nested node has none (which is why the two are separate types), and every
 * folder v2 shows belongs to the viewer anyway, so the field has nothing to say
 * on these screens.
 *
 * ── THE TRAIL FALLS BACK, IT NEVER BLANKS ───────────────────────────────────
 * `updated_at` is present on a my-folders ROW and on the detail, and ABSENT
 * (not null) from the nested nodes and the public-feed shape. v1 rendered an
 * empty right-hand column whenever it was missing. The trail here is a
 * timestamp AND the word that honestly describes it: "updated 3d" when the
 * payload carried one, "created 3d" when it did not — read through an `in`
 * check, so absence is proven rather than assumed. A row never shows a bare
 * relative time whose meaning depends on which endpoint it came from.
 */

/** The one place the folder route is built. uuid is the only honest address
 *  (slugs are not unique between siblings and a rename rewrites the subtree). */
export function folderHref(uuid: string): string {
  return `/folders/${encodeURIComponent(uuid)}`;
}

/** What an unnamed folder is CALLED on screen — a display substitution only. */
export const UNTITLED_FOLDER_NAME = 'Untitled folder';

/**
 * Filing practice (and the study's design research) says three levels is where
 * a folder tree stops helping. v2 ENCOURAGES that ceiling and blocks nothing:
 * the create form warns past it, the server accepts eight (probed) and so do we.
 */
export const FOLDER_DEPTH_ENCOURAGED = 3;

export interface FolderRowModel {
  /** The row's identity, its React key, and the only address that holds. */
  uuid: string;
  href: string;
  /** The display name — {@link UNTITLED_FOLDER_NAME} when the server has none. */
  name: string;
  /** Whether the name is the folder's own (false = the fallback above). */
  hasName: boolean;
  itemsCount: number;
  childrenCount: number;
  /**
   * TRUE only for a legacy PUBLIC folder, and that is why the mark exists.
   * v2 creates every folder private (decision 3) and offers no toggle, so
   * "Private" is the unremarkable default and marking it would say nothing.
   * The state worth a mark is the one a v1-era folder can still be in: listed
   * where strangers can find it.
   */
  isPublic: boolean;
  /** The trail's timestamp — `updated_at` when present, else `created_at`. */
  trailAt: string;
  /** Which of the two {@link FolderRowModel.trailAt} actually is. */
  trailKind: 'updated' | 'created';
  /**
   * A legacy colour, validated and expanded to 6 digits, or `null`.
   * v2 mints no colours (decision 2 — one monochrome glyph); a folder that
   * already carries one keeps its tint so a colour-coded shelf stays
   * recognisable to the person who built it.
   */
  tint: string | null;
}

/**
 * Only a plain hex colour may tint a tile — the value is user-authored folder
 * settings going into an inline style, so anything that is not obviously a
 * colour is simply not used.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The tint as a 6-DIGIT hex, so an alpha suffix always produces a valid 8-digit
 * colour. The 3-digit form is the trap `BookmarkRow` documents: `#abc` + `1f` is
 * five digits, which is not a colour at all — the declaration is dropped, and
 * because a truthy tint suppresses the fallback background the tile ends up with
 * none. Expanding first means a malformed value can only ever land on the
 * fallback tile, never on a blank one.
 */
export function folderTint(color: string | null | undefined): string | null {
  if (!color || !HEX_COLOR.test(color)) return null;
  const digits = color.slice(1);
  return digits.length === 3
    ? `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`
    : color;
}

/**
 * The ancestor chain as SLUG segments — display material only, never an address.
 *
 * `slug_path` is the full path from the root INCLUDING the folder's own slug
 * ("contract-law/damages/mitigation"), in slugs and not uuids, so a middle
 * segment can be counted and shown but cannot be linked: the slug route 404s and
 * sibling folders may share a slug. The breadcrumb reads this to know HOW MANY
 * levels it cannot address, which is the honest thing to show in their place.
 */
export function folderPathSegments(slugPath: string | null | undefined): string[] {
  if (!slugPath) return [];
  return slugPath.split('/').filter((segment) => segment.length > 0);
}

/** Depth from the root, counted from the slug path (a root folder is 1). */
export function folderDepth(slugPath: string | null | undefined): number {
  return Math.max(1, folderPathSegments(slugPath).length);
}

/**
 * Map one folder — from a list, from `children`, or from `parent` — to its row.
 *
 * TOTAL, not partial: there is no branch that can fail and no reason to return
 * `null`. The polymorphism a folders list has to survive is in its ITEMS
 * (`item-row-model.ts`), not in the folders themselves.
 */
export function folderRow(record: FolderNode | FolderRecord): FolderRowModel {
  const trimmed = record.name?.trim();
  // PROOF, not truthiness: `updated_at` is ABSENT from a nested node, and the
  // `in` check is what lets the compiler agree — an absent key falls back to a
  // fact the payload really carries rather than rendering an empty column.
  const updatedAt = 'updated_at' in record ? record.updated_at?.trim() : undefined;

  return {
    uuid: record.uuid,
    href: folderHref(record.uuid),
    name: trimmed || UNTITLED_FOLDER_NAME,
    hasName: !!trimmed,
    itemsCount: record.items_count,
    childrenCount: record.children_count,
    isPublic: record.is_private === false,
    trailAt: updatedAt || record.created_at,
    trailKind: updatedAt ? 'updated' : 'created',
    tint: folderTint(record.color),
  };
}

/**
 * "3 items · 1 subfolder" — the lead of every folder row's meta line, and the
 * same sentence in the folder page's header, so the count a reader saw in the
 * list is word-for-word the count they land on.
 *
 * ZEROS ARE SHOWN, NOT HIDDEN. "0 items" is the fact that makes an empty folder
 * legible at a glance; suppressing it would leave a row with no meta at all and
 * no way to tell an empty folder from one whose counts failed to load. The
 * subfolder half is only added when there is one, because "0 subfolders" is
 * noise on the overwhelming majority of folders.
 */
export function folderCountsLabel(itemsCount: number, childrenCount: number): string {
  const items = `${itemsCount} ${itemsCount === 1 ? 'item' : 'items'}`;
  if (childrenCount <= 0) return items;
  const children = `${childrenCount} ${childrenCount === 1 ? 'subfolder' : 'subfolders'}`;
  return `${items} · ${children}`;
}
