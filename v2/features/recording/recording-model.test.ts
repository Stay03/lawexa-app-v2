import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLiveEvent,
  channelRecordingTarget,
  clock,
  EMPTY_TRANSCRIPT,
  finalSteps,
  micProblem,
  pickAudioMime,
  retryDelayMs,
  savedUpToLine,
  liveTranscriptNote,
  startProblemLine,
} from './recording-model';
import { PieceQueue } from './piece-queue';

/* The recorder (thread ac47b1df; the design Stay OK'd on 20 November 2026).
 * TEST DATA only. */

test('the clock reads minutes and seconds, and hours past an hour', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(767), '12:47');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(clock(-3), '0:00');
});

test('the saved audio is Opus in WebM where the browser has it, else MP4 (iPhone)', () => {
  assert.equal(pickAudioMime((mime) => mime.startsWith('audio/webm')), 'audio/webm;codecs=opus');
  assert.equal(pickAudioMime((mime) => mime === 'audio/mp4'), 'audio/mp4');
  assert.equal(pickAudioMime(() => false), null);
});

test('a refused microphone says what to do', () => {
  assert.equal(micProblem({ name: 'NotAllowedError' }), 'mic_denied');
  assert.equal(micProblem({ name: 'NotFoundError' }), 'no_mic');
  assert.equal(micProblem({ name: 'NotReadableError' }), 'mic_busy');
  assert.equal(micProblem(new Error('x')), 'unsupported');
  assert.equal(startProblemLine('mic_busy'), 'Another app is using your microphone. Close it, then try again.');
  assert.match(startProblemLine('mic_denied'), /Allow it in your browser’s site settings/);
  assert.equal(startProblemLine('server', 'TEST DATA. Recording is busy.'), 'TEST DATA. Recording is busy.');
  assert.equal(startProblemLine('server'), 'The recording didn’t start. Try again.');
});

test('after Stop the three steps follow the server, as the finalising card shows them', () => {
  assert.deepEqual(finalSteps('uploading', 767).map((s) => s.state), ['now', 'next', 'next']);
  assert.deepEqual(
    finalSteps('transcribing', 767).map((s) => [s.label, s.state]),
    [['Audio saved, 12:47', 'done'], ['Writing the final transcript', 'now'], ['Summary and action items', 'next']],
  );
  assert.deepEqual(finalSteps('summarising', 767).map((s) => s.state), ['done', 'done', 'now']);
  assert.deepEqual(finalSteps('done', 767).map((s) => s.state), ['done', 'done', 'done']);
});

test('the live transcript: a partial is the faint line, a committed segment settles it as its own line', () => {
  let t = applyLiveEvent(EMPTY_TRANSCRIPT, { kind: 'partial', text: 'TEST DATA. So the landlord', at: 2 });
  assert.deepEqual(t.hearing, { id: 'hearing', at: 2, text: 'TEST DATA. So the landlord' });
  t = applyLiveEvent(t, { kind: 'partial', text: 'TEST DATA. So the landlord served', at: 3 });
  assert.equal(t.hearing?.at, 2, 'the line keeps the time it started');
  t = applyLiveEvent(t, { kind: 'committed', text: 'TEST DATA. So the landlord served the notice.', at: 4 });
  assert.equal(t.hearing, null);
  assert.deepEqual(t.lines, [{ id: 'line-0', at: 2, text: 'TEST DATA. So the landlord served the notice.' }]);
  t = applyLiveEvent(t, { kind: 'committed', text: 'Nobody handed it to you?', at: 9 });
  assert.deepEqual(t.lines.map((l) => l.id), ['line-0', 'line-1']);
  assert.equal(applyLiveEvent(t, { kind: 'committed', text: '  ', at: 12 }).lines.length, 2, 'an empty commit adds nothing');
  // Option b's labels arrive after a segment settles, and split that line by who spoke.
  const turns = [{ speaker: 'Speaker 2', text: 'Nobody handed' }, { speaker: 'Speaker 1', text: 'it to you?' }];
  const labelled = applyLiveEvent(t, { kind: 'speakers', lineIndex: 1, turns });
  assert.deepEqual(labelled.lines[1].turns, turns);
  assert.equal(labelled.lines[1].text, 'Nobody handed it to you?', 'the line keeps its text');
  assert.equal(labelled.lines[0].turns, undefined);
  assert.equal(applyLiveEvent(t, { kind: 'speakers', lineIndex: 9, turns }), t, 'labels for no line change nothing');
  assert.equal(applyLiveEvent(t, { kind: 'speakers', lineIndex: 1, turns: [] }), t, 'no turns change nothing');
  assert.equal(liveTranscriptNote(false), 'Live transcript. Speakers are named in the final transcript.');
  assert.equal(liveTranscriptNote(true), 'Live transcript. Speakers are checked again in the final transcript.');
});

test('the lines under the recorder', () => {
  assert.equal(savedUpToLine(0), null);
  assert.equal(savedUpToLine(25), 'Saved up to 12:30');
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(retryDelayMs), [2000, 4000, 8000, 16000, 30000, 30000]);
});

test('pieces go up in order, a failure is tried again, and Stop waits for all of them', async () => {
  const sent: number[] = [];
  let failNext = 1;
  const savedReports: number[] = [];
  const queue = new PieceQueue(
    async (seq) => {
      if (seq === 1 && failNext > 0) {
        failNext -= 1;
        throw new Error('TEST DATA offline');
      }
      sent.push(seq);
    },
    (saved) => savedReports.push(saved),
    async () => {},
  );
  queue.push(new Blob(['a']));
  queue.push(new Blob(['b']));
  queue.push(new Blob([]));
  queue.push(new Blob(['c']));
  await queue.drain();
  assert.deepEqual(sent, [0, 1, 2], 'in order, the failed piece sent again, the empty one skipped');
  assert.equal(queue.count, 3);
  assert.equal(queue.savedPieces, 3);
  assert.deepEqual(queue.missing, []);
  assert.deepEqual(savedReports, [1, 2, 3]);
  queue.resend([1]);
  await queue.drain();
  assert.deepEqual(sent, [0, 1, 2, 1], 'a piece the server lacks goes again');
});

test('a recording in a Space thread names the Space, the parent channel and the thread; in a channel, the channel', () => {
  const space = { uuid: 'space-1', name: 'TEST DATA Chambers', type: 'private' } as never;
  assert.deepEqual(channelRecordingTarget({ uuid: 'ch-1', is_thread: false, parent_channel_uuid: null, space }), { space_uuid: 'space-1', channel_uuid: 'ch-1' });
  assert.deepEqual(
    channelRecordingTarget({ uuid: 'th-1', is_thread: true, parent_channel_uuid: 'ch-1', space }),
    { space_uuid: 'space-1', channel_uuid: 'ch-1', thread_uuid: 'th-1' },
  );
  assert.deepEqual(channelRecordingTarget({ uuid: 'th-2', is_thread: true, parent_channel_uuid: null, space }), { space_uuid: 'space-1', channel_uuid: 'th-2' }, 'a thread payload without its parent records into itself');
});

