/**
 * A Space game's address: the Space's page, in the game (`?game=`), where a
 * game hosted from outside the Space and a game link's join both land (live
 * quiz in Spaces, Backend's shapes 7a007a8c). In `lib` because both sides use
 * it: v2's host picker and the join screen, which v2 code may not import.
 */
export function spaceGameHref(spaceUuid: string, gameUuid: string): string {
  return `/spaces/${spaceUuid}?game=${encodeURIComponent(gameUuid)}`;
}
