/**
 * The shape of a waiting request on the People tab: "Needs your approval" and
 * "Wants to contribute" (techlead, 16 October 2026).
 *
 * On a phone a request is drawn like the member rows above it: avatar, name,
 * and two small buttons on the same line, a thin divider between rows, no card.
 * The bordered card with the buttons wrapped under the name was the screen
 * Stay called atrocious. The name truncates before the buttons shrink. From
 * `md:` up each request keeps its card, which the desktop pictures approved.
 */

/** The list: dividers on a phone, spaced cards from `md:`. */
export const REQUEST_LIST = 'divide-y divide-border/60 md:space-y-3 md:divide-y-0';

/** One request: a roster row on a phone, a card from `md:`. */
export const REQUEST_ITEM = 'py-2 md:rounded-xl md:border md:border-border/60 md:p-3';

/** The name side and the buttons share one line on a phone; from `md:` a
 *  narrow card may still wrap the buttons under the name. */
export const REQUEST_LINE =
  'flex min-w-0 items-center gap-3 max-md:min-h-11 md:flex-wrap md:gap-y-2';

/** The name side: it gives way first, so the buttons keep their size. */
export const REQUEST_NAME = 'flex min-w-0 flex-1 items-center gap-3 md:basis-48';

/** The avatar: the roster's on a phone, a size up in a desktop card. */
export const REQUEST_AVATAR = 'size-6 shrink-0 md:size-8';

/** The buttons: small pills with no icon on a phone. */
export const REQUEST_BUTTON = 'max-md:h-8 max-md:px-3 max-md:text-xs';

/** An icon that only the desktop card shows. The spinner is not one of
 *  them: a press in flight shows on a phone too. */
export const REQUEST_ICON = 'size-4 max-md:hidden';
