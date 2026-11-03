import type { RadarAffectedItem, RadarAffectedItemType } from '@/types/radar';

/**
 * affected-items — the files, notes and chats of a space that a Radar report
 * says the change touches, and why (plan 5.4, Backend's B3, 26 October 2026).
 *
 * Each item carries its own app page as `url`: a file opens the space's file
 * card (`/spaces/{uuid}?tab=files&file={id}`), a note its page, a chat
 * `/c/{uuid}`. An item that has left the space or been deleted since the scan
 * (`exists: false`) keeps its name, as the report was written about it, and
 * says it is gone instead of linking to a page that would refuse.
 *
 * ONE ROW PER FILE (Arthur, 3 November 2026, option 2): a report can name the
 * same file for several passages, one item each. They are one row, at the
 * first one's place, with every reason under the name and how many passages
 * there are; its link is the first item's, whose read lists every passage of
 * that file, so the reader steps through them there (`SpaceLinkedFile`).
 * Notes and chats keep a row each.
 *
 * Pure, so the test can run it; `AffectedItems.tsx` draws it.
 */

export interface AffectedRow {
  key: string;
  type: RadarAffectedItemType;
  name: string;
  /** "File", "Note" or "Chat", then the reason, on the row's second line; for
   *  a file named for several passages, how many, with the reasons in `reasons`. */
  detail: string;
  /** A file's reasons, one per passage, when it is named for more than one. */
  reasons: readonly string[];
  /** The item's page in the app; `null` when it is gone or has none. */
  href: string | null;
  gone: boolean;
}

const TYPE_WORDS: Record<RadarAffectedItemType, string> = {
  file: 'File',
  note: 'Note',
  conversation: 'Chat',
};

export const AFFECTED_GONE = 'No longer in the Space';

export function affectedRows(items: readonly RadarAffectedItem[] | undefined): AffectedRow[] {
  // The items in order, a file's later items folded into its first.
  const groups: { item: RadarAffectedItem; index: number; reasons: string[] }[] = [];
  const fileGroup = new Map<string, (typeof groups)[number]>();
  (items ?? []).forEach((item, index) => {
    const reason = item.reason?.trim() || '';
    const fileKey = item.type === 'file' ? String(item.id) : null;
    const known = fileKey === null ? undefined : fileGroup.get(fileKey);
    if (known) {
      known.reasons.push(reason);
      return;
    }
    const group = { item, index, reasons: [reason] };
    groups.push(group);
    if (fileKey !== null) fileGroup.set(fileKey, group);
  });

  return groups.map(({ item, index, reasons }) => {
    const gone = !item.exists;
    const word = TYPE_WORDS[item.type] ?? 'Item';
    const several = reasons.length > 1;
    const said = several ? `${reasons.length} passages` : reasons[0] || null;
    return {
      key: `${item.type}:${item.id}:${index}`,
      type: item.type,
      name: item.name?.trim() || `Untitled ${word.toLowerCase()}`,
      detail: [word, gone ? AFFECTED_GONE : null, said].filter(Boolean).join(' · '),
      reasons: several ? reasons.filter(Boolean) : [],
      href: gone ? null : itemPath(item.url),
      gone,
    };
  });
}

/** The three pages an item opens: a space's file card, a note, a chat. */
const ITEM_PAGE = /^\/(spaces|notes|c)\//;

/**
 * The item's page as an app path. The API writes the address on its own
 * `frontend_url` (`https://…/notes/{slug}`), so only the path and query are
 * kept, and only for an item page: the list opens it inside the app and never
 * sends a reader to another site, whatever host the address names.
 */
function itemPath(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, 'https://app.invalid');
    const path = `${parsed.pathname}${parsed.search}`;
    return ITEM_PAGE.test(parsed.pathname) ? path : null;
  } catch {
    return null;
  }
}
