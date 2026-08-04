/**
 * stream-state — WHICH of the folder page's four stream states is true, as one
 * pure function.
 *
 * ── WHY THIS IS NOT FOUR BOOLEANS IN THE COMPONENT ──────────────────────────
 * It was, and it shipped a dead end. `showEmpty` read only the RENDERED row
 * count, so a v1-filled folder whose first page maps entirely to dropped types
 * (chats, folders-as-items) declared itself empty — and because the empty state
 * replaced the stream, the infinite-scroll SENTINEL was never mounted. That
 * hook bails on a null ref without changing its dependencies, so page two, the
 * one holding the real cases, could never be requested. The reader was told an
 * untruth AND locked out of the correction.
 *
 * A decision with that much consequence should be readable in one place and
 * checkable without a browser, so it lives here and the component renders what
 * it returns.
 *
 * ── WHAT "EMPTY" HAS TO MEAN ────────────────────────────────────────────────
 * "Nothing filed here yet" is a claim about the FOLDER, not about the current
 * page of a request. It may only be made when all four of these hold:
 *
 *   1. nothing is rendered (no items, and no subfolders on the All view);
 *   2. the query has settled — not pending, not erroring;
 *   3. the pagination says there is nothing further to fetch. While
 *      `hasNextPage` is true the honest shape is the loading one, which is also
 *      the shape that keeps the sentinel mounted so the next page can arrive;
 *   4. nothing was DROPPED. A folder holding three chats is not empty; it is a
 *      folder whose contents v2 does not render, and the hidden-items note is
 *      the true answer where "nothing here yet" is a false one.
 */

export interface FolderStreamInput {
  /** Rows the item mapper produced for the ACTIVE tab, after removals. */
  itemRowCount: number;
  /** Subfolder rows — only ever rendered on the All view. */
  childRowCount: number;
  /** Whether subfolders are part of the current view (the All tab). */
  showSubfolders: boolean;
  /** Items dropped by the mapper on the loaded pages, of every kind. */
  droppedCount: number;
  /** The items query. */
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

export interface FolderStreamState {
  /** Anything to paint in the list right now. */
  hasRows: boolean;
  /** First load of this tab — nothing has arrived yet. */
  showSkeleton: boolean;
  /** The items request failed AND left nothing to show. */
  showError: boolean;
  /** The folder really has nothing in it for this view. */
  showEmpty: boolean;
}

export function folderStreamState(input: FolderStreamInput): FolderStreamState {
  const hasRows =
    input.itemRowCount > 0 || (input.showSubfolders && input.childRowCount > 0);
  const showSkeleton = input.isPending;
  // An error with rows behind it is an inline "couldn't refresh" strip, not a
  // page state — the folder, its trail and its subfolders stay usable.
  const showError = input.isError && input.itemRowCount === 0;
  const noMorePages = !input.hasNextPage && !input.isFetchingNextPage;

  return {
    hasRows,
    showSkeleton,
    showError,
    showEmpty:
      !showSkeleton &&
      !showError &&
      !hasRows &&
      noMorePages &&
      input.droppedCount === 0,
  };
}
