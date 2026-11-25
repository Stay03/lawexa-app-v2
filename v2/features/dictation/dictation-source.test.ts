import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Dictation's wiring (Arthur, 25 November 2026, design A2; Backend card
 * 2b83c2ed). The flag comes from THIS page load's `/auth/me`, as the
 * recorder's does; the voice goes up once and its id rides the send; the
 * server's clip comes back on the row. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the session carries can_dictate from /auth/me, and the layout publishes it', () => {
  assert.match(read('v2', 'runtime', 'session.ts'), /can_dictate: user\.can_dictate === true,/);
  assert.match(read('app', 'v2', 'layout.tsx'), /canDictate=\{user\?\.can_dictate \?\? false\}/);
  assert.match(read('v2', 'runtime', 'session-context.tsx'), /readonly canDictate: boolean;/);
  assert.match(
    read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'),
    /canDictate \} = useV2Session\(\);/,
  );
});

test('a dictated send carries its clip, and a saved row brings it back', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /\.\.\.\(voiceClip && \{ voice_clip_id: voiceClip\.id \}\),/);
  assert.match(read('lib', 'utils', 'transform-api-messages.ts'), /\.\.\.\(apiMsg\.voice_clip && \{ voiceClip: apiMsg\.voice_clip \}\),/);
  assert.match(
    read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts'),
    /\.\.\.\(voiceClip && \{ voiceClip \}\),/,
  );
});

test('the voice goes up only where the chat keeps it', () => {
  const composer = read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx');
  assert.match(composer, /const voiceKept = dictationKeepsVoice && keepsVoice\(\{ isConfidential, isRedacted \}\);/);
  assert.match(composer, /if \(clip && voiceKept\) \{/);
  // A document's first question starts a new chat, whose send takes no voice.
  assert.match(read('v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx'), /dictationKeepsVoice=\{surface !== null\}/);
});
