import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ApiMessage, ChatMessage } from '@/types/chat';
import { readRecordingMeta } from '@/lib/utils/recording-meta';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';

/* A finished recording's card in the chat (thread ac47b1df; Backend 21 November
 * 2026: role user, the person who recorded as author, metadata.type
 * "recording"; Lawexa's summary follows as a normal answer). TEST DATA. */

const META = {
  type: 'recording',
  recording_uuid: 'rec-1',
  duration_seconds: 767,
  speaker_count: 2,
  audio_file: { id: 41, name: 'Recording 2026-11-21 10.05 UTC.webm', mime_type: 'audio/webm', size: 6_500_000 },
  transcript_file: { id: 42, name: 'Transcript.docx', size: 24_000 },
};

test('the card reads the recording, its audio and its transcript from the message', () => {
  assert.deepEqual(readRecordingMeta(META), {
    recording_uuid: 'rec-1',
    duration_seconds: 767,
    speaker_count: 2,
    audio_file: { id: 41, name: 'Recording 2026-11-21 10.05 UTC.webm', size: 6_500_000, mime_type: 'audio/webm' },
    transcript_file: { id: 42, name: 'Transcript.docx', size: 24_000 },
  });
  assert.equal(readRecordingMeta({ ...META, type: 'radar_report' }), null);
  assert.equal(readRecordingMeta({ ...META, recording_uuid: 7 }), null, 'no recording without its id');
  assert.equal(readRecordingMeta(null), null);
  assert.deepEqual(readRecordingMeta({ type: 'recording', recording_uuid: 'rec-2' }), {
    recording_uuid: 'rec-2',
    duration_seconds: null,
    speaker_count: null,
    audio_file: null,
    transcript_file: null,
  }, 'a card still finishing has no files yet');
});

test("the person's recording message carries the card; Lawexa's summary after it is a plain answer", () => {
  const rows = transformApiMessages([
    { id: 1, conversation_id: 'c', agent_id: null, role: 'user', content: 'Recorded a meeting (12:47)', metadata: META, created_at: '2026-11-21T10:20:00Z' },
    { id: 2, conversation_id: 'c', agent_id: null, role: 'assistant', content: 'TEST DATA. Summary: the notice was served by pasting.', metadata: {}, created_at: '2026-11-21T10:21:00Z' },
  ] as unknown as ApiMessage[]);
  const card = rows[0] as ChatMessage;
  assert.equal(card.role, 'user');
  assert.equal(card.content, 'Recorded a meeting (12:47)');
  assert.equal(card.recording?.recording_uuid, 'rec-1');
  assert.equal((rows[1] as ChatMessage).recording, undefined);
});
