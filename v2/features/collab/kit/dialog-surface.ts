/**
 * The surface every collab dialog sits on in dark mode (design round 1, 12
 * October 2026). The shared primitives paint `bg-background` with a 5%
 * foreground ring, which in dark is a near-black card with a barely visible
 * edge on a black scrim: the confirmations read as a hole in the page. The card
 * colour and a 10% ring give them an edge without touching the light theme.
 *
 * Applied to the collab surfaces' own dialogs only, through `className`, so
 * the app's other dialogs keep the primitive's look until they are checked
 * against it one by one.
 */
export const COLLAB_DIALOG_SURFACE = 'dark:bg-card dark:ring-foreground/10';
