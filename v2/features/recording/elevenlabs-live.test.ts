import { test } from 'node:test';
import assert from 'node:assert/strict';

import { audioMessage, liveSocketUrl, parseLiveMessage, speakerTurns } from './elevenlabs-live';

/* ElevenLabs Scribe Live (thread ac47b1df). The messages below are the shapes
 * Backend's test session returned on 21 November 2026, with TEST DATA text. */

const CONFIG = {
  token: 'sutkn_TESTDATA',
  expires_at: '2026-11-21T04:00:00Z',
  model_id: 'scribe_v3_live',
  keyterms: ['Adebayo', 'Zenith Bank'],
  language_code: 'en',
};

test('the socket address carries the token, the format, voice commits, English and each keyterm', () => {
  const url = new URL(liveSocketUrl(CONFIG, { speakerLabels: false }));
  assert.equal(url.origin + url.pathname, 'wss://api.elevenlabs.io/v1/speech-to-text/realtime');
  assert.equal(url.searchParams.get('token'), 'sutkn_TESTDATA');
  assert.equal(url.searchParams.get('model_id'), 'scribe_v3_live');
  assert.equal(url.searchParams.get('audio_format'), 'pcm_16000');
  assert.equal(url.searchParams.get('commit_strategy'), 'vad');
  assert.equal(url.searchParams.get('language_code'), 'en');
  assert.deepEqual(url.searchParams.getAll('keyterms'), ['Adebayo', 'Zenith Bank']);
  assert.equal(url.searchParams.get('diarize'), null, 'no labels asked for while they are not shown');
  assert.equal(new URL(liveSocketUrl(CONFIG, { speakerLabels: true })).searchParams.get('diarize'), 'true');
});

test('the service messages become partial and settled lines', () => {
  assert.deepEqual(parseLiveMessage(JSON.stringify({ message_type: 'session_started', session_id: 'x', config: {} }), 0, 0), { kind: 'started' });
  assert.deepEqual(
    parseLiveMessage(JSON.stringify({ message_type: 'partial_transcript', text: 'TEST DATA. Hmm.', turn_probability: 0.43, words: [] }), 3, 0),
    { kind: 'event', event: { kind: 'partial', text: 'TEST DATA. Hmm.', at: 3 } },
  );
  assert.deepEqual(
    parseLiveMessage(JSON.stringify({ message_type: 'committed_transcript', text: 'TEST DATA. Good morning, Barrister Adebayo.', segment_index: 0 }), 5, 0),
    { kind: 'event', event: { kind: 'committed', text: 'TEST DATA. Good morning, Barrister Adebayo.', at: 5 } },
  );
  assert.deepEqual(parseLiveMessage(JSON.stringify({ message_type: 'committed_transcript_with_timestamps', text: 'x', words: [] }), 5, 1), { kind: 'ignore' });
  assert.deepEqual(parseLiveMessage('not json', 1, 0), { kind: 'ignore' });
});

test("speaker labels split the line they belong to by who spoke; refusals and the time limit are told apart", () => {
  // The e2e of 21 November 2026: one settled segment held both speakers.
  const word = (text: string, speaker: string | null, type = 'word') => ({ text, type, speaker_id: speaker });
  const diarized = {
    message_type: 'diarized_transcript', segment_index: 1, text: 'x',
    words: [
      word('When', 'speaker_0'), word(' ', null, 'spacing'), word('was', 'speaker_0'), word(' ', 'speaker_0', 'spacing'), word('it?', 'speaker_0'),
      word(' ', null, 'spacing'), word('On', 'speaker_1'), word(' ', null, 'spacing'), word('Monday.', 'speaker_1'),
      word(' ', null, 'spacing'), word('Thanks.', 'speaker_0'),
    ],
  };
  assert.deepEqual(parseLiveMessage(JSON.stringify(diarized), 6, 2), {
    kind: 'event',
    event: { kind: 'speakers', lineIndex: 1, turns: [
      { speaker: 'Speaker 1', text: 'When was it?' },
      { speaker: 'Speaker 2', text: 'On Monday.' },
      { speaker: 'Speaker 1', text: 'Thanks.' },
    ] },
  });
  assert.deepEqual(speakerTurns([word(' ', null, 'spacing'), word('Good', 'speaker_1')]), [{ speaker: 'Speaker 2', text: 'Good' }], 'a leading space belongs to no one');
  assert.deepEqual(parseLiveMessage(JSON.stringify({ message_type: 'diarized_transcript', words: [word(' ', null, 'spacing')] }), 6, 2), { kind: 'ignore' });
  assert.deepEqual(parseLiveMessage(JSON.stringify({ message_type: 'session_time_limit_exceeded', error: 'limit' }), 9, 0), { kind: 'expired' });
  assert.deepEqual(parseLiveMessage(JSON.stringify({ message_type: 'auth_error', error: 'TEST DATA bad token' }), 9, 0), { kind: 'error', message: 'TEST DATA bad token' });
});

test('audio goes as base64 PCM in the input_audio_chunk message; the end is an empty commit', () => {
  const pcm = new Int16Array([0, 1, -1]).buffer;
  const message = JSON.parse(audioMessage(pcm));
  assert.equal(message.message_type, 'input_audio_chunk');
  assert.equal(message.commit, false);
  assert.equal(message.sample_rate, 16000);
  assert.equal(Buffer.from(message.audio_base_64, 'base64').length, 6);
  assert.deepEqual(JSON.parse(audioMessage(new ArrayBuffer(0), true)), { message_type: 'input_audio_chunk', audio_base_64: '', commit: true, sample_rate: 16000 });
});
