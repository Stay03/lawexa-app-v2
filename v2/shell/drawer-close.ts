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
 * "UP" IS THE SHOWN PATH CHANGING. `useShownPathname` (move-first.tsx) is the
 * router's pathname, or the tap's destination while a move-first frame shows,
 * so it changes in the tap's own commit for a chat row (the frame is the
 * screen) and at the route's commit for every other row. Either way the
 * drawer waits one more painted frame (`afterPaint`) before it starts to
 * leave, so what it uncovers is already drawn.
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
