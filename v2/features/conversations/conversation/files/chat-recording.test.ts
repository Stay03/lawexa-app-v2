import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolMessage } from '@/types/chat';
import { chatRecording, isRecordingStep, recordingLength, recordingStepAction } from './chat-recording';

/* Call recordings in the chat (Techlead's go, 13 November 2026): the recording
 * box_record_stop saved plays in a card after the step chain, by its file id,
 * and the two steps say what they did. The result shape below is the
 * server's own (lawexa-api UserBoxService::recordStop, API 31955cc4). */

const here = dirname(fileURLToPath(import.meta.url));
const readHere = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const STOPPED = {
  file_id: 5501,
  name: 'Call recording 2026-11-13 10.35 UTC.ogg',
  url: 'https://files.example.test/recording.ogg?X-Amz-Expires=3600',
  seconds: 1342,
  bytes: 196828,
  reason: 'stopped',
};
const step = (extra: Partial<ToolMessage> = {}): ToolMessage =>
  ({
    id: 's1',
    role: 'tool',
    messageType: 'tool',
    toolName: 'box_record_stop',
    toolStatus: 'complete',
    toolParameters: {},
    toolResult: { success: true, data: STOPPED, error: null },
    content: '',
    timestamp: new Date('2026-11-13T10:58:00Z'),
    ...extra,
  }) as ToolMessage;

test('a finished box_record_stop step gives the recording by its file id, never the 60-minute link', () => {
  assert.deepEqual(chatRecording(step()), { fileId: 5501, name: STOPPED.name, length: '22 min' });
  // A stored result can carry the data inside its own { data } envelope.
  assert.deepEqual(chatRecording(step({ toolResult: { success: true, data: { success: true, data: STOPPED }, error: null } })), {
    fileId: 5501,
    name: STOPPED.name,
    length: '22 min',
  });
});

test('no card for another tool, a running or failed step, an unloaded result, or no file id', () => {
  assert.equal(chatRecording(step({ toolName: 'box_record_start' })), null);
  assert.equal(chatRecording(step({ toolStatus: 'running' } as Partial<ToolMessage>)), null);
  assert.equal(chatRecording(step({ toolResult: { success: false, data: null, error: 'save_failed' } })), null);
  assert.equal(chatRecording(step({ toolResult: undefined })), null);
  assert.equal(chatRecording(step({ toolResult: { success: true, data: { ...STOPPED, file_id: '5501' }, error: null } })), null);
  assert.equal(chatRecording(step({ toolResult: { success: true, data: { ...STOPPED, file_id: 0 }, error: null } })), null);
  assert.equal(isRecordingStep(step({ toolName: 'list_files' })), false);
});

test('a result without a name or a length still plays, named plainly', () => {
  const bare = chatRecording(step({ toolResult: { success: true, data: { file_id: 7 }, error: null } }));
  assert.deepEqual(bare, { fileId: 7, name: 'Call recording', length: null });
});

test('the length reads in seconds, minutes, then hours and minutes', () => {
  assert.equal(recordingLength(42), '42 s');
  assert.equal(recordingLength(60), '1 min');
  assert.equal(recordingLength(1342), '22 min');
  assert.equal(recordingLength(3600), '1 h');
  assert.equal(recordingLength(3900), '1 h 5 min');
  assert.equal(recordingLength(-1), null);
  assert.equal(recordingLength('1342'), null);
  assert.equal(recordingLength(Number.NaN), null);
});

test('the two steps say what they did, in place of "Box Record Start" and "Box Record Stop"', () => {
  assert.equal(recordingStepAction('box_record_start', false), 'Starting to record...');
  assert.equal(recordingStepAction('box_record_start', true), 'Started recording');
  assert.equal(recordingStepAction('box_record_stop', false), 'Saving the recording...');
  assert.equal(recordingStepAction('box_record_stop', true), 'Saved the recording');
  assert.equal(recordingStepAction('box_click', true), null);
  // The step item takes them for both tools.
  assert.match(
    readHere('..', 'tools', 'ToolStepItem.tsx'),
    /case RECORD_START_TOOL:\s*case RECORD_STOP_TOOL:\s*return \{ action: recordingStepAction\(toolName, isComplete\) \?\? toolName \};/,
  );
});

test('the card plays by the file id through the shared player, and sits after the chain', () => {
  const card = readHere('RecordingCard.tsx');
  assert.match(card, /<MediaPlayer\s+file=\{\{ id: recording\.fileId, original_name: recording\.name \}\}\s+kind="audio"/);
  assert.doesNotMatch(card, /\.url\b|STOPPED|href=\{recording/);
  const list = readHere('..', 'MessageList.tsx');
  assert.match(list, /const recordingSteps = steps\.filter\(isRecordingStep\);/);
  assert.match(list, /\{recordingSteps\.map\(\(step\) => \(\s*<RecordingCard key=\{step\.id\} message=\{step\} \/>\s*\)\)\}/);
});
