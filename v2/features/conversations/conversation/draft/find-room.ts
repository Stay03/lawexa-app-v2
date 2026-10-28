/**
 * The room the draft's text keeps above it while the find card is open on a
 * computer (Lucy, 25 October 2026: "the find bar covers the top lines of the
 * draft"). At xl the card hangs below the bar over the top of the draft's
 * scroll area, and a draft has no title above its text, so its first lines
 * sat under the card. The scroll area takes the card's height plus a little
 * air as top padding (and as scroll padding), so the first lines start below
 * the card and nothing scrolled to is put under it. On a phone the find bar is
 * a strip in the flow, so the room is never applied there (DraftEditor's
 * `xl:` classes).
 */

/** The air between the card's lower edge and the first line, in pixels. */
export const FIND_ROOM_GAP = 8;

/** The room for a card `cardHeight` tall: its height plus the gap, or none for no card. */
export function findCardRoom(cardHeight: number): number {
  if (!Number.isFinite(cardHeight) || cardHeight <= 0) return 0;
  return Math.ceil(cardHeight) + FIND_ROOM_GAP;
}
