import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The recorder's doors follow THIS page load's `/auth/me` (21 November 2026). Lucy, a
 * researcher with `can_record` on, saw no microphone on live even after signing in
 * again: the sign-in answers left `can_record` out, and the doors read the copy of the
 * user saved at sign-in, which nothing refreshed. They read the session snapshot now,
 * which the v2 layout builds from `/auth/me` on every load. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the session carries can_record from /auth/me, and the layout publishes it', () => {
  assert.match(read('v2', 'runtime', 'session.ts'), /can_record: user\.can_record === true,/);
  assert.match(read('app', 'v2', 'layout.tsx'), /canRecord=\{user\?\.can_record \?\? false\}/);
  assert.match(read('v2', 'runtime', 'session-context.tsx'), /readonly canRecord: boolean;/);
});

test('every recorder door reads the session, never the user saved at sign-in', () => {
  const doors = [
    ['v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'],
    ['v2', 'features', 'channels', 'composer', 'ChannelComposer.tsx'],
    ['v2', 'features', 'folders', 'list', 'FoldersBrowser.tsx'],
    ['v2', 'features', 'voice-test', 'VoiceTestScreen.tsx'],
  ];
  for (const door of doors) {
    const source = read(...door);
    assert.match(source, /canRecord[^\n]*\} = useV2Session\(\);/, door.join('/'));
    assert.doesNotMatch(source, /user\?\.can_record/, door.join('/'));
  }
});
