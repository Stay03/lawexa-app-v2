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
