/**
 * The pop-up's picture strip, as numbers: which picture shows for a scroll
 * position, and where the strip goes to show one. Each picture is the strip's
 * full width.
 */

/** The picture that shows at this scroll position, kept between the first and the last. */
export function slideAt(scrollLeft: number, width: number, count: number): number {
  if (count <= 0 || width <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)));
}

/** Where the strip scrolls to show picture `index` (kept between the first and the last). */
export function slideOffset(index: number, width: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index)) * width;
}
