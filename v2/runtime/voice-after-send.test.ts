import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VOICE_TRIES, dropVoice, heldVoiceState, holdVoice, retryHeldVoice, sendHeldVoice } from './voice-after-send';

/* Arthur, 27 November 2026 (ce4eb347): "after send the text vanishes
 * momentarily and it's terrible UX". The words go at once; the voice goes up
 * after them, linked to the saved message (Backend dictation-clip-after-send). */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const clip = () => new Blob(['TEST DATA voice'], { type: 'audio/webm' });
const noWait = () => Promise.resolve();
const answer = (messageId: number) => ({ success: true, message: 'ok', data: { id: 9, duration_ms: 1000, message_id: messageId } });

test('the voice goes up linked to the saved message, and is kept', async () => {
  const sent: Array<[number, number | undefined]> = [];
  const key = holdVoice(clip(), 1000);
  assert.equal(heldVoiceState(key), 'waiting');
  const state = await sendHeldVoice(key, 41, async (_c, ms, id) => {
    sent.push([ms, id]);
    return answer(41);
  }, noWait);
  assert.equal(state, 'kept');
  assert.deepEqual(sent, [[1000, 41]]);
});

test('a dropped upload tries again; a refusal does not; the words are never touched', async () => {
  let calls = 0;
  const key = holdVoice(clip(), 1000);
  const flaky = async () => {
    calls += 1;
    if (calls < VOICE_TRIES) throw new Error('network');
    return answer(7);
  };
  assert.equal(await sendHeldVoice(key, 7, flaky, noWait), 'kept');
  assert.equal(calls, VOICE_TRIES);

  let refusals = 0;
  const refused = holdVoice(clip(), 1000);
  const refuse = async () => {
    refusals += 1;
    throw { response: { status: 422, data: { errors: { reason: 'keeps_no_voice' } } } };
  };
  assert.equal(await sendHeldVoice(refused, 8, refuse, noWait), 'failed');
  assert.equal(refusals, 1);
});

test('a server from before message_id keeps the clip unlinked: the row says it did not save', async () => {
  const key = holdVoice(clip(), 1000);
  const old = async () => ({ success: true, message: 'ok', data: { id: 9, duration_ms: 1000 } });
  assert.equal(await sendHeldVoice(key, 5, old, noWait), 'failed');
});

test('Try again sends the same clip for the same message; a dropped voice is gone', async () => {
  const key = holdVoice(clip(), 1000);
  await sendHeldVoice(key, 3, async () => { throw { response: { status: 500 } }; }, noWait);
  assert.equal(heldVoiceState(key), 'failed');
  retryHeldVoice(key);
  assert.notEqual(heldVoiceState(key), 'failed');
  const gone = holdVoice(clip(), 1000);
  dropVoice(gone);
  assert.equal(heldVoiceState(gone), null);
});

test('the row: Play from this device at once, "Saving the voice…", then kept or "Try again"', () => {
  const line = read('v2', 'features', 'dictation', 'VoiceClipLine.tsx');
  assert.match(line, /held === 'waiting' \|\| held === 'saving' \? \(\s*<>\s*<span>Saving the voice…<\/span>/);
  assert.match(line, /<span>The voice didn’t save<\/span>[\s\S]*?retryHeldVoice\(pending\);[\s\S]*?Try again/);
  const composer = read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx');
  // The words go at once: no upload before the send.
  assert.doesNotMatch(composer, /dictationApi\.uploadClip/);
  assert.match(composer, /await sendDraft\(text, voiceClip\);/);
});

test('the voice is recorded at 32 kbps, so a phone uploads it quickly', () => {
  const controller = read('v2', 'features', 'dictation', 'dictation-controller.ts');
  assert.match(controller, /export const DICTATION_BITRATE = 32_000;/);
  assert.match(controller, /new MediaRecorder\(this\.stream, \{ mimeType: mime, audioBitsPerSecond: DICTATION_BITRATE \}\)/);
  assert.match(read('lib', 'api', 'dictation.ts'), /if \(messageId !== undefined\) body\.append\('message_id', String\(messageId\)\);/);
});
