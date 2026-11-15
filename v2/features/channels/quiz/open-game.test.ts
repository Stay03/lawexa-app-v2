import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizGame, QuizGameState } from '@/types/channel-quiz';
import { QUIZ_DEFAULT_SETTINGS } from './model';
import {
  apiErrorCode,
  codeRefusal,
  isBusyRefusal,
  isJoinCode,
  isOpenGame,
  liveGameAction,
  liveGameState,
  NO_GAME_FOR_CODE,
  normalizeJoinCode,
  openGameHref,
  openGoLiveRefusal,
  openJoinRefusal,
  REMOVED_NOTE,
  spacedJoinCode,
} from './open-game';
import { channelRoom, gameInRoom, gameRoom, isRoomPlace, quizRoomKey, spaceRoom } from './quiz-room';
import { applyQuizEvent } from './use-game';

/* Live quiz without a Space (Stay's decisions, thread 12341975; Backend's
 * live-quiz-open e9c7ac18 and 16b4161e; the Techlead's scope, 15 November
 * 2026). An open game is its own room; it is joined by its link, QR or a
 * 6-character code; its host may remove a player; it holds 100. TEST DATA. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const GAME: QuizGame = {
  uuid: 'g-open-1',
  status: 'lobby',
  channel_uuid: null,
  space_uuid: null,
  quiz: { uuid: 'q1', title: 'TEST DATA Torts 101' },
  host: { id: 1, uuid: 'u-host', name: 'TEST DATA Host', username: 'host', avatar_url: null } as QuizGame['host'],
  settings: QUIZ_DEFAULT_SETTINGS,
  question_count: 10,
  current_question_index: null,
  countdown_ends_at: null,
  question_opens_at: null,
  question_ends_at: null,
  next_question_opens_at: null,
  started_at: null,
  finished_at: null,
  cancelled_at: null,
  visibility: 'public',
  join_code: 'ABC234',
  max_players: 100,
  results_until: null,
  created_at: '2026-11-15T03:00:00Z',
};

/* ── The room ─────────────────────────────────────────────────────────── */

test('an open game is its own room: matched by its uuid, never a place, keyed apart from a Space', () => {
  const room = gameRoom('g-open-1');
  assert.deepEqual(room, { kind: 'game', uuid: 'g-open-1' });
  assert.equal(isRoomPlace(room), false);
  assert.equal(isRoomPlace(spaceRoom('s1')), true);
  assert.equal(gameInRoom(GAME, room), true);
  assert.equal(gameInRoom(GAME, gameRoom('g-other')), false);
  // An open game belongs to no Space or channel.
  assert.equal(gameInRoom(GAME, spaceRoom('g-open-1')), false);
  assert.equal(gameInRoom(GAME, channelRoom('g-open-1')), false);
  assert.notEqual(quizRoomKey(room), quizRoomKey(spaceRoom('g-open-1')));
});

test('a game is open when it has a visibility and no room', () => {
  assert.equal(isOpenGame(GAME), true);
  assert.equal(isOpenGame({ ...GAME, visibility: 'link' }), true);
  assert.equal(isOpenGame({ ...GAME, visibility: null, space_uuid: 's1' }), false);
  assert.equal(isOpenGame({ ...GAME, visibility: undefined, channel_uuid: 'c1' }), false);
});

test("an open game's page is /quiz/live/{game}", () => {
  assert.equal(openGameHref('g-open-1'), '/quiz/live/g-open-1');
});

/* ── Join codes ───────────────────────────────────────────────────────── */

test('a code is read in any case, with spaces or a dash, from the server alphabet', () => {
  assert.equal(normalizeJoinCode(' abc 234 '), 'ABC234');
  assert.equal(normalizeJoinCode('abc-234'), 'ABC234');
  assert.equal(isJoinCode('ABC234'), true);
  // Too short, too long, or a character the alphabet leaves out (0, O, 1, I, L, 5, S).
  assert.equal(isJoinCode('ABC23'), false);
  assert.equal(isJoinCode('ABC2345'), false);
  for (const bad of ['ABC230', 'ABCO34', 'ABC134', 'ABCI34', 'ABCL34', 'ABC534', 'ABCS34']) assert.equal(isJoinCode(bad), false, bad);
  assert.equal(spacedJoinCode('ABC234'), 'ABC 234');
});

test('a code that finds no game says one sentence, whether unknown, malformed or ended', () => {
  assert.equal(codeRefusal(404), NO_GAME_FOR_CODE);
  assert.equal(codeRefusal(422), NO_GAME_FOR_CODE);
  assert.equal(NO_GAME_FOR_CODE, 'This code doesn’t match a game.');
  assert.match(codeRefusal(429), /Too many codes tried/);
  assert.match(codeRefusal(500), /Try again/);
});

/* ── Refusals ─────────────────────────────────────────────────────────── */

test('joining a full game, or as a removed player, is said; other refusals keep their own states', () => {
  assert.equal(openJoinRefusal(409, 'game_full', 100), 'This game is full. It takes 100 players.');
  assert.equal(openJoinRefusal(409, 'game_full', null), 'This game is full.');
  assert.equal(openJoinRefusal(403, 'removed', 100), REMOVED_NOTE);
  // The late-join 403 and the over-game 409 have their own designed states.
  assert.equal(openJoinRefusal(403, null, 100), null);
  assert.equal(openJoinRefusal(409, null, 100), null);
});

test("the crowd's busy 409 is retried, never shown", () => {
  assert.equal(isBusyRefusal(409, 'busy_try_again'), true);
  assert.equal(isBusyRefusal(409, 'game_full'), false);
  assert.equal(isBusyRefusal(403, 'busy_try_again'), false);
  assert.equal(apiErrorCode({ code: 'busy_try_again' }), 'busy_try_again');
  assert.equal(apiErrorCode(null), null);
  assert.equal(apiErrorCode({ code: 3 }), null);
});

test('going live open: one game at a time, a throttle, or the server sentence', () => {
  assert.match(openGoLiveRefusal(409, 'open_game_live', null), /already have an open game running/);
  assert.match(openGoLiveRefusal(429, 'too_many_games', null), /a lot of games this hour/);
  assert.equal(openGoLiveRefusal(422, null, 'TEST DATA. The quiz has no questions.'), 'TEST DATA. The quiz has no questions.');
  assert.match(openGoLiveRefusal(500, null, null), /Couldn’t start the game/);
});

/* ── Live now ─────────────────────────────────────────────────────────── */

test('a Live now card says where the game is, and Join, Join late or Watch', () => {
  assert.equal(liveGameState(GAME), 'Waiting to start');
  assert.equal(liveGameState({ ...GAME, status: 'countdown' }), 'Starting');
  assert.equal(liveGameState({ ...GAME, status: 'question_open', current_question_index: 2 }), 'Question 3 of 10');
  assert.equal(liveGameAction(GAME), 'Join');
  assert.equal(liveGameAction({ ...GAME, status: 'question_open', settings: { ...GAME.settings, allow_late_join: true } }), 'Join late');
  assert.equal(liveGameAction({ ...GAME, status: 'question_open', settings: { ...GAME.settings, allow_late_join: false } }), 'Watch');
});

/* ── The removed player ───────────────────────────────────────────────── */

test('player_removed takes the player out of the lobby and sets the count', () => {
  const state: QuizGameState = {
    game: {
      ...GAME,
      player_count: 2,
      players: [
        { rank: 1, user: { id: 2, uuid: 'u-a', name: 'TEST DATA A', username: 'a', avatar_url: null } as never, score: 0, joined_at_question_index: null },
        { rank: 2, user: { id: 3, uuid: 'u-b', name: 'TEST DATA B', username: 'b', avatar_url: null } as never, score: 0, joined_at_question_index: null },
      ],
    },
    current_question: null,
    your_answer: null,
  };
  const next = applyQuizEvent(state, {
    type: 'player_removed',
    payload: { game_uuid: 'g-open-1', user: { id: 3, uuid: 'u-b', name: 'TEST DATA B', username: 'b', avatar_url: null } as never, player_count: 1 },
  });
  assert.deepEqual(next.game.players?.map((player) => player.user.uuid), ['u-a']);
  assert.equal(next.game.player_count, 1);
});

/* ── The screens ──────────────────────────────────────────────────────── */

test('the open game plays in the same game screen as a Space game, on its own page and socket', () => {
  const screen = read('v2', 'features', 'quiz', 'live', 'OpenGameScreen.tsx');
  assert.match(screen, /<GameOverlay\s+room=\{gameRoom\(gameUuid\)\}\s+cover="viewport"/);
  assert.match(screen, /useOpenQuizLive\(gameUuid, signedIn\);/);
  const page = read('app', 'v2', 'quiz', 'live', '[gameUuid]', 'page.tsx');
  assert.match(page, /<QuizAccessGate surface="solo">/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(read('v2', 'runtime', 'realtime', 'protocol.ts'), /return `quiz-games\.\$\{gameUuid\}`;/);
});

test("the lobby reuses the Space game's lobby: the code, the cap, and the host's remove with a confirm", () => {
  const phases = read('v2', 'features', 'channels', 'quiz', 'GamePhases.tsx');
  assert.match(phases, /const open = isOpenGame\(state\.game\);/);
  assert.match(phases, /\{spacedJoinCode\(joinCode\)\}/);
  assert.match(phases, /const mayRemove = open && game\.isHost;/);
  assert.match(phases, /\{\.\.\.\(mayRemove && player\.user\.uuid !== hostUuid/);
  assert.match(phases, /They leave the lobby and can&rsquo;t join this game again\./);
  // The live board shows the viewer's own place when no list holds them.
  assert.match(phases, /yourRank=\{state\.your_rank \?\? null\}/);
});

test("the host's invite uses the Space game's invite dialog layout; anyone else may report the game", () => {
  const overlay = read('v2', 'features', 'channels', 'quiz', 'GameOverlay.tsx');
  assert.match(overlay, /<OpenGameInviteDialog/);
  assert.match(overlay, /const canReport = openVisibility !== null && state !== null && !game\.isHost;/);
  assert.match(overlay, /if \(game\.errorStatus === 403 && game\.errorCode === REMOVED_CODE\) \{/);
  const report = read('v2', 'features', 'channels', 'quiz', 'ReportGameDialog.tsx');
  assert.match(report, /content_type: 'channel_quiz_game', content_uuid: gameUuid, feedback_text: feedbackText/);
});

test('the host dialog offers a Space, Public and Private link, and an open game opens its own page', () => {
  const dialog = read('v2', 'features', 'channels', 'quiz', 'HostLiveQuizDialog.tsx');
  assert.match(dialog, /role="radiogroup" aria-label="Where it runs"/);
  assert.match(dialog, /\{ visibility \},/);
  assert.match(dialog, /router\.push\(openGameHref\(response\.data\.uuid\)\);/);
});

test('Live now reads the public list only, and sits above Explore for an account that may play', () => {
  assert.match(read('lib', 'api', 'channel-quiz.ts'), /apiClient\.get<LiveQuizGamesResponse>\('\/quiz-games\/live'/);
  const home = read('v2', 'features', 'quiz', 'home', 'QuizHomeScreen.tsx');
  assert.match(home, /\{tab === 'explore' && canWrite \? <LiveNowRow viewerId=\{viewerId\} \/> : null\}/);
  const row = read('v2', 'features', 'quiz', 'home', 'LiveNowRow.tsx');
  assert.match(row, /if \(!isJoinCode\(normalized\)\) \{\s*setError\(NO_GAME_FOR_CODE\);/);
});

test("an open game's relay also carries player_removed; a channel's and a Space's keep their eight", async () => {
  const { relayQuizGameEvents } = await import('./game-bus');
  const names = (room: Parameters<typeof relayQuizGameEvents>[1]) => {
    const heard: string[] = [];
    relayQuizGameEvents({ listen: (name: string) => heard.push(name), stopListening: () => undefined }, room, () => undefined);
    return heard;
  };
  assert.equal(names(gameRoom('g1')).length, 9);
  assert.ok(names(gameRoom('g1')).includes('.quiz.game.player_removed'));
  assert.equal(names(spaceRoom('s1')).length, 8);
  assert.ok(!names(channelRoom('c1')).includes('.quiz.game.player_removed'));
});
