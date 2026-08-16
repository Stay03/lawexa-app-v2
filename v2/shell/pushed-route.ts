/**
 * pushed-route — which screens you PUSHED INTO, decided by the address and
 * nothing else.
 *
 * ── THE GRAMMAR THIS EXISTS TO ENFORCE ─────────────────────────────────────
 * The owner studied the Claude and ChatGPT phone apps and settled the rule:
 *
 *   A TOP-LEVEL screen  hamburger on the left, the big title in the PAGE body,
 *                       nothing in the bar.
 *   A PUSHED screen     a back arrow on the left, a small title in the BAR, no
 *                       hamburger, and never a second title.
 *
 * Every screen in the v2 tree was breaking it: sixteen of them carried the
 * hamburger and no back at all, five printed their title twice, and five more
 * put an "up" chip in the body at y76 under a bar that already had one.
 *
 * ── WHY THE ADDRESS DECIDES, AND NOT A PUBLISHED SIGNAL ────────────────────
 * A screen that PUBLISHES "I am pushed" answers one paint too late, because a
 * publish rides an effect. The phone then shows the hamburger, then the back
 * arrow, with the title jumping between the bar and the page in between. That
 * is a filmed bug on this codebase already (`collab-header.ts` carries the
 * autopsy of `barOwner`, and `V2Header#screenOwnsPhoneBar` is the fix).
 *
 * Whether a screen is pushed is a FACT ABOUT THE ROUTE: `/cases/{slug}` always
 * is, `/cases` never is. So it is read off the pathname, synchronously, before
 * any request, and the answer is the same on the server render, the first
 * client paint and every paint after it.
 *
 * ── WHAT THE ADDRESS CANNOT KNOW ───────────────────────────────────────────
 * Two things, and only two:
 *
 *  1. The TITLE, where it is a fact about the data (a folder's name). That is
 *     {@link PushedTitle} kind `published`: the screen publishes it through
 *     `header-context.ts` exactly as it always did, and the bar draws it
 *     skeleton-first.
 *  2. The PARENT, where the reader came from a place the address does not name
 *     (a folder nested in another folder; a draft note that lives only in the
 *     My notes tab). That is `screen-context.ts`, which OVERRIDES the default
 *     below and is guarded by the pathname it was published for.
 *
 * Everything else is here, in one table, so no two screens can answer the same
 * question differently.
 *
 * ── THE COLLAB ROUTES ARE NOT IN THIS TABLE ────────────────────────────────
 * `/spaces/{uuid}` and `/channels/{uuid}` already have a richer published
 * context of their own (`v2/features/collab/shell/collab-header.ts`: a crest, a
 * space name, a thread's parent channel). `V2Header` treats them as pushed off
 * `parseCollabRoute`, and their back control and title stay where they are.
 * Duplicating them here would be two tables answering one question.
 */

/**
 * What the bar's centre carries on a pushed screen, below `md:`.
 *
 * At `md:` and up the bar's title is hidden and the PAGE shows its heading
 * instead: the reader meets exactly one title at every width. That split is the
 * same contract the channel screen already runs on (`PlaceHeader`'s `h1` is
 * `sr-only md:not-sr-only`, and the shell bar's collab centre is `md:hidden`).
 */
export type PushedTitle =
  /** The address knows the title. A screen name, never a record's name. */
  | { kind: 'fixed'; text: string }
  /** A fact about the DATA. The screen publishes it (`header-context.ts`) and
   *  the bar shimmers a title-shaped bar until it lands. */
  | { kind: 'published' }
  /**
   * NOTHING, deliberately.
   *
   * A document screen (a case, a statute, a note) opens with a masthead: the
   * title in the reading serif with the citation, the court, the date, the
   * author and the status badge under it. That block is the document's own
   * first page and cannot lose its heading without orphaning everything under
   * it. So the PAGE keeps the title and the bar carries none, which is the
   * owner's own second clause: "where the page keeps a big title for a real
   * reason, the bar must be empty".
   *
   * It also kills a bug outright. `/cases/{slug}` printed "SPDC v Ereba" in the
   * bar and "Spdc (nig.) Ltd v Ereba & Anor" in the page, 69px apart: two
   * different strings for one case, because the bar was fed `short_title` and
   * the page `display_title`. One title cannot disagree with itself.
   */
  | { kind: 'none' };

/** Frozen singletons, so a table entry never mints a new object per call. */
const NO_TITLE: PushedTitle = { kind: 'none' };
const PUBLISHED_TITLE: PushedTitle = { kind: 'published' };

function fixed(text: string): PushedTitle {
  return { kind: 'fixed', text };
}

export interface PushedScreen {
  /**
   * Where "up" goes. Always a REAL address: `useBackTo` keeps the control a
   * `<Link>` (middle-click, long-press preview, screen readers) and takes the
   * history move only when that address really is one step behind.
   */
  backHref: string;
  /**
   * The control's accessible name. It travels with `backHref` and must always
   * agree with it: a chevron labelled "Back to the space" whose address is the
   * spaces LIST is a lie told only to the readers who cannot see where it
   * points, and that exact lie shipped on `/spaces/{uuid}`.
   */
  backLabel: string;
  title: PushedTitle;
}

/**
 * The internal tree's prefix. The proxy rewrites `/cases/x` to `/v2/cases/x`,
 * so an opted-in reader normally sees the clean path, but a direct `/v2/...`
 * hit is allowed through with the cookie and `usePathname()` then returns the
 * prefixed form. Both must resolve to the same screen or the back control would
 * silently vanish on the internal address. Same guard as `parseCollabRoute`.
 */
const V2_PREFIX = '/v2';

function cleanSegments(pathname: string): string[] {
  const path = pathname.startsWith(`${V2_PREFIX}/`)
    ? pathname.slice(V2_PREFIX.length)
    : pathname;
  return path.split('/').filter(Boolean);
}

/**
 * The screen `pathname` names, or `null` when it is not a pushed screen.
 *
 * Pure, synchronous, and total: an address this table does not recognise gets
 * `null` and keeps the top-level chrome, which is the safe answer.
 */
export function pushedScreenFor(pathname: string): PushedScreen | null {
  const segments = cleanSegments(pathname);
  const depth = segments.length;
  if (depth === 0) return null;
  const [head, second, third] = segments;

  switch (head) {
    case 'cases':
      // The case itself, and the full judgment behind it. Both are documents,
      // so both keep their masthead and neither repeats it in the bar.
      if (depth === 2) {
        return {
          backHref: '/cases',
          backLabel: 'Back to cases',
          title: NO_TITLE,
        };
      }
      if (depth === 3 && third === 'report') {
        return {
          backHref: `/cases/${second}`,
          backLabel: 'Back to the case',
          title: NO_TITLE,
        };
      }
      return null;

    case 'statutes':
      // `/statutes/{slug}` and every citation path under it
      // (`/statutes/{slug}/section-54-2`) are ONE reader on one document, so
      // they are one screen with one way back. The bar used to say "Act 9"
      // while the page was headed with the Act's full name: two names for one
      // instrument, which is why the bar now says nothing.
      if (depth >= 2) {
        return {
          backHref: '/statutes',
          backLabel: 'Back to statutes',
          title: NO_TITLE,
        };
      }
      return null;

    case 'notes':
      if (depth === 2 && second === 'create') {
        return {
          backHref: '/notes?tab=mine',
          backLabel: 'Back to your notes',
          title: fixed('New note'),
        };
      }
      // A note is a document. `NoteScreen` overrides the address for a note the
      // reader owns, because a draft appears on no stream but My notes.
      if (depth === 2) {
        return {
          backHref: '/notes',
          backLabel: 'Back to notes',
          title: NO_TITLE,
        };
      }
      // Up out of the editor is the note you were reading, not the library.
      if (depth === 3 && third === 'edit') {
        return {
          backHref: `/notes/${second}`,
          backLabel: 'Back to the note',
          title: fixed('Edit note'),
        };
      }
      return null;

    case 'folders':
      // The name is the folder's own, so the screen publishes it. The ADDRESS
      // is overridden too when the folder is nested (see `FolderScreen`): the
      // library is the right default and the parent folder is the right answer.
      if (depth === 2) {
        return {
          backHref: '/folders',
          backLabel: 'Back to folders',
          title: PUBLISHED_TITLE,
        };
      }
      return null;

    case 'radars':
      if (depth === 2 && second === 'new') {
        return {
          backHref: '/radars',
          backLabel: 'Back to Radar',
          title: fixed('New radar'),
        };
      }
      return null;

    case 'quiz':
      if (depth === 2 && second === 'history') {
        return {
          backHref: '/quiz',
          backLabel: 'Back to Quiz',
          title: fixed('Quiz history'),
        };
      }
      if (depth === 2 && second === 'stats') {
        return {
          backHref: '/quiz',
          backLabel: 'Back to Quiz',
          title: fixed('Your progress'),
        };
      }
      return null;

    case 'spaces':
      // ONLY `discover`. `/spaces/{uuid}` is a collab route and keeps the
      // collab header's own back control and crest (see the file docblock).
      if (depth === 2 && second === 'discover') {
        return {
          backHref: '/spaces',
          backLabel: 'Back to your spaces',
          title: fixed('Find a space'),
        };
      }
      return null;

    // Neither of these has a parent in the navigation: an invitation arrives by
    // notification and an organization is reached from the invitation you
    // accepted. Home is the one place that is always behind them and is always
    // true, and `useBackTo` still takes the real history step whenever the
    // reader did come from somewhere.
    case 'invitations':
      if (depth === 1) {
        return {
          backHref: '/',
          backLabel: 'Back to home',
          title: fixed('Invitations'),
        };
      }
      return null;

    case 'organization':
      if (depth === 1) {
        return {
          backHref: '/',
          backLabel: 'Back to home',
          title: fixed('Organization'),
        };
      }
      return null;

    // The settings INDEX, and the options REBUILT IN v2. Every other address
    // under `/settings/` still falls through the proxy to v1, which wears its
    // own chrome, so this table must not answer for one: an entry here for a v1
    // page would promise a bar that never paints. A row joins this switch on
    // the day its route joins `v2/routes.manifest.ts`, and not before.
    //
    // The reference apps put a HAMBURGER on their settings screen, because
    // settings is top-level in their navigation. In ours it is opened from the
    // header's overflow menu, which makes it a screen you pushed into: back
    // arrow, title in the bar below `md:`, no hamburger. Home is the parent of
    // the index because the menu is on every screen, and `useBackTo` still
    // takes the real history step whenever the reader did come from somewhere.
    case 'settings':
      if (depth === 1) {
        return {
          backHref: '/',
          backLabel: 'Back to home',
          title: fixed('Settings'),
        };
      }
      // An option is always reached FROM the list of options, so the list is
      // where "up" goes. The title is fixed: a settings screen is named by its
      // address, never by the record it happens to be showing.
      if (depth === 2 && second === 'profile') {
        return {
          backHref: '/settings',
          backLabel: 'Back to settings',
          title: fixed('Profile'),
        };
      }
      return null;

    default:
      return null;
  }
}
