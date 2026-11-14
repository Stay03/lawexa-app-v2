import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canHostInSpace, cancelledGameCopy, LOBBY_IDLE_LIMIT_MINUTES } from './model';
import { spaceQuizSeat } from './space-quiz-seat';

/* Live quiz in Spaces, step 2 (Arthur's decisions 93142269; Backend's shapes
 * 7a007a8c): the Space's page and its chats show the Space's live bar, open
 * `?game=` over the screen and offer Host a live quiz to the Owner and
 * Contributors; a chat draws the game's live and finished lines. TEST DATA
 * only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const quiz = (file: string) => read('v2', 'features', 'channels', 'quiz', file);

test('the Owner and Contributors host in a Space; a Viewer and a non-member do not', () => {
  assert.equal(canHostInSpace('owner'), true);
  assert.equal(canHostInSpace('editor'), true);
  assert.equal(canHostInSpace('viewer'), false);
  assert.equal(canHostInSpace(null), false);
  assert.equal(canHostInSpace(undefined), false);
});

test('one hook holds the rules for both screens: members play, hosts host, `?game=` waits for the Space', () => {
  const hook = quiz('use-space-live-quiz.ts');
  assert.match(hook, /const mayHost = isMember && canHostInSpace\(seat\?\.contentRole\);/);
  assert.match(hook, /useSpaceQuizLive\(spaceUuid, isMember\);/);
  // Not known yet keeps the link; known refuses it to a non-member and to a
  // chat in no Space.
  assert.match(hook, /canOpen: seat === undefined \? undefined : isMember,/);
  // Into the game closes the host sheet first.
  assert.match(hook, /setHostOpen\(false\);\s*showGame\(next\);/);
});

test('a game over a page that scrolls in the shell covers the window', () => {
  const overlay = quiz('GameOverlay.tsx');
  assert.match(overlay, /cover === 'viewport' \? 'fixed inset-0 z-50' : 'absolute inset-0 z-20'/);
});

test('the Space page: live bar and host sheet for members, the game over the window, Host in the menu', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  // Membership is the frame's settled answer, not the detail's `my_role` alone.
  assert.match(screen, /seat: spaceQuizSeat\(\{\s*space,\s*membership: scope\?\.membership \?\? NO_MEMBERSHIP,\s*rosterPending: scope\?\.isMembersPending \?\? true,\s*\}\),/);
  assert.match(screen, /conversationUuid: null,\s*initialGameUuid: searchParams\.get\('game'\),/);
  assert.match(screen, /\{liveQuiz\.room && liveQuiz\.isMember && \(\s*<LiveQuizBar/);
  // A card in the page's column, aligned with the header (fixture pictures).
  assert.match(screen, /<LiveQuizBar[\s\S]*?shape="card"/);
  assert.match(screen, /\{liveQuiz\.hostPlace && liveQuiz\.isMember && \(\s*<QuizLibrarySheet/);
  assert.match(screen, /<GameOverlay[\s\S]*?cover="viewport"/);
  assert.match(screen, /label: 'Host a live quiz',\s*icon: Trophy,\s*onSelect: openHostQuiz,/);
});

test('a Space chat: the quiz on its own route only, games named by the chat, Host first in its menu', () => {
  const screen = read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx');
  // The case side chat and a confidential chat have no Space quiz.
  assert.match(screen, /embed \|\| controller\.isConfidential \|\| spacePlace === null\s*\? null/);
  assert.match(screen, /conversationUuid: conversationId,\s*initialGameUuid: embed \? null : initialGameUuid,/);
  assert.match(screen, /quizRoom && inQuizRoom \? \{ room: quizRoom, viewerId: serverUserId, openGame \} : null/);
  assert.match(screen, /<LiveQuizRoomProvider value=\{quizRoomValue\}>/);
  // While the bar shows, the transcript starts below it (as below the
  // confidential banner), never pulled up under a phone's header.
  assert.match(screen, /const quizBarShown = useRoomLiveGame\(quizRoomValue\?\.room \?\? null, serverUserId\) !== null;/);
  assert.match(screen, /underBar=\{!embed && !controller\.isConfidential && !quizBarShown\}/);
  assert.match(screen, /onHostQuiz=\{liveQuiz\.mayHost \? openHostQuiz : null\}/);
  assert.match(screen, /<GameOverlay[\s\S]*?cover="viewport"/);

  const page = read('app', 'v2', 'c', '[conversationId]', 'page.tsx');
  assert.match(page, /initialGameUuid=\{typeof game === 'string' && game !== '' \? game : null\}/);

  const actions = read('v2', 'features', 'conversations', 'conversation', 'ConversationActions.tsx');
  assert.match(actions, /if \(!onHostQuiz\) return chatRows;/);
  assert.match(actions, /return \[host, \.\.\.chatRows\.map\(\(row, index\) => \(index === 0 \? \{ \.\.\.row, separatorBefore: true \} : row\)\)\];/);
});

test('a chat’s quiz line is the channels’ quiz card for a member, and the sentence alone for anyone else', () => {
  const row = read('v2', 'features', 'conversations', 'conversation', 'rows', 'EventLineRow.tsx');
  // One switch draws every kind of line: background work's, a live quiz's, a draft's.
  assert.match(row, /case 'quiz_game_live':\s*case 'quiz_game_finished':\s*return <QuizGameLineRow line=\{line\} \/>;/);
  assert.match(row, /case 'background_job_result':\s*case 'background_job_unanswered':\s*return <BackgroundJobLine line=\{line\} \/>;/);
  assert.match(row, /const quiz = useLiveQuizRoom\(\);\s*if \(!quiz\) \{/);
  assert.match(row, /finished: line\.eventType === 'quiz_game_finished',\s*gameUuid: line\.gameUuid,/);

  // The channel feed draws the same card from its system message.
  const feed = read('v2', 'features', 'channels', 'feed', 'ChannelFeed.tsx');
  assert.match(feed, /import \{ QuizGameCard \} from '\.\.\/quiz\/QuizGameCard';/);
  assert.match(feed, /finished: item\.message\.metadata\.type === 'quiz_game_finished',/);
});

test("a Space's owner is a member even when the Space's detail leaves out my_role", () => {
  const space = { uuid: 'space-1', name: 'TEST DATA Space' };
  // The frame's answer from the member list: the owner.
  assert.deepEqual(spaceQuizSeat({ space, membership: { kind: 'team', my_role: 'owner' }, rosterPending: false }), {
    uuid: 'space-1',
    name: 'TEST DATA Space',
    isMember: true,
    contentRole: 'owner',
  });
  // Not known yet: the detail has no role and the member list is still on its way. `?game=` waits.
  assert.equal(spaceQuizSeat({ space, membership: { my_role: null }, rosterPending: true }), undefined);
  assert.equal(spaceQuizSeat({ space: null, membership: { my_role: 'owner' }, rosterPending: false }), undefined);
  // Known, and not a member: the link is refused.
  assert.equal(spaceQuizSeat({ space, membership: { my_role: null }, rosterPending: false })?.isMember, false);
});

test('a lobby nobody started says it closed; a game someone ended says it was cancelled', () => {
  const closed = cancelledGameCopy({ cancelledBy: null, neverStarted: true });
  assert.equal(closed.title, 'This lobby closed');
  assert.match(closed.description, new RegExp(`within ${LOBBY_IDLE_LIMIT_MINUTES} minutes`));
  assert.equal(cancelledGameCopy({ cancelledBy: { name: 'TEST DATA Ada' }, neverStarted: true }).title, 'This game was cancelled');
  assert.match(cancelledGameCopy({ cancelledBy: { name: 'TEST DATA Ada' }, neverStarted: false }).description, /^TEST DATA Ada ended the game/);
  assert.equal(cancelledGameCopy({ cancelledBy: null, neverStarted: false }).title, 'This game was cancelled');
});
