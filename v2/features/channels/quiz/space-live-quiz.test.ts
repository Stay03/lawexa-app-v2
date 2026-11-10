import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canHostInSpace } from './model';

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
  assert.match(screen, /isMember: space\.my_role != null,\s*contentRole: viewerContentRole\(space\),/);
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
  assert.match(row, /line\.eventType === 'draft_edit' \? <DraftEditLine line=\{line\} \/> : <QuizGameLineRow line=\{line\} \/>/);
  assert.match(row, /const quiz = useLiveQuizRoom\(\);\s*if \(!quiz\) \{/);
  assert.match(row, /finished: line\.eventType === 'quiz_game_finished',\s*gameUuid: line\.gameUuid,/);

  // The channel feed draws the same card from its system message.
  const feed = read('v2', 'features', 'channels', 'feed', 'ChannelFeed.tsx');
  assert.match(feed, /import \{ QuizGameCard \} from '\.\.\/quiz\/QuizGameCard';/);
  assert.match(feed, /finished: item\.message\.metadata\.type === 'quiz_game_finished',/);
});
