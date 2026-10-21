import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { askAgainRefusal, sendRefusal } from './space-turn';

/* Tester, 20 October 2026 (finding 20): with no messages left, a question
 * typed in a chat was refused and was gone from the box. The out-of-messages
 * row says why; the words now come back to the box. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const here = (file: string) => read('v2', 'features', 'conversations', 'conversation', file);

test('a blocked send is a refusal the composer gives back, with no second sentence', () => {
  assert.equal(sendRefusal({ kind: 'blocked' }, 1), '');
  assert.equal(askAgainRefusal({ kind: 'blocked' }, 1), '');
});

test('the engine answers a server block with the blocked refusal, after the row that explains it', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(
    engine,
    /if \(blocked\) \{\s*removeMessage\(optimisticMsg\.id\);\s*addErrorMessage\(blocked\.message, 'MESSAGES_EXHAUSTED', false, null, blocked\);\s*return \{ kind: 'blocked' \};/,
  );
});

test('the composer gives the words back and shows no empty banner', () => {
  const composer = here('ConversationComposer.tsx');
  assert.match(composer, /refuse: \(text, sentence\) => \{\s*updateInput\(\(current\) => draftWithRefused\(current, text\)\);\s*(\/\/[^\n]*\n\s*)*if \(!sentence\) return;/);
  assert.match(composer, /explain: \(sentence\) => \{\s*if \(!sentence\) return;/);
  // A blocked turn saved nothing, so the controller does not re-read the chat.
  assert.match(here('useConversationController.ts'), /refusal\.kind !== 'unsent' && refusal\.kind !== 'blocked'/);
});
