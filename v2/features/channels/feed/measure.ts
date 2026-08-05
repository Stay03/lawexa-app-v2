/**
 * measure — the transcript's line length, in one place.
 *
 * DIRECTION 1 says "message text column ≤ ~66ch" and nothing in the shipped
 * feed enforced it: text ran the full `max-w-3xl` column minus the avatar
 * gutter, which is roughly 90 characters at the body size — past the 50–75
 * band every typographic source agrees on (Bringhurst's 45–75; Baymard; WCAG's
 * 80-character ceiling for Latin scripts). Long lines cost the eye the return
 * sweep, and a transcript is read in bursts of one line each.
 *
 * WHY THE COLUMN STAYS WIDE ANYWAY. The measure caps the TEXT, not the row.
 * The row keeps the full column so the author run, the reactions, the hover
 * actions and the gradient they sit under all have somewhere to be — which is
 * exactly the room the row-action cluster needs in order to stop overlapping
 * the message above it.
 *
 * `ch` RESOLVES AGAINST THE ELEMENT'S OWN FONT SIZE, so this class must land on
 * (or inside) something already sized as body text. It is deliberately only the
 * width: bundling a font size here would silently retype every caller.
 */
export const MESSAGE_MEASURE = 'max-w-[66ch]';
