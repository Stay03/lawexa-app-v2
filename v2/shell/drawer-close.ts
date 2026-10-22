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
 * "UP" IS THE SHOWN PATH CHANGING, AND THEN SOMETHING DRAWN. `useShownPathname`
 * (move-first.tsx) is the router's pathname, or the tap's destination while a
 * move-first frame shows, so it changes in the tap's own commit for a chat row
 * (the frame is the screen) and at the route's commit for every other row. A
 * route's commit is NOT its first picture, though: on a first visit Next
 * commits the new address before the page, or even its loading screen, has
 * drawn anything (Tester's live check, 22 October 2026: Notes showed the top
 * bar alone from about 0.12 to 0.39 s while the drawer slid away over it). So
 * after the path changes the drawer watches the shell's content area frame
 * by frame (`afterContentDraws`) and leaves one painted frame after it holds
 * text or a loading skeleton (`contentDrawn`), so what it uncovers is a page.
 *
 * A CAP, SO IT CAN NEVER HANG. A route that takes longer than
 * `DRAWER_CLOSE_CAP_MS` (a cold screen on a slow link) closes the drawer at
 * the cap over whatever is on screen, at worst the old page's loading state.
 *
 * The decision is a pure function, so it is tested here; the drawer holds
 * the armed close in a ref and the cap in a timer (V2Drawer.tsx), and never
 * sets state in the click, which is the task the destination's first frame
 * paints in.
 */

/** How long a tapped row may keep the drawer open before it closes anyway. */
export const DRAWER_CLOSE_CAP_MS = 600;

/** A row's tap that is leaving the shown page: the drawer stays open until
 *  the shown path changes, or the cap. */
export interface ArmedDrawerClose {
  /** The shown path at the tap. The destination is up once it differs. */
  readonly from: string;
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
  /** Close after the next painted frame. */
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

/** The part of an element `contentDrawn` reads, so it is tested without a DOM. */
export interface DrawnProbe {
  readonly textContent: string | null;
  querySelector(selector: string): unknown;
}

/** A loading skeleton (shadcn's `Skeleton`) counts as drawn: its rows are the
 *  page's first picture. */
const SKELETON = '[data-slot="skeleton"]';

/**
 * Whether the content area holds a page yet: any text, or a loading skeleton.
 * An empty area (the address committed, nothing drawn) is not; a missing area
 * counts as drawn, so the drawer never waits on something that cannot come.
 */
export function contentDrawn(region: DrawnProbe | null): boolean {
  if (!region) return true;
  if (region.querySelector(SKELETON)) return true;
  return (region.textContent ?? '').trim().length > 0;
}

/**
 * Runs `fn` one painted frame after `region` first holds a page
 * (`contentDrawn`), checking once per animation frame. Returns the cancel.
 * The drawer's cap (`DRAWER_CLOSE_CAP_MS`) bounds the wait from outside.
 */
export function afterContentDraws(region: HTMLElement | null, fn: () => void): () => void {
  let frame = 0;
  let cancelPaint: (() => void) | null = null;
  const check = () => {
    if (contentDrawn(region)) {
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
