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
 * Pure, so the test can run it; `AffectedItems.tsx` draws it.
 */

export interface AffectedRow {
  key: string;
  type: RadarAffectedItemType;
  name: string;
  /** "File", "Note" or "Chat", then the reason, on the row's second line. */
  detail: string;
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
  return (items ?? []).map((item, index) => {
    const gone = !item.exists;
    const reason = item.reason?.trim();
    const word = TYPE_WORDS[item.type] ?? 'Item';
    return {
      key: `${item.type}:${item.id}:${index}`,
      type: item.type,
      name: item.name?.trim() || `Untitled ${word.toLowerCase()}`,
      detail: [word, gone ? AFFECTED_GONE : null, reason || null].filter(Boolean).join(' · '),
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
