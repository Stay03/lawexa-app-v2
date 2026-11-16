/* An ended live game's link, read by the join screen; in lib so v2's tests and v1 both reach it. */

/**
 * A live game's link after the game ended (Backend, 16 November 2026): the
 * invite answers 410 with `errors.code: "game_ended"` and the game's quiz, on
 * the preview and on the accept alike. When that quiz can be taken alone, the
 * link opens it instead of "This invite has expired". Any other 410 (expired,
 * used up, turned off, or a quiz that cannot be taken alone) is the same
 * refusal as before.
 */
export function endedGameQuiz(status: number | undefined, body: unknown): { uuid: string; title: string } | null {
  if (status !== 410 || typeof body !== 'object' || body === null) return null;
  const errors = (body as { errors?: unknown }).errors;
  if (typeof errors !== 'object' || errors === null) return null;
  const { code, quiz } = errors as { code?: unknown; quiz?: unknown };
  if (code !== 'game_ended' || typeof quiz !== 'object' || quiz === null) return null;
  const { uuid, title, solo_playable } = quiz as { uuid?: unknown; title?: unknown; solo_playable?: unknown };
  if (solo_playable !== true || typeof uuid !== 'string' || !/^[0-9a-f-]{36}$/i.test(uuid)) return null;
  return { uuid, title: typeof title === 'string' ? title : '' };
}

/** The quiz's own page, saying the live game ended (`?ended=1`). */
export function endedGameQuizPath(uuid: string): string {
  return `/quiz/q/${uuid}?ended=1`;
}
