import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applySegment, dictationHint, dictationProblemLine, hasWords, joinText, keepsVoice, timerLabel } from './dictation-model';

/* One dictation in the message box: segments, commands, the clock. TEST DATA. */

test('settled segments join with one space', () => {
  assert.equal(joinText('', 'Can my landlord raise the rent?'), 'Can my landlord raise the rent?');
  assert.equal(joinText('Can my landlord raise the rent?', ' The lease says nothing. '), 'Can my landlord raise the rent? The lease says nothing.');
  assert.equal(joinText('First point.\n', 'Second point.'), 'First point.\nSecond point.');
});

test('a segment ending in a command adds its words and hands the command back', () => {
  assert.deepEqual(applySegment('TEST DATA. The lease was never signed.', 'Is it still binding? Send.'), {
    text: 'TEST DATA. The lease was never signed. Is it still binding?',
    command: 'send',
  });
  assert.deepEqual(applySegment('TEST DATA.', 'Send the notice to the landlord.'), { text: 'TEST DATA. Send the notice to the landlord.', command: null });
  assert.deepEqual(applySegment('TEST DATA.', 'Cancel.'), { text: 'TEST DATA.', command: 'cancel' });
});

test('the clock reads minutes and seconds', () => {
  assert.equal(timerLabel(0), '0:00');
  assert.equal(timerLabel(14_400), '0:14');
  assert.equal(timerLabel(299_999), '4:59');
});

test('only words are sent, and the voice is kept only where the chat keeps files', () => {
  assert.equal(hasWords('   '), false);
  assert.equal(hasWords('TEST DATA'), true);
  assert.equal(keepsVoice({ isConfidential: false, isRedacted: false }), true);
  assert.equal(keepsVoice({ isConfidential: true, isRedacted: false }), false);
  assert.equal(keepsVoice({ isConfidential: false, isRedacted: true }), false);
});

test('a dictation that did not start says why, as dictation', () => {
  assert.equal(dictationProblemLine('no_access'), 'Dictation isn’t available on your account.');
  assert.equal(dictationProblemLine('server', 'TEST DATA. The service is busy.'), 'TEST DATA. The service is busy.');
  assert.equal(dictationProblemLine('server'), 'Dictation didn’t start. Try again.');
  assert.match(dictationProblemLine('mic_denied'), /microphone/);
});

test('the line under the box follows the dictation', () => {
  const base = { atLimit: false, liveDown: false };
  // No "say send" line while listening (Stay, 25 November 2026).
  assert.equal(dictationHint({ ...base, phase: 'listening' }), null);
  assert.equal(dictationHint({ ...base, phase: 'paused' }), 'Paused. Edit the words, or tap the mic to go on.');
  assert.equal(dictationHint({ ...base, phase: 'countdown' }), null);
  assert.equal(dictationHint({ ...base, phase: 'paused', atLimit: true }), '5 minutes is the longest. Send, or X to clear.');
  assert.equal(dictationHint({ ...base, phase: 'listening', liveDown: true }), 'The live words stopped. Pause to type them.');
});
