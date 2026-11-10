import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { gameLinkNote, gameLinkRefusal } from './model';

/* Live quiz in Spaces, step 4 (Arthur's decisions c and d, 93142269;
 * Backend's shapes 7a007a8c): a Space game's link, which adds whoever opens
 * it to the Space as a Contributor and takes them into the game. TEST DATA
 * only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const quiz = (file: string) => read('v2', 'features', 'channels', 'quiz', file);

test('the link says what it does, in the role the server names', () => {
  assert.equal(
    gameLinkNote({ content_role_label: 'Contributor' }),
    'Whoever opens it joins the Space as a Contributor and goes straight into the game. It stops working when the game ends.',
  );
});

test('a link that cannot be had says why, and offers Try again only where it could help', () => {
  assert.deepEqual(gameLinkRefusal(410), { message: 'This game has ended, so it has no link any more.', retry: false });
  assert.deepEqual(gameLinkRefusal(409), { message: 'This game has ended, so it has no link any more.', retry: false });
  assert.equal(gameLinkRefusal(403).retry, false);
  assert.equal(gameLinkRefusal(422).message, 'Only a game in a Space has a link.');
  assert.deepEqual(gameLinkRefusal(500), { message: 'The link couldn’t be made.', retry: true });
});

test('the API asks for the game’s link with no body', () => {
  const api = read('lib', 'api', 'channel-quiz.ts');
  assert.match(api, /`\/quiz-games\/\$\{gameUuid\}\/invite-link`,\s*\{\},/);
});

test('the game screen offers Invite to whoever hosts in a Space game, until it ends', () => {
  const overlay = quiz('GameOverlay.tsx');
  assert.match(
    overlay,
    /const canInvite =\s*mayInvite &&\s*room\.kind === 'space' &&\s*state !== null &&\s*!ending &&\s*phase !== 'finished' &&\s*phase !== 'cancelled';/,
  );
  assert.match(overlay, /\{inviteOpen && canInvite && \(\s*<GameInviteDialog/);
  // The Space page and a Space chat say who may.
  for (const screen of [
    read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx'),
    read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx'),
  ]) {
    assert.match(screen, /mayInvite=\{liveQuiz\.mayHost\}/);
  }
});

test('the dialog asks for the link as it opens and shares it exactly as the server gave it', () => {
  const dialog = quiz('GameInviteDialog.tsx');
  assert.match(dialog, /useEffect\(\(\) => \{\s*mutate\(\);\s*\}, \[mutate\]\);/);
  assert.match(dialog, /exactUrl: made\?\.url,/);
  assert.match(dialog, /<GameLinkQr url=\{made\.url\} \/>/);
  const share = read('v2', 'features', 'sharing', 'use-share-action.ts');
  assert.match(share, /const url = exactUrl \?\? shareUrl\(/);
});
