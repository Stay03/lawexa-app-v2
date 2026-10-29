/**
 * The tick column at the start of a file list's rows (Arthur, 29 October
 * 2026, 07:05Z, thread 8aa04be0: "put the ticks to the left of the items").
 * A narrow column before each row's icon, and before the list head's "Name".
 *
 * Where the pointer can hover, the column is always there, so nothing moves
 * when a row's circle shows on hover. On a touch screen it is there only
 * while the list is being ticked; Select stays the way in.
 */

/** The column's width, shared by the rows, the list head and the skeleton. */
export const TICK_GUTTER_WIDTH = 'w-8';

/** The column's display: always while ticking, else only where the pointer can hover. */
export function tickGutterClass(selecting: boolean): string {
  return selecting ? 'flex' : 'hidden [@media(hover:hover)]:flex';
}

/**
 * The circle's visibility. While ticking every row shows its circle, so the
 * reader can keep ticking down the left edge without hovering. Before that a
 * row's circle shows on the row's hover or focus.
 */
export function tickCircleClass(selecting: boolean): string {
  return selecting
    ? 'opacity-100'
    : 'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100';
}
