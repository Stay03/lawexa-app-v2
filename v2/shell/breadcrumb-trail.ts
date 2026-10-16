import {
  formatProvisionLabel,
  parseProvisionSegment,
} from '@/v2/features/statutes/reader/provision';

/**
 * breadcrumb-trail — where the reader is, as the parts the desktop bar prints
 * from `md:` up (Arthur, 16 October 2026: "I think it's good", on the mock-ups
 * of the trail on a space, a chat in a space, a statute and a case).
 *
 *   /spaces/{uuid}                  Spaces › {space} › {tab}
 *   /c/{id}, in a space             Spaces › {space} › {chat title}
 *   /statutes/{slug}                Library › Statutes › {statute}
 *   /statutes/{slug}/section-N      Library › Statutes › {statute} › {section}
 *   /cases/{slug}                   Library › Cases › {case}
 *
 * Every other address has no trail and keeps the bar it had, a personal chat
 * included: it is not anywhere but the chats list, which the rail already
 * names.
 *
 * ── THE ROUTE DECIDES WHETHER, THE DATA DECIDES WHAT ───────────────────────
 * Whether there is a trail is read off the address, as `pushed-route.ts`
 * reads the back control, so the bar's shape is the same on the server render
 * and every paint after it. The one exception is a chat, which only its record
 * can place in a space: until the record says so it keeps today's bar.
 *
 * ── A LABEL NOT KNOWN YET IS `null`, NEVER A GUESS ─────────────────────────
 * The names arrive late (a query, a published title), and the component draws
 * a text skeleton for a `null` label. Nothing here invents a stand-in: a
 * space's tab before the space has loaded could be any of five. The one label
 * the address does know is the section number ("Section 54"), so that one is
 * printed from the first paint and the heading joins it when the document has
 * parsed.
 *
 * "Library" is a heading and not a link, because there is no Library page.
 *
 * No JSX and no hooks, so it runs under `node:test` as it is.
 */

/** One part of the trail. Every part but the last has an `href`. */
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
  /** The space a chat is in (`header-place.ts`), or `null` for a personal chat. */
  chatSpace: { label: string; href: string } | null;
  caseTitle: string | null;
  statuteTitle: string | null;
  /** The resolved section, "Section 1 · Application". The address's own
   *  "Section 1" stands in until it is known. */
  sectionLabel: string | null;
}

export const NO_BREADCRUMB_DATA: BreadcrumbData = {
  spaceName: null,
  tabLabel: null,
  chatTitle: null,
  chatSpace: null,
  caseTitle: null,
  statuteTitle: null,
  sectionLabel: null,
};

/** Which kind of trail an address can carry, and the keys its data is read by. */
export type TrailRoute =
  | { kind: 'space'; spaceUuid: string }
  | { kind: 'chat'; conversationId: string }
  | { kind: 'statute'; slug: string; provision: string | null }
  | { kind: 'case'; slug: string }
  | { kind: 'none' };

export const NO_TRAIL_ROUTE: TrailRoute = { kind: 'none' };

const V2_PREFIX = '/v2';

/** The trail kind of `pathname`. Pure; accepts either address form. */
export function trailRouteFor(pathname: string): TrailRoute {
  const path = pathname.startsWith(`${V2_PREFIX}/`)
    ? pathname.slice(V2_PREFIX.length)
    : pathname;
  const segments = path.split('/').filter(Boolean);
  const [head, key, ...rest] = segments;
  if (!key) return NO_TRAIL_ROUTE;
  if (head === 'spaces' && rest.length === 0 && key !== 'discover') {
    return { kind: 'space', spaceUuid: key };
  }
  if (head === 'c' && rest.length === 0) return { kind: 'chat', conversationId: key };
  if (head === 'cases' && rest.length === 0) return { kind: 'case', slug: key };
  if (head === 'statutes' && rest.length <= 1) {
    // A segment that is not a citation is the statute itself, with the
    // reader's own "points to no provision" notice under it. Deeper is a 404.
    const provision = rest[0] && parseProvisionSegment(rest[0]) ? rest[0] : null;
    return { kind: 'statute', slug: key, provision };
  }
  return NO_TRAIL_ROUTE;
}

const SPACES: CrumbPart = { label: 'Spaces', href: '/spaces' };
const LIBRARY: CrumbPart = { label: 'Library' };
const STATUTES: CrumbPart = { label: 'Statutes', href: '/statutes' };
const CASES: CrumbPart = { label: 'Cases', href: '/cases' };

/**
 * The trail for `pathname`, or `null` where the bar keeps its old left label.
 * Whether it is `null` depends on the address and, for a chat, on
 * `data.chatSpace` alone, so the header can ask before any name is known.
 */
export function breadcrumbTrail(
  pathname: string,
  data: BreadcrumbData,
): BreadcrumbTrail | null {
  const route = trailRouteFor(pathname);
  switch (route.kind) {
    case 'space':
      return {
        parts: [
          SPACES,
          { label: data.spaceName, href: `/spaces/${route.spaceUuid}` },
          { label: data.tabLabel },
        ],
      };
    case 'chat':
      if (data.chatSpace === null) return null;
      return {
        parts: [
          SPACES,
          { label: data.chatSpace.label, href: data.chatSpace.href },
          { label: data.chatTitle },
        ],
      };
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
    case 'none':
      return null;
  }
}
