import type { Bookmark, BookmarkType } from '@/types/bookmark';
import type { StatuteStatus } from '@/types/statute';
import { firstCitation, formatCaseName } from '@/v2/features/cases/case-name';

/**
 * ONE row model, FOUR sources — the bookmarks list's edge normalisation, the
 * same move `case-row-model.ts` and `statute-row-model.ts` make.
 *
 * WHY THIS FILE IS THE POINT OF THE WHOLE SCREEN. A bookmark list is the only
 * v2 surface whose rows are genuinely polymorphic: one stream carries cases,
 * statutes, notes and folders. v1 rendered that with `content as X` casts, and
 * the compiler therefore could not see that it had NO statute branch — every
 * saved statute rendered a folder icon and linked to `/folders/undefined`. Here
 * the input is the DISCRIMINATED `Bookmark` union and the output is a
 * discriminated row model, so a type we FORGET TO HANDLE is caught at compile
 * time and the row component's meta line is exhaustive by construction.
 *
 * COMPILE TIME IS NOT RUN TIME, and this file says so out loud. A fifth type
 * shipped by the backend before this code knows about it satisfies no branch,
 * so the mapper returns `null` and the list drops the row — an honest degrade
 * (one unknown item is missing) instead of a crash that takes the whole page
 * with it. Nothing here pretends a compiler can police the wire.
 *
 * WHAT IS DELIBERATELY ABSENT: counts. The bookmarks payload's
 * `bookmarks_count` came back 0 immediately after a successful add on a live
 * probe (August 3, 2026), so nothing on this page renders one.
 */

/** What every row carries, whatever it points at. */
interface BookmarkRowBase {
  /**
   * The BOOKMARK's own id — this row's React key and its presence-holdover
   * identity. NOT what the list cache removes by: removal is addressed by
   * `(type, contentId)`, the pair the toggle endpoint itself takes, so the
   * writer works from any surface that knows what it is un-saving.
   */
  bookmarkId: number;
  /** The CONTENT's id — what the toggle endpoint takes. */
  contentId: number;
  /**
   * The destination, or `null` when the payload cannot produce a real one.
   *
   * NULLABLE ON PURPOSE. `/folders/undefined` is a live v1 defect on this very
   * screen, and a type declaring `uuid: string` is a promise about a payload
   * shape we have never actually observed (see `types/bookmark.ts`). A row with
   * no destination renders as text rather than as a link to nowhere.
   */
  href: string | null;
  /** The row's primary line. */
  title: string;
  /** When it was saved — the list's sort key, rendered as a relative time. */
  savedAt: string;
  /** Always true on this list; carried so the star reads from the row model. */
  isBookmarked: boolean;
}

export type BookmarkRowModel =
  | (BookmarkRowBase & {
      type: 'case';
      /** The source heading, verbatim, for the `title` attribute. */
      rawTitle: string;
      citation: string | null;
      judgmentDate: string | null;
    })
  | (BookmarkRowBase & {
      type: 'statute';
      /** The short designation ("Act 459") — practitioners cite both. */
      shortTitle: string | null;
      year: number;
      status: StatuteStatus;
      statusLabel: string;
    })
  | (BookmarkRowBase & {
      type: 'note';
      author: string | null;
      /** PLAIN text only — nothing on this page is ever handed to the browser
       *  as HTML. */
      preview: string | null;
    })
  | (BookmarkRowBase & {
      type: 'folder';
      itemsCount: number;
      childrenCount: number;
      /** The folder's own colour, used to tint its icon tile. */
      color: string | null;
    });

/**
 * The statute status label. The bookmarks payload carries `status` but NOT the
 * `status_label` the statute library reads, so the label is derived from the
 * enum here — a `Record` over the union rather than a string-capitalise, so a
 * new status is a compile error instead of a mis-cased word.
 */
const STATUTE_STATUS_LABEL: Record<StatuteStatus, string> = {
  active: 'Active',
  amended: 'Amended',
  repealed: 'Repealed',
};

/**
 * Map one bookmark to its row, or `null` for a type this build does not know.
 *
 * TWO GUARANTEES, ONE PER PHASE. At COMPILE time the `switch` is exhaustive
 * over the discriminant, so adding a fifth type to `types/bookmark.ts` without
 * handling it here is a type error (the new member reaches the `default` and
 * the declared return type forces it to be dealt with). At RUN time the
 * `default` catches the case the compiler cannot: a type the SERVER already
 * ships and this build has never heard of. That row is dropped by the caller
 * rather than rendered as `undefined` — one missing item, not a broken page.
 */
export function bookmarkRow(bookmark: Bookmark): BookmarkRowModel | null {
  const base = {
    bookmarkId: bookmark.id,
    contentId: bookmark.content.id,
    savedAt: bookmark.created_at,
    isBookmarked: bookmark.content.is_bookmarked,
  };

  switch (bookmark.type) {
    case 'case': {
      const content = bookmark.content;
      const raw = content.display_title || content.title;
      return {
        ...base,
        type: 'case',
        href: `/cases/${content.slug}`,
        // The same readable-name treatment the cases library gives its rows, so
        // a case reads identically wherever it appears (the all-caps source
        // heading stays on the `title` attribute).
        title: formatCaseName(raw),
        rawTitle: raw,
        citation: firstCitation(content.citation),
        judgmentDate: content.judgment_date,
      };
    }

    case 'statute': {
      const content = bookmark.content;
      return {
        ...base,
        type: 'statute',
        href: `/statutes/${content.slug}`,
        title: content.title,
        shortTitle:
          content.short_title && content.short_title !== content.title
            ? content.short_title
            : null,
        year: content.year,
        status: content.status,
        // `?? content.status` mirrors the defensive `default` branch in
        // `statuteStatusTone`: if the corpus ever carries a status outside the
        // enum, the mark shows that raw word rather than an empty label.
        statusLabel: STATUTE_STATUS_LABEL[content.status] ?? content.status,
      };
    }

    case 'note': {
      const content = bookmark.content;
      return {
        ...base,
        type: 'note',
        // Notes are not rebuilt yet, so the row hands off to the v1 screen —
        // the accepted strangler shape (v2 shell, v1 content) until they are.
        href: `/notes/${content.slug}`,
        title: content.title,
        author: content.user?.name?.trim() || null,
        preview: notePreview(content.content_preview, content.content_preview_html),
      };
    }

    case 'folder': {
      const content = bookmark.content;
      return {
        ...base,
        type: 'folder',
        href: folderHref(content.uuid),
        title: content.name,
        itemsCount: content.items_count ?? 0,
        childrenCount: content.children_count ?? 0,
        color: content.color,
      };
    }

    // A bookmark type the backend ships and this build does not model. TS proves
    // this is unreachable for every type in the union today; the branch exists
    // for the day that stops being true on the wire before it does in the repo.
    default:
      return null;
  }
}

/**
 * The v1 folder route, or `null`.
 *
 * The guard is not defensive noise: `types/bookmark.ts` declares `uuid: string`
 * from documentation, not from an observed payload, and the one thing this
 * screen must never reproduce is v1's `/folders/undefined`. A type is a
 * promise about a shape; this is the check that the promise was kept.
 */
function folderHref(uuid: string | null | undefined): string | null {
  const trimmed = uuid?.trim();
  return trimmed ? `/folders/${trimmed}` : null;
}

/**
 * The note's preview line, as PLAIN TEXT.
 *
 * The API sends the preview twice: `content_preview` (already plain, already
 * truncated) and `content_preview_html` (the same text as markup). The plain
 * field is preferred precisely because it needs no parsing; the HTML field is
 * only ever a fallback, and it is reduced to text — never rendered as markup.
 * There is no `dangerouslySetInnerHTML` anywhere in this feature, so the
 * degradation is one-way and a note's markup can never reach the browser as
 * markup.
 */
function notePreview(
  plain: string | null | undefined,
  html: string | null | undefined,
): string | null {
  const direct = plain?.trim();
  if (direct) return direct;
  const derived = html ? htmlToText(html) : '';
  return derived || null;
}

/**
 * Strip markup to text. Tags become spaces (so `<p>a</p><p>b</p>` reads "a b",
 * not "ab"), the five HTML-significant entities plus `&nbsp;` are decoded, and
 * whitespace is collapsed. Pure string work — no DOM, so it is identical on the
 * server and in the browser, and the result is only ever rendered as a React
 * text child.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    // Ampersand LAST, so a doubly-encoded entity cannot be resurrected into a
    // live one by an earlier pass.
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The accessible name for a row's unsave control. One place, so the four types
 * cannot drift into four different phrasings.
 */
export const BOOKMARK_TYPE_NOUN: Record<BookmarkType, string> = {
  case: 'case',
  statute: 'statute',
  note: 'note',
  folder: 'folder',
};
