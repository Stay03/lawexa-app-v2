import type { StatuteStatus } from '@/types/statute';
import { firstCitation, formatCaseName } from '@/v2/features/cases/case-name';
import { noteHasTitle, notePreviewText, noteDisplayTitle } from '@/v2/features/notes/note-text';
import type { FolderItemRecord } from './types';

/**
 * ONE row model, SIX wire types, FOUR rendered — the folder page's edge
 * normalisation, and the `bookmark-row-model.ts` discipline applied to the one
 * other genuinely polymorphic stream in v2.
 *
 * ── WHY A MAPPER AND NOT A `switch` IN THE COMPONENT ────────────────────────
 * A folder's contents carry cases, statutes, notes and files in one paginated
 * list. v1 rendered that with `content as X` casts in the card, which is how it
 * shipped a card that offered three of the six real types, linked a file to
 * `#`, and sent `Number(uuid)` — `NaN` — when removing a conversation. Here the
 * input is the DISCRIMINATED `FolderItemRecord` union and the output is a
 * discriminated row model, so a type this build forgets to handle is a compile
 * error and the row component's meta line is exhaustive by construction.
 *
 * ── TWO TYPES ARE KNOWN AND DELIBERATELY NOT RENDERED (decision 4) ───────────
 *  - `conversation`. The items endpoint accepts ANY conversation by sequential
 *    numeric id with no ownership check and then serves its private title back
 *    (probed: a guest with zero conversations read strangers' titles — the
 *    urgent backend ask). v2 will not add one and will not render one, so a
 *    leaked title cannot reach a screen through this feature.
 *  - `folder`. Real nesting (`parent_id`) already exists and the folder page
 *    renders it from `children`. v1 supported both containment models at once,
 *    which is why the same subfolder appeared twice on one page.
 *
 * Both still ARRIVE from folders filled by v1, so they are modelled on the wire
 * and dropped HERE, returning `null`: one item missing, never a broken page and
 * never a duplicate.
 *
 * ── AND A THIRD DROP THE COMPILER CANNOT SEE ────────────────────────────────
 * A type the SERVER ships that this build has never heard of satisfies no
 * branch. The `default` catches it and returns `null` too — the same honest
 * degrade, for the case where the wire moves before the repo does.
 */

/** What every rendered item row carries, whatever it points at. */
interface FolderItemRowBase {
  /** The ITEM's own id (the row's React key) — NOT the content's. */
  itemId: number;
  /**
   * The CONTENT's id — what `DELETE /folders/{uuid}/items` takes alongside the
   * type, and what `folderItemKey` identifies a pending removal by.
   *
   * A NUMBER, and provably so: all four RENDERED content shapes declare
   * `id: number`, and the one wire member that carries a string id is the
   * conversation, which never reaches this model. Nothing is coerced — v1 ran
   * `Number(uuid)` on that string and sent `NaN`, which is why a conversation
   * could not be removed from a folder in v1 at all. The fix is to drop the
   * type, not to cast its id.
   */
  contentId: number;
  /**
   * The destination, or `null` when this build cannot produce a real one.
   * A row with no destination renders as text rather than as a link to nowhere.
   */
  href: string | null;
  /** The row's primary line. */
  title: string;
  /** False when {@link FolderItemRowBase.title} is a fallback, not a real name. */
  hasTitle: boolean;
  /** When it was filed here — the stream's sort key, rendered as the trail. */
  addedAt: string;
}

export type FolderItemRowModel =
  | (FolderItemRowBase & {
      type: 'case';
      /** The source heading, verbatim, for the `title` attribute. */
      rawTitle: string;
      citation: string | null;
      judgmentDate: string | null;
    })
  | (FolderItemRowBase & {
      type: 'statute';
      /** The short designation ("Act 459") — practitioners cite both. */
      shortTitle: string | null;
      year: number | null;
      status: StatuteStatus;
      statusLabel: string;
    })
  | (FolderItemRowBase & {
      type: 'note';
      author: string | null;
      /** PLAIN text only — nothing here is ever handed to the browser as HTML. */
      preview: string | null;
    })
  | (FolderItemRowBase & {
      type: 'file';
      /** "PDF", "Image", … derived from the mime type, or `null` if absent. */
      kind: string | null;
      /** "1.2 MB", or `null` when the payload carried no size. */
      size: string | null;
    });

/** The four types v2 renders — the type filter's ids, in the strip's order. */
export const FOLDER_ITEM_TYPES = ['case', 'statute', 'note', 'file'] as const;

export type FolderItemFilter = (typeof FOLDER_ITEM_TYPES)[number];

/**
 * The statute status label. A folder's statute item carries `status` but NOT
 * the `status_label` the statute library reads, so the label is derived here —
 * a `Record` over the union rather than a string-capitalise, so a new status is
 * a compile error instead of a mis-cased word.
 */
const STATUTE_STATUS_LABEL: Record<StatuteStatus, string> = {
  active: 'Active',
  amended: 'Amended',
  repealed: 'Repealed',
};

/**
 * Map one folder item to its row, or `null` for a type v2 does not render.
 *
 * The caller drops a `null` from the stream. See the module docblock for which
 * three cases produce one and why each is a drop rather than a crash.
 */
export function folderItemRow(item: FolderItemRecord): FolderItemRowModel | null {
  // The dangling-content guard `/bookmarks` needed on the same day (a deleted
  // record leaves the row behind with `content: null`, which the shared type
  // declares non-nullable). Widened to a nullable VIEW — not a cast — so a
  // dangling item is dropped exactly like an unknown type.
  const present: FolderItemRecord['content'] | null = item.content;
  if (!present) return null;

  const base = { itemId: item.id, addedAt: item.added_at };

  switch (item.type) {
    case 'case': {
      const content = item.content;
      const raw = content.display_title || content.title;
      return {
        ...base,
        type: 'case',
        contentId: content.id,
        href: `/cases/${content.slug}`,
        // The same readable-name treatment the cases library gives its rows, so
        // a case reads identically wherever it appears (the all-caps source
        // heading stays on the `title` attribute).
        title: formatCaseName(raw) || 'Untitled case',
        hasTitle: raw.trim().length > 0,
        rawTitle: raw,
        citation: firstCitation(content.citation),
        judgmentDate: content.judgment_date,
      };
    }

    case 'statute': {
      const content = item.content;
      return {
        ...base,
        type: 'statute',
        contentId: content.id,
        href: `/statutes/${content.slug}`,
        title: content.title?.trim() || 'Untitled statute',
        hasTitle: !!content.title?.trim(),
        shortTitle:
          content.short_title && content.short_title !== content.title
            ? content.short_title
            : null,
        year: content.year,
        status: content.status,
        // `?? content.status` mirrors the defensive `default` in
        // `statuteStatusTone`: a status outside the enum shows its raw word
        // rather than an empty label.
        statusLabel: STATUTE_STATUS_LABEL[content.status] ?? content.status,
      };
    }

    case 'note': {
      const content = item.content;
      return {
        ...base,
        type: 'note',
        contentId: content.id,
        href: `/notes/${content.slug}`,
        // The notes feature's own display substitution, so an untitled note is
        // called the same thing in a folder as it is in the library.
        title: noteDisplayTitle(content.title),
        hasTitle: noteHasTitle(content.title),
        author: content.user?.name?.trim() || null,
        preview: notePreviewText(content.content_preview, content.content_preview_html),
      };
    }

    case 'file': {
      const content = item.content;
      // THE UNPROBED SHAPE (types.ts): a guest owns no files, so this content
      // block was never observed live. Every field is optional and this branch
      // renders only what is actually present — a file row may be a name and
      // nothing else rather than claim a size the payload did not carry.
      const name = content.original_name?.trim() || content.name?.trim() || '';
      return {
        ...base,
        type: 'file',
        contentId: content.id,
        // NO DESTINATION, DELIBERATELY. v2 has no file surface, and the `url`
        // on this payload is a PRESIGNED link with a documented ~1-hour TTL
        // (v1 refetches a fresh one per click through a hook the v2 import
        // boundary blocks). Linking to it would ship a row that works for an
        // hour and 404s afterwards, which is worse than a row that is honest
        // about being a record of what is filed here.
        href: null,
        title: name || 'File',
        hasTitle: !!name,
        kind: fileKind(content.mime_type),
        size: fileSize(content.size),
      };
    }

    // Known to the wire, never rendered (conversation, folder) — and, for a
    // type the backend ships before this build models it, the same drop.
    default:
      return null;
  }
}

/** The accessible noun for a row's type. One place, so four types cannot drift
 *  into four phrasings. */
export const FOLDER_ITEM_NOUN: Record<FolderItemFilter, string> = {
  case: 'case',
  statute: 'statute',
  note: 'note',
  file: 'file',
};

/** The type filter's labels — plural, because a tab names a collection. */
export const FOLDER_ITEM_TAB_LABEL: Record<FolderItemFilter, string> = {
  case: 'Cases',
  statute: 'Statutes',
  note: 'Notes',
  file: 'Files',
};

/**
 * A readable kind from a mime type, or `null`.
 *
 * The named families are the ones a legal file library actually holds; anything
 * else falls back to the SUBTYPE in caps ("application/zip" → "ZIP"), which is
 * still the file's own word rather than an invented one. No mime type means no
 * kind — the row simply does not claim one.
 */
function fileKind(mime: string | undefined): string | null {
  const value = mime?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'application/pdf') return 'PDF';
  if (value.startsWith('image/')) return 'Image';
  if (value.startsWith('video/')) return 'Video';
  if (value.startsWith('audio/')) return 'Audio';
  if (value.startsWith('text/')) return 'Text';
  if (value.includes('wordprocessingml') || value === 'application/msword') {
    return 'Word';
  }
  if (value.includes('spreadsheetml') || value === 'application/vnd.ms-excel') {
    return 'Spreadsheet';
  }
  if (value.includes('presentationml') || value === 'application/vnd.ms-powerpoint') {
    return 'Slides';
  }
  const subtype = value.split('/')[1];
  return subtype ? subtype.split(/[.+-]/).pop()?.toUpperCase() || null : null;
}

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * A byte count as "1.2 MB", or `null`.
 *
 * Guards the whole hostile set the unprobed shape allows — absent, `NaN`,
 * negative, `Infinity` — because a size is the one field on this row that would
 * otherwise render "NaN undefined" without anything failing.
 */
function fileSize(bytes: number | undefined): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${SIZE_UNITS[unit]}`;
}
