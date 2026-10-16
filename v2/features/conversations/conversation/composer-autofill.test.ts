import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Chrome on iPhone drew its autofill bar over the case chat's message box and
 * did not count it in the visual viewport (Arthur's ?kbdebug=1 recording, 16
 * October 2026). The message box asks for no autofill. */

const composer = readFileSync(
  join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'),
  'utf8',
);

test('the message box opts out of autofill with a neutral name', () => {
  const box = composer.slice(composer.indexOf('<PromptInputTextarea'));
  const props = box.slice(0, box.indexOf('/>'));
  assert.match(props, /autoComplete="off"/);
  assert.match(props, /name="lawexa-message"/);
  assert.match(props, /inputMode="text"/);
});
