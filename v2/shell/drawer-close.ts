/**
 * drawer-close — WHEN the navigation drawer closes after a tap on one of its
 * rows (Stay, 22 October 2026: "when I select an option from the sidebar and
 * it's taking me to the page the sidebar closes weird").
 *
 * Every row closed the drawer in the same click that started the route
 * change. The new screen's commit then held the main thread, so the drawer's
 * exit stalled part way, cut, and a near-empty frame showed before the new
 * screen painted. Now a row for ANOTHER page leaves the drawer open: the
 * navigation starts under it, and the drawer closes once that page is up, so
 * it slides away over the screen the reader asked for. A row for the page
 * already on screen closes it at once, as before.
 *
 * "UP" IS THE SHOWN PATH CHANGING, AND THEN SOMETHING NEW ON SCREEN.
 * `useShownPathname` (move-first.tsx) is the router's pathname, or the tap's
 * destination while a move-first frame shows, so it changes in the tap's own
 * commit for a chat row and at the route's commit for every other row. A
 * route's commit is NOT its first picture: on a first visit Next commits the
 * new address before the page, or even its loading rows, has drawn anything
 * (Tester's live check, 22 October 2026: Notes showed the top bar alone from
 * about 0.12 to 0.39 s while the drawer slid away over it). So after the path
 * changes the drawer watches the shell's content area frame by frame
 * (`afterContentDraws`) and leaves one painted frame after it shows something
 * that was not there at the tap (`contentChanged`): a loading row, or visible
 * text. What was on screen at the tap is read then (`readContent`), so the old
 * page still mounted under the route change never counts, and neither does a
 * line only a screen reader gets (the v2 root's empty loading boundary says
 * "Loading page" that way). The first version counted any text in the area,
 * and that passed at once on the old page's (Tester, live, 23 October 2026).
 *
 * A CAP, SO IT CAN NEVER HANG, SET FROM THE LIVE NUMBERS. Whatever happens the
 * drawer slides `DRAWER_CLOSE_CAP_MS` after the tap: live, Notes' loading rows
 * drew at about 0.39 s on a first visit, so 450 ms covers a normal first visit
 * and bounds a slow one (techlead, 23 October 2026: one rule, a fixed hold or
 * the new page on screen, whichever comes first).
 *
 * The decisions are pure functions, so they are tested here; the drawer holds
 * the armed close in a ref and the cap in a timer (V2Drawer.tsx), and never
 * sets state in the click, which is the task the destination's first frame
 * paints in.
 */

/** How long a tapped row may keep the drawer open before it closes anyway. */
export const DRAWER_CLOSE_CAP_MS = 450;

/** What the content area shows: its visible text, and how many loading rows. */
export interface ContentSnapshot {
  readonly text: string;
  readonly skeletons: number;
}

/** A row's tap that is leaving the shown page: the drawer stays open until
 *  the shown path changes and something new is on screen, or the cap. */
export interface ArmedDrawerClose {
  /** The shown path at the tap. The destination is up once it differs. */
  readonly from: string;
  /** What the content area showed at the tap: the old page. */
  readonly before: ContentSnapshot;
}

export type DrawerCloseSignal =
  /** A row was tapped: `href` is where it goes, `pathname` the shown path. */
  | { kind: 'tap'; href: string; pathname: string }
  /** The shown path is now `pathname`: a route commit, or a move-first frame. */
  | { kind: 'shown'; pathname: string }
  /** The cap's timer fired. */
  | { kind: 'cap' };

export type DrawerCloseStep =
  /** Close now. */
  | 'close'
  /** Watch the content area, and close a painted frame after it changes. */
  | 'close-after-paint'
  /** Keep the drawer open, remember the tap and start the cap. */
  | 'arm'
  /** Nothing to do. */
  | 'wait';

/** What the drawer does on `signal`, given the tap it is holding, if any. */
export function drawerCloseStep(armed: ArmedDrawerClose | null, signal: DrawerCloseSignal): DrawerCloseStep {
  switch (signal.kind) {
    case 'tap':
      return pathOf(signal.href) === signal.pathname ? 'close' : 'arm';
    case 'shown':
      return armed !== null && signal.pathname !== armed.from ? 'close-after-paint' : 'wait';
    case 'cap':
      return armed !== null ? 'close' : 'wait';
  }
}

/** The path of an in-app href, as `useShownPathname` reports one. Parsed
 *  against a fixed base, so a relative href and an absolute one compare alike. */
export function pathOf(href: string): string {
  return new URL(href, 'http://x').pathname;
}

/** Runs `fn` after the next painted frame: an animation frame, then a task,
 *  the order move-first.tsx starts a navigation in. Returns the cancel. */
export function afterPaint(fn: () => void): () => void {
  let task = 0;
  const frame = window.requestAnimationFrame(() => {
    task = window.setTimeout(fn, 0);
  });
  return () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(task);
  };
}

/** Nothing on screen: what a missing content area reads as. */
export const EMPTY_CONTENT: ContentSnapshot = { text: '', skeletons: 0 };

/**
 * Whether the content area shows something the tap did not see: more loading
 * rows than then (shadcn's `Skeleton`, a page's first picture), or visible
 * text that differs from the old page's. The same text as at the tap is the
 * old page still mounted, so it does not count.
 */
export function contentChanged(before: ContentSnapshot, now: ContentSnapshot): boolean {
  if (now.skeletons > before.skeletons) return true;
  return now.text.length > 0 && now.text !== before.text;
}

/** A loading skeleton, by the slot shadcn's `Skeleton` stamps. */
const SKELETON = '[data-slot="skeleton"]';

/** Text a reader does not see: a screen-reader line, or a hidden subtree. */
const UNSEEN = '.sr-only, [hidden], [aria-hidden="true"]';

/**
 * What the content area shows now (`ContentSnapshot`): the text of its laid
 * out, visible nodes, whitespace collapsed, and its loading rows. A missing
 * area reads as empty.
 */
export function readContent(region: HTMLElement | null): ContentSnapshot {
  if (!region) return EMPTY_CONTENT;
  let text = '';
  const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest(UNSEEN)) continue;
    const box = parent.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    text += node.textContent ?? '';
  }
  return { text: text.replace(/\s+/g, ' ').trim(), skeletons: region.querySelectorAll(SKELETON).length };
}

/**
 * Runs `fn` one painted frame after `read()` first shows something new against
 * `before` (`contentChanged`), checking once per animation frame. Returns the
 * cancel. The drawer's cap (`DRAWER_CLOSE_CAP_MS`) bounds the wait from outside.
 *
 * ALREADY DRAWN, IT GOES AT ONCE. A page already in the router's cache is
 * drawn by the time the address changes (Notes, then Cases, then Notes again:
 * the list was on screen at about 0.12 s, live). The first check runs then,
 * in the same frame, and `fn` follows on a microtask rather than waiting a
 * frame and a paint (Tester, live, 23 October 2026: the drawer waited for its
 * cap there, until 0.56 s).
 */
export function afterContentDraws(
  read: () => ContentSnapshot,
  before: ContentSnapshot,
  fn: () => void,
): () => void {
  let frame = 0;
  let cancelPaint: (() => void) | null = null;
  let cancelled = false;
  if (contentChanged(before, read())) {
    queueMicrotask(() => {
      if (!cancelled) fn();
    });
    return () => {
      cancelled = true;
    };
  }
  const check = () => {
    if (contentChanged(before, read())) {
      cancelPaint = afterPaint(fn);
      return;
    }
    frame = window.requestAnimationFrame(check);
  };
  frame = window.requestAnimationFrame(check);
  return () => {
    window.cancelAnimationFrame(frame);
    cancelPaint?.();
  };
}
