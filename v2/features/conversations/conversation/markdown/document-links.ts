/**
 * document-links — which links in an answer are OUR statute pages, and where in
 * the statute they point (Stay, 18 October 2026, 14:32 UTC: a link in the
 * statute chat to the same statute "is suppose to jump to that part of the page
 * instead it reloads the page").
 *
 * WHAT THE ANSWERS CARRY. The API hands the model absolute section links,
 * `{FRONTEND_URL}/statutes/{slug}/section-{num}` (`StatuteTextSearchService::
 * sectionUrl`), or the statute itself when the number is not plain; no hash, no
 * query. A link the model writes from `read_statute` has no URL from the API,
 * so its shape can vary: the matcher also takes a relative path and a
 * `#akn-…` anchor.
 *
 * WHOSE LINK IT IS. A relative `/statutes/…` path; an absolute one on the page's
 * own origin (read at tap time, so whatever `FRONTEND_URL` is set to in a
 * deployment matches); or lawexa.com / www.lawexa.com. A foreign site with a
 * `/statutes/` segment of its own is never taken over.
 */

/** Hosts whose `/statutes/…` links are our statute pages, whatever the page's own origin. */
const OWN_HOSTS = new Set(['lawexa.com', 'www.lawexa.com']);

/** Path-anchored: `/statutes/{slug}` and `/statutes/{slug}/{provision}`, nothing deeper. */
const STATUTE_PATH = /^\/statutes\/([^/?#]+)(?:\/([^/?#]+))?\/?$/;

export interface StatuteLinkTarget {
  slug: string;
  /** The citation segment, `section-54-2`, else null. */
  provision: string | null;
  /** An exact element id from the hash (`akn-…`), else null. */
  anchor: string | null;
  /** Where an in-app navigation goes: the path, its query and its hash. */
  href: string;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment).trim();
  } catch {
    return segment.trim();
  }
}

/**
 * Pure: the statute page an answer's link points to, or null when it is not one
 * of ours. `pageOrigin` is `window.location.origin` at the tap (null where
 * there is no window, which leaves only the relative and own-host forms).
 */
export function statuteLinkTarget(href: string | undefined, pageOrigin: string | null): StatuteLinkTarget | null {
  if (!href) return null;
  let url: URL;
  if (href.startsWith('/') && !href.startsWith('//')) {
    url = new URL(href, 'https://lawexa.com');
  } else {
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.origin !== pageOrigin && !OWN_HOSTS.has(url.hostname)) return null;
  }
  const match = STATUTE_PATH.exec(url.pathname);
  if (!match) return null;
  const slug = decodeSegment(match[1]);
  if (!slug) return null;
  const provision = match[2] ? decodeSegment(match[2]).toLowerCase() || null : null;
  const anchor = url.hash.length > 1 ? decodeSegment(url.hash.slice(1)) || null : null;
  return {
    slug,
    provision,
    anchor,
    href: `${url.pathname}${url.search}${url.hash}`,
  };
}
