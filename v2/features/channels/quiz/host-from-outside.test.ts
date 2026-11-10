import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Space } from '@/types/collab';
import { offersHostLive } from '@/v2/features/quiz/solo/front/front-model';
import { hostRefusal, hostTargets, quickHostSpacePayload } from './model';
import { spaceGameHref } from '@/lib/utils/space-game-href';

/* Live quiz in Spaces, step 3 (Arthur's spec, 9 November 2026: "Host Live
 * Quiz from a Space with a quick Space picker from outside one", and a new
 * Space made there with just a name; decisions 93142269). TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const space = (uuid: string, extra: Partial<Space>): Space =>
  ({ uuid, name: `Space ${uuid}`, kind: 'shared', ...extra }) as Space;

test('the picker offers the Spaces where the reader hosts: Owner and Contributor, not Viewer', () => {
  const spaces = [
    space('a', { my_content_role: 'owner' }),
    space('b', { my_content_role: 'editor' }),
    space('c', { my_content_role: 'viewer' }),
    space('d', { my_content_role: null, my_role: null }),
  ];
  assert.deepEqual(
    hostTargets(spaces).map((row) => row.uuid),
    ['a', 'b'],
  );
});

test('a new Space from the picker is a shared Study Space with just the trimmed name', () => {
  assert.deepEqual(quickHostSpacePayload('  Torts revision  '), { name: 'Torts revision', type: 'study', kind: 'shared' });
});

test('a game hosted from outside opens on its Space’s page, in the game', () => {
  assert.equal(spaceGameHref('s-1', 'g-1'), '/spaces/s-1?game=g-1');
});

test('a refused Go live says why, naming the Space', () => {
  assert.equal(
    hostRefusal(409, 'Conflict', 'Torts'),
    'A quiz is already running in Torts. Open the Space to join it, or wait for it to finish.',
  );
  assert.equal(hostRefusal(403, null, 'Torts'), 'You can’t start a game in Torts. Only its Owner and Contributors can.');
  assert.equal(hostRefusal(422, 'This quiz has no questions.', 'Torts'), 'This quiz has no questions.');
  assert.equal(hostRefusal(500, 'Server Error', 'Torts'), 'The game couldn’t be started. Try again.');
});

test('the quiz page offers Host to an account that may use Spaces, for a quiz with questions', () => {
  assert.equal(offersHostLive({ spacesOpen: true, questionCount: 10 }), true);
  assert.equal(offersHostLive({ spacesOpen: true, questionCount: 0 }), false);
  assert.equal(offersHostLive({ spacesOpen: false, questionCount: 10 }), false);

  const front = read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx');
  assert.match(front, /spacesOpen: collabAccessState\(session\) === 'eligible',/);
  assert.match(front, /if \(mayHostLive\) rows\.push\(\{ id: 'host-quiz', label: 'Host a live quiz', icon: Trophy, onSelect: openHost \}\);/);
  assert.match(front, /\{hostOpen && quiz \? \(\s*<HostLiveQuizDialog/);
});

test('the dialog uses the Move dialog’s Space list, goes live in the picked Space and opens the game there', () => {
  const dialog = read('v2', 'features', 'channels', 'quiz', 'HostLiveQuizDialog.tsx');
  assert.match(dialog, /<SpacePickList\s+targets=\{hostTargets\}\s+onPick=\{goLiveIn\}/);
  assert.match(dialog, /goLive\.mutate\(\s*\{ room: spaceRoom\(space\.uuid\) \},/);
  assert.match(dialog, /router\.push\(spaceGameHref\(space\.uuid, response\.data\.uuid\)\);/);
  // New Space: made with just a name, then live in it in the same tap.
  assert.match(dialog, /createSpace\.mutate\(quickHostSpacePayload\(name\), \{/);
  assert.match(dialog, /goLiveIn\(\{ uuid: response\.data\.uuid, name: response\.data\.name, isNew: true \}\)/);
  // A Space with a game running offers the way in.
  assert.match(dialog, /running: status === 409 \? \{ uuid: space\.uuid, name: space\.name \} : null,/);

  const move = read('v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx');
  assert.match(move, /<SpacePickList\s+targets=\{moveTargets\}/);
});

test('Go live takes its room with each press: the sheet’s own, or the picked Space', () => {
  const mutations = read('v2', 'features', 'channels', 'quiz', 'mutations.ts');
  assert.match(mutations, /export function useGoLive\(quizUuid: string\) \{/);
  assert.match(mutations, /mutationFn: \(\{ room, conversationUuid = null \}: GoLiveTarget\) =>/);
  const sheet = read('v2', 'features', 'channels', 'quiz', 'QuizLibrarySheet.tsx');
  assert.match(sheet, /const goLive = useGoLive\(quiz\.uuid\);/);
  assert.match(sheet, /goLive\.mutate\(\{ room, conversationUuid \}, \{/);
});
