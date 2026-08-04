/**
 * app-badge — the app-level rollup surfaces: `document.title` "(n)" prefix,
 * favicon dot overlay, and `navigator.setAppBadge` (feature-detected; works on
 * installed PWAs, iOS 16.4+). Spec: plan W1 item 4 / foundation-standards §5
 * "Rollups". `n` is the total unread @mention count (mentions only — the
 * numeric badge never counts plain unreads, design-research DIRECTION 2), and
 * it is DERIVED from the spaces-list cache by the spine; this module only
 * renders a number it is handed.
 *
 * RESTORE-CLEAN IS THE HARD REQUIREMENT: at zero the title loses its prefix,
 * the favicon returns to the original file, and the OS badge clears — with no
 * residue after the spine unmounts ({@link resetAppBadge}).
 *
 * THE TITLE FIGHTS BACK, BY DESIGN: Next rewrites `document.title` on every
 * navigation, which would silently strip the prefix. A MutationObserver on the
 * `<title>` element re-asserts it. Loop-safe because {@link syncTitle} is
 * IDEMPOTENT — it writes only when the title differs from the desired form, so
 * the observer's own re-assert settles in exactly one extra pass and a correct
 * title triggers no write at all.
 *
 * AND SOMETIMES IT REPLACES THE ELEMENT: a framework head update may swap the
 * `<title>` NODE rather than mutate its text, which would orphan the observer
 * on a detached element (audit W1-M4). A second, head-level childList observer
 * watches for that identity change and re-attaches + re-asserts. It acts ONLY
 * when the title element changed, so unrelated head churn (icon links, meta)
 * costs one comparison and no writes.
 *
 * The favicon dot is BRAND GOLD, not red: red is reserved for failure /
 * destructive (design-research DIRECTION 2 — "no red counts anywhere").
 */

const TITLE_PREFIX_RE = /^\(\d+\)\s/;

/** Bright brand gold — matches the v1 theme-color and reads at 16×16. */
const DOT_COLOR = '#C9A227';

let mentionTotal = 0;
let titleObserver: MutationObserver | null = null;
/** The element `titleObserver` is attached to — re-attach when it changes. */
let observedTitle: HTMLTitleElement | null = null;
let headObserver: MutationObserver | null = null;
/** Original hrefs of the icon links we overrode, for the zero-state restore. */
let faviconOriginals: Map<HTMLLinkElement, string> | null = null;

function desiredTitle(): string {
  const bare = document.title.replace(TITLE_PREFIX_RE, '');
  return mentionTotal > 0 ? `(${mentionTotal}) ${bare}` : bare;
}

function syncTitle(): void {
  const next = desiredTitle();
  if (document.title !== next) document.title = next;
}

function ensureTitleObserver(): void {
  const titleElement = document.querySelector('title');
  if (titleElement && titleElement !== observedTitle) {
    titleObserver?.disconnect();
    titleObserver = new MutationObserver(syncTitle);
    titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    observedTitle = titleElement;
  }
  if (!headObserver) {
    headObserver = new MutationObserver(() => {
      // Re-attach only on an identity change (module docblock, audit W1-M4).
      if (document.querySelector('title') !== observedTitle) {
        ensureTitleObserver();
        syncTitle();
      }
    });
    headObserver.observe(document.head, { childList: true });
  }
}

/** The document's icon links (`rel="icon"` and `rel="shortcut icon"`). */
function faviconLinks(): HTMLLinkElement[] {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
  );
}

function applyFavicon(): void {
  const links = faviconLinks();
  if (links.length === 0) return;
  const originals = (faviconOriginals ??= new Map(
    links.map((link) => [link, link.href]),
  ));

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return;

  const finish = (): void => {
    context.beginPath();
    context.arc(size * 0.72, size * 0.72, size * 0.26, 0, Math.PI * 2);
    context.fillStyle = DOT_COLOR;
    context.fill();
    const href = canvas.toDataURL('image/png');
    // Guard against a zero racing an in-flight image load: only commit the
    // overlay while there is still something to badge.
    if (mentionTotal === 0) return;
    for (const link of originals.keys()) link.href = href;
  };

  const source = originals.values().next().value ?? null;
  if (!source) {
    finish();
    return;
  }
  const image = new Image();
  image.onload = () => {
    try {
      context.drawImage(image, 0, 0, size, size);
    } catch {
      // Undecodable / tainted icon — the dot-only overlay still signals.
    }
    finish();
  };
  image.onerror = () => finish();
  image.src = source;
}

function restoreFavicon(): void {
  if (!faviconOriginals) return;
  for (const [link, href] of faviconOriginals) link.href = href;
  // Drop the map so the next apply re-captures fresh links (Next may have
  // replaced the head elements in between).
  faviconOriginals = null;
}

function syncOsBadge(): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  // Both calls can reject when the app isn't installed — silence is correct.
  if (mentionTotal > 0) {
    void nav.setAppBadge?.(mentionTotal)?.catch(() => undefined);
  } else {
    void nav.clearAppBadge?.()?.catch(() => undefined);
  }
}

/**
 * Render the app-level mention total across title, favicon and OS badge.
 * Idempotent; safe to call on every derivation.
 */
export function setAppMentionBadge(total: number): void {
  if (typeof document === 'undefined') return;
  mentionTotal = Math.max(0, Math.floor(total));
  ensureTitleObserver();
  syncTitle();
  if (mentionTotal > 0) applyFavicon();
  else restoreFavicon();
  syncOsBadge();
}

/**
 * Full teardown for the spine's unmount: zero everything AND disconnect the
 * title observer so nothing of the badge machinery outlives its owner.
 */
export function resetAppBadge(): void {
  if (typeof document === 'undefined') return;
  mentionTotal = 0;
  titleObserver?.disconnect();
  titleObserver = null;
  observedTitle = null;
  headObserver?.disconnect();
  headObserver = null;
  syncTitle();
  restoreFavicon();
  syncOsBadge();
}
