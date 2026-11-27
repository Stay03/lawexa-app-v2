import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ElevenLabsLiveSession, LIVE_QUEUE_MAX } from '../recording/elevenlabs-live';
import { dictateOffer } from './dictation-model';

/* Lucy's voice rehearsal for Arthur's pitch (27 November 2026, 27b5052f):
 * "Lawexa, file…" arrived as "File…" because the live socket took about
 * 1.5 s to open, and the mic went away once a file was attached. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

/** A socket that opens when the test says so, and keeps what was sent. */
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static last: FakeSocket | null = null;
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
}

const CONFIG = { token: 'FIXTURE', expires_at: '', model_id: 'FIXTURE', keyterms: [], language_code: 'en' } as never;
const pcm = (n: number) => new Uint8Array([n]).buffer;
const sentBytes = (socket: FakeSocket) =>
  socket.sent.map((raw) => atob((JSON.parse(raw) as { audio_base_64: string }).audio_base_64).charCodeAt(0));

function withFakeSocket(run: () => void) {
  const real = globalThis.WebSocket;
  (globalThis as { WebSocket: unknown }).WebSocket = FakeSocket;
  try {
    run();
  } finally {
    (globalThis as { WebSocket: unknown }).WebSocket = real;
  }
}

const session = () =>
  new ElevenLabsLiveSession({ onMessage: () => {}, onDropped: () => {} }, () => 0, () => 0);

test('no audio is lost while the live socket opens: it goes first, in order', () => {
  withFakeSocket(() => {
    const live = session();
    // Spoken before the token came: handed over before the socket exists.
    live.send(pcm(1));
    live.open(CONFIG, false);
    live.send(pcm(2));
    live.send(pcm(3));
    const socket = FakeSocket.last!;
    assert.deepEqual(socket.sent, [], 'nothing goes before the socket opens');
    socket.open();
    live.send(pcm(4));
    assert.deepEqual(sentBytes(socket), [1, 2, 3, 4]);
  });
});

test('the wait keeps at most ten seconds, the newest', () => {
  withFakeSocket(() => {
    const live = session();
    live.open(CONFIG, false);
    for (let n = 0; n < LIVE_QUEUE_MAX + 5; n += 1) live.send(pcm(n));
    FakeSocket.last!.open();
    const bytes = sentBytes(FakeSocket.last!);
    assert.equal(bytes.length, LIVE_QUEUE_MAX);
    assert.equal(bytes[0], 5);
  });
});

test('closing drops the waiting audio', () => {
  withFakeSocket(() => {
    const live = session();
    live.open(CONFIG, false);
    live.send(pcm(1));
    const socket = FakeSocket.last!;
    live.close();
    socket.readyState = FakeSocket.OPEN;
    socket.onopen?.();
    assert.deepEqual(socket.sent, []);
  });
});

test('the beep means speak now: audio is taken from the mic, a refusal comes before any beep', () => {
  const controller = read('v2', 'features', 'dictation', 'dictation-controller.ts');
  const start = controller.slice(controller.indexOf('start = async () => {'), controller.indexOf('private startCalledOff'));
  const askToken = start.indexOf('const token = dictationApi.liveToken()');
  const mic = start.indexOf('await navigator.mediaDevices.getUserMedia(');
  const capture = start.indexOf('await this.startCapture();');
  const tokenIn = start.indexOf('live = await token;');
  const beep = start.indexOf('playStartBeep();');
  const open = start.indexOf('this.openLive(live);');
  assert.ok(askToken > 0 && mic > askToken, 'the token is asked for at the tap, beside the microphone');
  assert.ok(capture > mic && tokenIn > capture && beep > tokenIn && open > beep, 'capture, the token, the beep, then the socket');
  // Audio heard before the session exists waits, and goes first into it.
  assert.match(controller, /if \(this\.live\) this\.live\.send\(event\.data\.pcm\);\s*else \{\s*this\.early\.push\(event\.data\.pcm\);/);
  assert.match(controller, /session\.open\(config, false\);[\s\S]*?for \(const pcm of this\.early\) session\.send\(pcm\);\s*this\.early = \[\];\s*this\.live = session;/);
});

test('the mic stays with attachments: beside Send when only files are there', () => {
  assert.equal(dictateOffer(true, false, '', 0), 'instead');
  assert.equal(dictateOffer(true, false, '', 2), 'beside');
  assert.equal(dictateOffer(true, false, 'FIXTURE', 2), null);
  assert.equal(dictateOffer(true, true, '', 2), null);
  assert.equal(dictateOffer(false, false, '', 2), null);
  const panel = read('v2', 'features', 'dictation', 'DictationPanel.tsx');
  assert.match(panel, /\{onAttach \? \(\s*<button type="button" aria-label="Attach files" onClick=\{onAttach\}/);
  // + stays first, where it sits in the box, and X follows it (Arthur, 27 November 2026).
  assert.ok(panel.indexOf('aria-label="Attach files"') < panel.indexOf('aria-label="Cancel dictation"'), '+ before X');
});
