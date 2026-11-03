import { test } from 'node:test';
import assert from 'node:assert/strict';

import { openMachineView, parseMachineMessage, type ViewHandlers, type ViewSocketLike } from './view-socket';

/* The live view's socket, driven by a fake WebSocket: the machine's pictures,
 * Lawexa's cursor and control changes come in; the person's input goes out. */

/** A WebSocket stand-in: the handlers the view sets, and what it sent. */
class FakeSocket {
  binaryType = '';
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sent: string[] = [];
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
}

function harness() {
  const seen: { frames: Blob[]; actions: unknown[]; modes: string[]; status: string[] } = { frames: [], actions: [], modes: [], status: [] };
  const handlers: ViewHandlers = {
    onFrame: (frame) => seen.frames.push(frame),
    onLawexaAction: (action) => seen.actions.push(action),
    onMode: (mode) => seen.modes.push(mode),
    onStatus: (status) => seen.status.push(status),
  };
  let socket: FakeSocket | null = null;
  const view = openMachineView('wss://userbox.test/boxes/u/view?token=t', handlers, (url) => {
    socket = new FakeSocket(url);
    return socket as unknown as ViewSocketLike;
  });
  return { view, seen, socket: socket as unknown as FakeSocket };
}

test('the view takes pictures as blobs, draws Lawexa’s cursor and follows control', () => {
  const { seen, socket } = harness();
  assert.equal(socket.url, 'wss://userbox.test/boxes/u/view?token=t');
  assert.equal(socket.binaryType, 'blob');
  socket.open();
  const frame = new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' });
  socket.onmessage?.({ data: frame });
  socket.onmessage?.({ data: JSON.stringify({ type: 'lawexa_action', kind: 'click', x: 640, y: 120 }) });
  socket.onmessage?.({ data: JSON.stringify({ type: 'lawexa_action', kind: 'type', x: null, y: null }) });
  socket.onmessage?.({ data: JSON.stringify({ type: 'mode', mode: 'user' }) });
  socket.onmessage?.({ data: 'not json' });
  assert.deepEqual(seen.status, ['open']);
  assert.equal(seen.frames.length, 1);
  assert.deepEqual(seen.actions, [
    { kind: 'click', x: 640, y: 120 },
    { kind: 'type', x: null, y: null },
  ]);
  assert.deepEqual(seen.modes, ['user']);
});

test('the person’s input goes out only while the view is open', () => {
  const { view, socket } = harness();
  assert.equal(view.send({ type: 'move', x: 1, y: 2 }), false);
  socket.open();
  assert.equal(view.send({ type: 'down', x: 10, y: 20, button: 'left' }), true);
  assert.equal(view.send({ type: 'key', key: 'ctrl+l' }), true);
  assert.deepEqual(socket.sent.map((data) => JSON.parse(data)), [
    { type: 'down', x: 10, y: 20, button: 'left' },
    { type: 'key', key: 'ctrl+l' },
  ]);
});

test('an end is reported once, and closing the view says nothing more', () => {
  const { seen, socket } = harness();
  socket.open();
  socket.onerror?.(new Event('error'));
  socket.onclose?.(new Event('close'));
  assert.deepEqual(seen.status, ['open', 'closed']);
  const second = harness();
  second.socket.open();
  second.view.close();
  assert.equal(second.socket.closed, true);
  assert.deepEqual(second.seen.status, ['open']);
  // Nothing goes out after the view closed.
  assert.equal(second.view.send({ type: 'move', x: 1, y: 1 }), false);
});

test('a message the panel does not use is left alone', () => {
  assert.equal(parseMachineMessage('{"type":"other"}'), null);
  assert.equal(parseMachineMessage('{"type":"mode","mode":"robot"}'), null);
  assert.equal(parseMachineMessage('[1,2]'), null);
  assert.deepEqual(parseMachineMessage('{"type":"lawexa_action","kind":"scroll","x":"9","y":3}'), {
    type: 'lawexa_action',
    action: { kind: 'scroll', x: null, y: 3 },
  });
});
