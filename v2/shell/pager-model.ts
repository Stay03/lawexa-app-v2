/**
 * pager-model — the pure half of `Pager`: which page numbers a numbered pager shows,
 * how a `?page=` value is read, and how the "Page 3 of 1,756" line reads. No
 * JSX, no hooks, so `pager-model.test.ts` covers all of it.
 *
 * ── THE SHAPE ──────────────────────────────────────────────────────────────
 * The first page, the last page, the current page with `siblings` pages either
 * side of it, and a gap wherever a run of pages is left out. A gap is drawn
 * only where it hides two or more pages: hiding one page behind "…" takes the
 * same room as printing it. So a long range is always `2 × siblings + 5` items
 * wide, wherever the reader is in it, and the pager never changes width as
 * they move through it.
 */

/** A page number, or a gap before (`gap-start`) or after (`gap-end`) the current pages. */
export type PagerItem = number | 'gap-start' | 'gap-end';

/**
 * The items of a numbered pager for page `current` of `last`, with `siblings`
 * pages either side of the current one. `current` is clamped into range; an
 * empty list (`last < 1`) has no items.
 */
export function pagerItems(current: number, last: number, siblings = 1): PagerItem[] {
  if (last < 1) return [];
  const page = Math.min(Math.max(current, 1), last);

  // Short enough to print every page: first, last, current, siblings, two gaps.
  if (last <= siblings * 2 + 5) return range(1, last);

  // The window of pages around the current one, pushed off the ends so it
  // always holds `2 × siblings + 1` pages and never touches page 1 or `last`.
  const start = Math.max(Math.min(page - siblings, last - siblings * 2 - 2), 3);
  const end = Math.min(Math.max(page + siblings, siblings * 2 + 3), last - 2);

  return [
    1,
    start > 3 ? 'gap-start' : 2,
    ...range(start, end),
    end < last - 2 ? 'gap-end' : last - 1,
    last,
  ];
}

/**
 * The page a `?page=` value asks for: a whole number from 1 up. Anything else
 * (missing, `0`, `-2`, `3.5`, `abc`, a number too large to be exact) is page 1,
 * so a hand-edited URL can never ask the server for a page that cannot exist.
 */
export function parsePageParam(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw.trim())) return 1;
  const page = Number(raw.trim());
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

const COUNT = new Intl.NumberFormat('en-GB');

/** A count with thousands separators: "35,115". */
export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** "Page 3 of 1,756". */
export function pageSummary(current: number, last: number): string {
  return `Page ${formatCount(current)} of ${formatCount(last)}`;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(to - from + 1, 0) }, (_, index) => from + index);
}
