import type { QuizGame, QuizGameVisibility } from '@/types/channel-quiz';

/**
 * open-game — the rules and words of a live quiz with no Space or channel
 * (Stay's decisions, thread 12341975; Backend's live-quiz-open e9c7ac18):
 * anyone signed in may host one, `public` (listed under Live now) or by
 * `link` (never listed), up to 100 players, joined by its link, its QR or a
 * 6-character code. Pure, so the suite runs it as behaviour.
 */

/** The page an open game is played on. A Space or channel game keeps its own `?game=` overlay. */
export function openGameHref(gameUuid: string): string {
  return `/quiz/live/${encodeURIComponent(gameUuid)}`;
}

/** Whether a game is an open one: it has a visibility and no room. */
export function isOpenGame(game: Pick<QuizGame, 'visibility' | 'channel_uuid' | 'space_uuid'>): boolean {
  return (game.visibility === 'public' || game.visibility === 'link') && game.channel_uuid === null && !game.space_uuid;
}

/** The letters and digits a join code is made of (the server's): no 0, O, 1, I, L, 5 or S, which read alike. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
export const JOIN_CODE_LENGTH = 6;

/** What a person typed, as a code: upper case, spaces and dashes taken out. */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, '');
}

/** Whether a normalised code can be one: six characters from the alphabet. */
export function isJoinCode(code: string): boolean {
  return code.length === JOIN_CODE_LENGTH && [...code].every((char) => JOIN_CODE_ALPHABET.includes(char));
}

/** A code shown to people, split in two so it reads aloud: "ABC 234". */
export function spacedJoinCode(code: string): string {
  return code.length === JOIN_CODE_LENGTH ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/**
 * Said for a code that finds no game, whatever the reason (unknown,
 * malformed, or a game that has ended): the app never tells those apart
 * (Techlead, 15 November 2026).
 */
export const NO_GAME_FOR_CODE = 'This code doesn’t match a game.';
export const CODE_TRIES_LIMIT = 'Too many codes tried. Wait a minute, then try again.';

/** The words for a code lookup that failed, by its status. */
export function codeRefusal(status: number): string {
  if (status === 429) return CODE_TRIES_LIMIT;
  if (status === 404 || status === 422) return NO_GAME_FOR_CODE;
  return 'Couldn’t check the code. Try again.';
}

/** The refusal's `errors.code`, when it carries one. */
export function apiErrorCode(errors: unknown): string | null {
  const code = (errors as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/** A full game's 409 code. */
export const GAME_FULL_CODE = 'game_full';
/** A removed player's 403 code, on join and on reading the game alike. */
export const REMOVED_CODE = 'removed';
/** The 409 a join or a removal gets while many people are joining at once: try again (Backend 16b4161e). */
export const BUSY_CODE = 'busy_try_again';

/** Whether a refusal is the busy one, which is retried rather than shown. */
export function isBusyRefusal(status: number, code: string | null): boolean {
  return status === 409 && code === BUSY_CODE;
}

/** What a removed player is told, wherever they meet it. */
export const REMOVED_NOTE = 'The host removed you from this game.';

/**
 * Why a join was refused, in words; null when the screen has a designed
 * state for it already (the late-join 403, the over-game 409).
 */
export function openJoinRefusal(status: number, code: string | null, maxPlayers: number | null | undefined): string | null {
  if (status === 409 && code === GAME_FULL_CODE) {
    return maxPlayers ? `This game is full. It takes ${maxPlayers} players.` : 'This game is full.';
  }
  if (status === 403 && code === REMOVED_CODE) return REMOVED_NOTE;
  if (isBusyRefusal(status, code)) return BUSY_NOTE;
  return null;
}

/** Said when the busy retries ran out: the crowd is still coming in. */
export const BUSY_NOTE = 'Lots of people are joining right now. Try again in a moment.';

/** Why a removal was refused, in words. */
export function removeRefusal(status: number, code: string | null): string {
  if (isBusyRefusal(status, code)) return BUSY_NOTE;
  if (status === 409) return 'The game has started, so nobody can be removed now.';
  if (status === 404) return 'That player has already left the game.';
  return 'Couldn’t remove that player. Try again.';
}

/** Why an open game could not go live, in words. */
export function openGoLiveRefusal(status: number, code: string | null, message: string | null): string {
  if (status === 409 && code === 'open_game_live') {
    return 'You already have an open game running. End it before you start another.';
  }
  if (status === 429 && code === 'too_many_games') {
    return 'You’ve started a lot of games this hour. Try again later.';
  }
  if (status === 422 && message) return message;
  return 'Couldn’t start the game. Try again.';
}

/** How an open game is reached, for the lobby and the host dialog. */
export const VISIBILITY_WORDS: Record<QuizGameVisibility, { label: string; who: string }> = {
  public: { label: 'Public', who: 'Anyone on Lawexa can join. It shows under Live now on the Quiz page.' },
  link: { label: 'Private link', who: 'Only people with the link or the code can join. It isn’t listed anywhere.' },
};

/** How many are in, against the cap: "14 of 100 players". */
export function playersAgainstCap(count: number, max: number | null | undefined): string {
  const noun = count === 1 ? 'player' : 'players';
  return max ? `${count} of ${max} ${noun}` : `${count} ${noun}`;
}

/** Where a Live now game is, in a few words: waiting, starting, or which question. */
export function liveGameState(game: Pick<QuizGame, 'status' | 'current_question_index' | 'question_count'>): string {
  if (game.status === 'lobby') return 'Waiting to start';
  if (game.status === 'countdown') return 'Starting';
  if (game.current_question_index !== null) return `Question ${game.current_question_index + 1} of ${game.question_count}`;
  return 'Playing';
}

/** What a Live now card's button says: Join before it starts, Join late when late joiners may play, else Watch. */
export function liveGameAction(game: Pick<QuizGame, 'status' | 'settings'>): 'Join' | 'Join late' | 'Watch' {
  if (game.status === 'lobby') return 'Join';
  return game.settings.allow_late_join ? 'Join late' : 'Watch';
}

/**
 * An open game's reveal carries only the top 10 (Backend e9c7ac18), while
 * the game's own list holds everyone. The top 10's new ranks and scores go
 * first, and every other player stays as they were until the authoritative
 * read that follows the reveal: nobody below the top 10 drops out of the game
 * for that moment (they would read as not playing, and be offered Join).
 */
export function mergeTopLeaderboard<P extends { user: { uuid: string } }>(players: readonly P[], top: readonly P[]): P[] {
  const inTop = new Set(top.map((player) => player.user.uuid));
  return [...top, ...players.filter((player) => !inTop.has(player.user.uuid))];
}
