import {
  formatProvisionLabel,
  parseProvisionSegment,
} from '@/v2/features/statutes/reader/provision';

/**
 * breadcrumb-trail — where the reader is, as the parts the desktop bar prints
 * from `md:` up (Arthur, 16 October 2026: "I think it's good", on the mock-ups
 * of the trail on a space, a chat in a space, a statute and a case; the rest of
 * the approved proposal followed the same day).
 *
 *   /spaces/{uuid}                  Spaces › {space} [› {pill}]
 *   /spaces/discover                Spaces › Find a space
 *   /channels/{uuid}                Spaces › {space} › # {channel}
 *   /c/{id}, in a space             Spaces › {space} › {chat title}
 *   /c/{id}, not in a space         Conversations › {chat title}
 *   /statutes/{slug}                Library › Statutes › {statute}
 *   /statutes/{slug}/section-N      Library › Statutes › {statute} › {section}
 *   /cases/{slug}                   Library › Cases › {case}
 *   /folders/{uuid}                 Library › Folders › [{parent} ›] {folder}
 *   /notes/{slug}                   Library › Notes › {note}
 *
 * Every other address has no trail and keeps the bar it had.
 *
 * ── THE ROUTE DECIDES WHETHER, THE DATA DECIDES WHAT ───────────────────────
 * Whether there is a trail is read off the address, as `pushed-route.ts`
 * reads the back control, so the bar's shape is the same on the server render
 * and every paint after it. What the parts say comes from the data, and two
 * routes only learn their shape from it: a chat learns whether it is in a
 * space, and a folder whether it has a parent.
 *
 * ── A LABEL NOT KNOWN YET IS `null`, NEVER A GUESS ─────────────────────────
 * The names arrive late (a query, a published title), and the component draws
 * a text skeleton for a `null` label. Nothing here invents a stand-in: a
 * space's tab before the space has loaded could be any of five, and a chat not
 * yet placed could be in a space or not, so its first part is a skeleton too.
 * The one label the address does know is the section number ("Section 54"),
 * so that one is printed from the first paint and the heading joins it when
 * the document has parsed. A folder shows the one parent its payload carries,
 * never a guessed deeper chain.
 *
 * "Library" is a heading and not a link, because there is no Library page.
 *
 * No JSX and no hooks, so it runs under `node:test` as it is.
 */

/** One part of the trail. Every named part but the last has an `href`. */
export interface CrumbPart {
  /** `null` while the name is still on its way: drawn as a skeleton. */
  label: string | null;
  href?: string;
}

export interface BreadcrumbTrail {
  parts: readonly CrumbPart[];
}

/** What the screens have published or cached so far. Each is `null` until known. */
export interface BreadcrumbData {
  spaceName: string | null;
  tabLabel: string | null;
  chatTitle: string | null;
  /** The space a chat is in (`header-place.ts`), or `null`. */
  chatSpace: { label: string; href: string } | null;
  /** `true` once the chat is known to be in no space; `false` while unknown. */
  chatIsPersonal: boolean;
  /** The channel's display name, without the `#`. */
  channelName: string | null;
  /** A thread is named by its title, which takes no `#`. */
  channelIsThread: boolean;
  channelSpaceUuid: string | null;
  channelSpaceName: string | null;
  caseTitle: string | null;
  statuteTitle: string | null;
  /** The resolved section, "Section 1 · Application". The address's own
   *  "Section 1" stands in until it is known. */
  sectionLabel: string | null;
  folderName: string | null;
  /** The one parent the folder's payload carries, or `null`. */
  folderParent: { uuid: string; name: string } | null;
  noteTitle: string | null;
}

export const NO_BREADCRUMB_DATA: BreadcrumbData = {
  spaceName: null,
  tabLabel: null,
  chatTitle: null,
  chatSpace: null,
  chatIsPersonal: false,
  channelName: null,
  channelIsThread: false,
  channelSpaceUuid: null,
  channelSpaceName: null,
  caseTitle: null,
  statuteTitle: null,
  sectionLabel: null,
  folderName: null,
  folderParent: null,
  noteTitle: null,
};

/** Which kind of trail an address can carry, and the keys its data is read by. */
export type TrailRoute =
  | { kind: 'space'; spaceUuid: string }
  | { kind: 'discover' }
  | { kind: 'channel'; channelUuid: string }
  | { kind: 'chat'; conversationId: string }
  | { kind: 'statute'; slug: string; provision: string | null }
  | { kind: 'case'; slug: string }
  | { kind: 'folder'; uuid: string }
  | { kind: 'note'; slug: string }
  | { kind: 'none' };

export const NO_TRAIL_ROUTE: TrailRoute = { kind: 'none' };

const V2_PREFIX = '/v2';

/** `/notes/{x}` addresses that are pages of their own, not a note. */
const NOTE_PAGES = new Set(['mine', 'create']);

/** The trail kind of `pathname`. Pure; accepts either address form. */
export function trailRouteFor(pathname: string): TrailRoute {
  const path = pathname.startsWith(`${V2_PREFIX}/`)
    ? pathname.slice(V2_PREFIX.length)
    : pathname;
  const segments = path.split('/').filter(Boolean);
  const [head, key, ...rest] = segments;
  if (!key) return NO_TRAIL_ROUTE;
  if (head === 'statutes' && rest.length <= 1) {
    // A segment that is not a citation is the statute itself, with the
    // reader's own "points to no provision" notice under it. Deeper is a 404.
    const provision = rest[0] && parseProvisionSegment(rest[0]) ? rest[0] : null;
    return { kind: 'statute', slug: key, provision };
  }
  if (rest.length > 0) return NO_TRAIL_ROUTE;
  switch (head) {
    case 'spaces':
      return key === 'discover' ? { kind: 'discover' } : { kind: 'space', spaceUuid: key };
    case 'channels':
      return { kind: 'channel', channelUuid: key };
    case 'c':
      return { kind: 'chat', conversationId: key };
    case 'cases':
      return { kind: 'case', slug: key };
    case 'folders':
      return { kind: 'folder', uuid: key };
    case 'notes':
      return NOTE_PAGES.has(key) ? NO_TRAIL_ROUTE : { kind: 'note', slug: key };
    default:
      return NO_TRAIL_ROUTE;
  }
}

const SPACES: CrumbPart = { label: 'Spaces', href: '/spaces' };
const CONVERSATIONS: CrumbPart = { label: 'Conversations', href: '/conversations' };
const LIBRARY: CrumbPart = { label: 'Library' };
const STATUTES: CrumbPart = { label: 'Statutes', href: '/statutes' };
const CASES: CrumbPart = { label: 'Cases', href: '/cases' };
const FOLDERS: CrumbPart = { label: 'Folders', href: '/folders' };
const NOTES: CrumbPart = { label: 'Notes', href: '/notes' };
/** The discover page's own heading (`DiscoverScreen`). */
const FIND_A_SPACE: CrumbPart = { label: 'Find a space' };

/**
 * The trail for `pathname`, or `null` where the bar keeps its old left label.
 * Whether it is `null` depends on the address alone, so the header can ask
 * before any name is known.
 */
export function breadcrumbTrail(
  pathname: string,
  data: BreadcrumbData,
): BreadcrumbTrail | null {
  const route = trailRouteFor(pathname);
  switch (route.kind) {
    case 'space':
      // An empty pill label is the All pill (design B4): the trail ends at the
      // space, which is then the current page and no link. `null` is a pill
      // not known yet, drawn as its skeleton.
      return {
        parts:
          data.tabLabel === ''
            ? [SPACES, { label: data.spaceName }]
            : [
                SPACES,
                { label: data.spaceName, href: `/spaces/${route.spaceUuid}` },
                { label: data.tabLabel },
              ],
      };
    case 'discover':
      return { parts: [SPACES, FIND_A_SPACE] };
    case 'channel': {
      const name = data.channelName;
      const space: CrumbPart = data.channelSpaceUuid
        ? { label: data.channelSpaceName, href: `/spaces/${data.channelSpaceUuid}` }
        : { label: null };
      const label = name === null || data.channelIsThread ? name : `# ${name}`;
      return { parts: [SPACES, space, { label }] };
    }
    case 'chat': {
      const title: CrumbPart = { label: data.chatTitle };
      if (data.chatSpace !== null) {
        return {
          parts: [SPACES, { label: data.chatSpace.label, href: data.chatSpace.href }, title],
        };
      }
      return { parts: [data.chatIsPersonal ? CONVERSATIONS : { label: null }, title] };
    }
    case 'statute': {
      const statute = route.provision
        ? { label: data.statuteTitle, href: `/statutes/${route.slug}` }
        : { label: data.statuteTitle };
      if (!route.provision) return { parts: [LIBRARY, STATUTES, statute] };
      const citation = parseProvisionSegment(route.provision);
      const fromAddress = citation ? formatProvisionLabel(citation) : null;
      return {
        parts: [LIBRARY, STATUTES, statute, { label: data.sectionLabel ?? fromAddress }],
      };
    }
    case 'case':
      return { parts: [LIBRARY, CASES, { label: data.caseTitle }] };
    case 'folder': {
      const folder: CrumbPart = { label: data.folderName };
      // The parent rides on the folder's own payload, so it is only known with
      // the name; before then the trail ends at the folder's skeleton.
      const parent = data.folderName !== null ? data.folderParent : null;
      return parent
        ? {
            parts: [
              LIBRARY,
              FOLDERS,
              { label: parent.name, href: `/folders/${encodeURIComponent(parent.uuid)}` },
              folder,
            ],
          }
        : { parts: [LIBRARY, FOLDERS, folder] };
    }
    case 'note':
      return { parts: [LIBRARY, NOTES, { label: data.noteTitle }] };
    case 'none':
      return null;
  }
}

/** What a screen's cache entry says, as the breadcrumb's disabled observer sees it. */
export interface CrumbRead {
  isError: boolean;
  hasData: boolean;
}

/**
 * Whether a read can still name its part. It cannot when the screen's request
 * was refused (a 403 or 404 with nothing cached) or was never made for this
 * visitor (`allowed`: the screen's own `enabled` gate, a signed-out reader on
 * a statute, say). The trail then draws nothing rather than a skeleton that
 * waits forever (checker, 16 October 2026). A failed refetch over a record the
 * screen still shows keeps its trail, as the screen keeps its page.
 */
export function crumbResolves(read: CrumbRead, allowed = true): boolean {
  return allowed && !(read.isError && !read.hasData);
}
