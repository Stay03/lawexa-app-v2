import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { BackgroundJob } from '@/types/background-jobs';
import {
  awaitsBackgroundJob,
  backgroundJobLabel,
  backgroundJobProgress,
  backgroundJobState,
  backgroundJobsByMessage,
  backgroundReturnLine,
  canCancelBackgroundJob,
  toolResultNamesBackgroundJob,
  waitingToResume,
} from './model';

/* Background jobs, app side (Backend's shapes 063d9cc3,
 * docs/api/background-jobs-shapes.md; thread 1874e291). TEST DATA only. */

const job = (over: Partial<BackgroundJob>): BackgroundJob => ({
  id: 'job-1',
  kind: 'file_transcription',
  kind_name: 'file reading',
  status: 'running',
  progress: null,
  started_at: '2026-11-11T09:00:00Z',
  finished_at: null,
  started_by_message_id: 10,
  wake: null,
  ...over,
});

test('a job’s state: running, replying while Lawexa has not answered, then its outcome', () => {
  assert.equal(backgroundJobState(job({})), 'running');
  assert.equal(backgroundJobState(job({ status: 'succeeded', wake: 'pending' })), 'replying');
  assert.equal(backgroundJobState(job({ status: 'failed', wake: 'pending' })), 'replying');
  assert.equal(backgroundJobState(job({ status: 'succeeded', wake: 'woken' })), 'done');
  assert.equal(backgroundJobState(job({ status: 'failed', wake: 'woken' })), 'failed');
  assert.equal(backgroundJobState(job({ status: 'cancelled' })), 'cancelled');
  assert.equal(backgroundJobState(job({ status: 'succeeded', wake: 'abandoned' })), 'unanswered');
});

test('the label says what runs, and how far it has got', () => {
  assert.equal(backgroundJobLabel(job({})), 'Running in the background: file reading');
  assert.equal(backgroundJobProgress(job({ progress: { done: 3, total: 10, unit: 'pages' } })), '3 / 10 pages');
  assert.equal(backgroundJobProgress(job({ progress: { done: 3, total: null, unit: 'scanned pages' } })), '3 scanned pages');
  assert.equal(backgroundJobProgress(job({ kind: 'case_import', kind_name: 'case import' })), null);
  assert.equal(backgroundJobLabel(job({ status: 'succeeded', wake: 'pending' })), 'File reading finished. Lawexa will reply shortly.');
  assert.equal(backgroundJobLabel(job({ status: 'failed', wake: 'pending' })), 'File reading failed. Lawexa will reply shortly.');
  assert.equal(backgroundJobLabel(job({ status: 'succeeded', wake: 'woken' })), 'File reading done');
  assert.equal(backgroundJobLabel(job({ status: 'failed', wake: 'woken' })), 'File reading failed');
  assert.equal(backgroundJobLabel(job({ status: 'cancelled' })), 'File reading cancelled');
  assert.equal(backgroundJobLabel(job({ kind: 'radar_scan', kind_name: 'Radar scan' })), 'Running in the background: Radar scan');
});

test('Cancel is offered while it can still do something', () => {
  assert.equal(canCancelBackgroundJob(job({})), true);
  assert.equal(canCancelBackgroundJob(job({ status: 'succeeded', wake: 'pending' })), true);
  assert.equal(canCancelBackgroundJob(job({ status: 'succeeded', wake: 'woken' })), false);
  assert.equal(canCancelBackgroundJob(job({ status: 'cancelled' })), false);
  assert.equal(canCancelBackgroundJob(job({ status: 'failed', wake: 'abandoned' })), false);
});

test('the chat waits while a job runs or Lawexa has yet to come back to one', () => {
  assert.equal(awaitsBackgroundJob([]), false);
  assert.equal(awaitsBackgroundJob([job({})]), true);
  assert.equal(awaitsBackgroundJob([job({ status: 'succeeded', wake: 'pending' })]), true);
  assert.equal(awaitsBackgroundJob([job({ status: 'succeeded', wake: 'woken' }), job({ status: 'cancelled' })]), false);
});

test('jobs are found by the message that started them, and a job whose message is gone by none', () => {
  const a = job({ id: 'a', started_by_message_id: 10 });
  const b = job({ id: 'b', started_by_message_id: 10 });
  const c = job({ id: 'c', started_by_message_id: 12 });
  const d = job({ id: 'd', started_by_message_id: null });
  const byMessage = backgroundJobsByMessage([a, b, c, d]);
  assert.deepEqual(byMessage.get(10)?.map((row) => row.id), ['a', 'b']);
  assert.deepEqual(byMessage.get(12)?.map((row) => row.id), ['c']);
  assert.equal(byMessage.size, 2);
});

test('Lawexa’s return reads from the jobs it names, never its content', () => {
  assert.equal(
    backgroundReturnLine([{ kind: 'file_transcription', outcome: 'succeeded' }]),
    'File reading finished. Lawexa is continuing.',
  );
  assert.equal(backgroundReturnLine([{ kind: 'case_import', outcome: 'failed' }]), 'Case import failed. Lawexa is continuing.');
  assert.equal(
    backgroundReturnLine([
      { kind: 'file_transcription', outcome: 'succeeded' },
      { kind: 'radar_scan', outcome: 'failed' },
    ]),
    '2 background jobs ended. Lawexa is continuing.',
  );
  assert.equal(backgroundReturnLine([]), 'Background work ended. Lawexa is continuing.');
});

test('a tool answer that started a background job is recognised, so the chat asks for its jobs at once', () => {
  // read_file's 202 on a file still being read, as the stream passes it on (the server's whole answer).
  const reading = {
    success: true,
    data: {
      success: true,
      message: 'The scanned pages of this file are still being read.',
      data: { background_job: { id: 'job-1', kind: 'file_transcription', status: 'running' } },
    },
    error: null,
  };
  assert.equal(toolResultNamesBackgroundJob(reading), true);
  // message_agent's send carries one too.
  const agent = { success: true, data: { success: true, message: 'Sent.', data: { ends_turn: true, background_job: { kind: 'agent_reply', status: 'running' } } }, error: null };
  assert.equal(toolResultNamesBackgroundJob(agent), true);
  // Every other answer: an ordinary read, a failed call, nothing at all.
  assert.equal(toolResultNamesBackgroundJob({ success: true, data: { success: true, message: 'ok', data: { text: 'TEST DATA' } }, error: null }), false);
  assert.equal(toolResultNamesBackgroundJob({ success: false, data: null, error: 'Timed out' }), false);
  assert.equal(toolResultNamesBackgroundJob({ success: true, data: { data: { background_job: null } }, error: null }), false);
  assert.equal(toolResultNamesBackgroundJob(null), false);
  assert.equal(toolResultNamesBackgroundJob(undefined), false);
});

test('the chat reads its jobs when a tool result names one, not only when the turn ends', () => {
  // The controller's onToolComplete: a short job's line shows while the turn still writes (Lucy's check 2).
  const controller = readFileSync(
    join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'useConversationController.ts'),
    'utf8',
  ).replace(/\r\n/g, '\n');
  assert.match(
    controller,
    /onToolComplete: \(event\) => \{\n(\s+\/\/[^\n]*\n)*\s+if \(toolResultNamesBackgroundJob\(event\.tool_result\)\) \{\n\s+void queryClient\.invalidateQueries\(\{ queryKey: conversationsQueries\.backgroundJobsOf\(conversationId\) \}\);/,
  );
});

test('a reading waiting to restart says so in place of its frozen count, keeps Cancel, and an older server reads as before', () => {
  const reading = job({ progress: { done: 50, total: 84, unit: 'scanned pages' } });
  // Backend's stall fix (ca11f4c8): waiting_to_resume on a running job.
  const paused = { ...reading, waiting_to_resume: true };
  assert.equal(waitingToResume(paused), true);
  assert.equal(backgroundJobLabel(paused), 'Reading paused · restarting automatically');
  assert.equal(backgroundJobProgress(paused), null);
  assert.equal(canCancelBackgroundJob(paused), true);
  // Moving again (false), or a server that sends no field: the running line and its count, as before.
  for (const moving of [{ ...reading, waiting_to_resume: false }, reading]) {
    assert.equal(waitingToResume(moving), false);
    assert.equal(backgroundJobLabel(moving), 'Running in the background: file reading');
    assert.equal(backgroundJobProgress(moving), '50 / 84 scanned pages');
  }
  // Only a running job waits: an ended one reads as it did.
  const ended = job({ status: 'succeeded', wake: 'woken', waiting_to_resume: true });
  assert.equal(waitingToResume(ended), false);
  assert.equal(backgroundJobLabel(ended), 'File reading done');
});
