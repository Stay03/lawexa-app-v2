/**
 * page-columns — the ONE definition of the v2 list pages' reading column.
 *
 * WHY (owner, July 29: "the case list view on large monitor has the list
 * squeezed in the middle… same as the conversation list page so there should
 * be some consistency"). `/conversations` and `/cases` each declared their own
 * column string, and the moment one was retuned they would drift — the exact
 * failure `home-frame.ts` exists to prevent on the home. Both list pages (and
 * both of their route fallbacks) now import this constant, so widening one
 * widens all four surfaces together.
 *
 * `max-w-3xl` (was `2xl`): case rows carry a name, a citation-bearing meta line
 * and a two-line holding, which earns the wider measure — and it matches
 * `CASE_COLUMN` on the case page, so list → case is one width. No JSX, no
 * hooks; server and client trees both import it (Tailwind v4 scans source
 * text, so constants in a `.ts` file are detected).
 */
export const LIST_COLUMN = 'mx-auto w-full max-w-3xl px-4 pb-16 pt-5 sm:pt-6';

/**
 * The SAME column, for a list that carries a `ScreenDock` (the floating search
 * pill).
 *
 * Three differences, all of them load-bearing for the dock and none of them a
 * change of measure:
 *
 *  - `flex min-h-full flex-col` — a `sticky bottom-0` element can never travel
 *    further than its containing block, so the dock's parent has to be as tall
 *    as the scroll region even when the list is short. `min-h-full` resolves
 *    against the scroller's CONTENT box, which on a top-level screen is the
 *    viewport less the see-through bar's padding — and the padding puts that
 *    height back, so the column is exactly one screen tall and the dock sits
 *    exactly on the bottom edge.
 *  - `pb-16` STAYS, and the dock cancels it for itself with `-mb-16`. It is
 *    kept because a dock is not guaranteed: with the search box switched to the
 *    top, `/cases`, `/statutes`, `/folders`, `/conversations` and `/channels`
 *    render no dock at all, and a list that ends flush against the bottom edge
 *    is the regression this padding has always existed to prevent. Where a dock
 *    DOES render it must sit on the very bottom edge, so it pulls itself down
 *    over exactly that padding (see `ScreenDock`).
 *  - the rows need no extra clearance for the dock: it settles into its flow
 *    position at the very end of the list, so scrolling to the bottom reveals
 *    the last row above it rather than under it. The dock's own box height is
 *    therefore the resting gap, which is why its top padding and the length of
 *    its dissolve are the same number (`ScreenDock`).
 */
export const LIST_COLUMN_DOCKED =
  'mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-16 pt-5 sm:pt-6';
