import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expectsAiReply } from './ai-reply';

/* A Space where Lawexa answers only when tagged (Stay, 15 November 2026,
 * thread 39c968a5; Backend space-chat-tag-only 7932d22b). TEST DATA only. */

test('only an explicit ai_reply: false means no answer is coming; absent means one is', () => {
  assert.equal(expectsAiReply({ ai_reply: false }), false);
  assert.equal(expectsAiReply({ ai_reply: true }), true);
  // Today's live server sends no ai_reply and answers every message.
  assert.equal(expectsAiReply({}), true);
});

test('the send ends the turn at once when no answer is coming: no thinking, no stream', () => {
  const engine = readFileSync(join(process.cwd(), 'v2', 'runtime', 'chat-engine', 'engine.ts'), 'utf8');
  // Checked before the stream opens, so nothing connects and nothing waits.
  assert.match(
    engine,
    /if \(!expectsAiReply\(response\.data\)\) \{\s*setState\(\(prev\) => \(\{ \.\.\.prev, isStreaming: false, isCancelling: false \}\)\);\s*return null;\s*\}\s*const executionId = response\.data\.execution_id;/,
  );
  // A reply promised with nothing to stream is a failed send, never a silent end.
  assert.match(engine, /if \(executionId === null\) \{[^}]*error: 'Lawexa could not start its answer\. Try again\.'/);
  assert.match(engine, /connectToStream\(executionId\);/);
});
