import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STALL_RECONNECT_MS, STALL_SILENCE_MS, stallVerdict } from './stall';

/* A phone sat on one narration line for more than 10 s while the server
 * finished the answer (Lucy, 20 October 2026, 15:50Z). The engine now stops
 * waiting on a stream that has stopped carrying the answer and follows the
 * turn by its status, as a reopen does. */

const T = 1_000_000;
const clock = (over: Partial<Parameters<typeof stallVerdict>[0]>) => ({
  now: T,
  lastEventAt: T,
  lastProgressAt: T,
  reconnectingSince: 0,
  ...over,
});

test('silent: no event of any kind for 10 s is a dead connection; a heartbeat keeps it alive', () => {
  assert.equal(STALL_SILENCE_MS, 10_000);
  assert.equal(stallVerdict(clock({ lastEventAt: T - 9_999 })), 'live');
  assert.equal(stallVerdict(clock({ lastEventAt: T - 10_000 })), 'silent');
  // A long tool step with heartbeats flowing and no text is alive: only the
  // last event of any kind counts here.
  assert.equal(stallVerdict(clock({ lastEventAt: T - 2_000, lastProgressAt: T - 50_000 })), 'live');
});

test('reconnected with nothing: no progress for 5 s after a reconnect, even with heartbeats', () => {
  assert.equal(STALL_RECONNECT_MS, 5_000);
  const since = T - 5_000;
  // Heartbeats keep coming, the last progress was before the drop.
  assert.equal(stallVerdict(clock({ lastEventAt: T - 1_000, lastProgressAt: since - 3_000, reconnectingSince: since })), 'reconnected-empty');
  // Four seconds in, still waiting.
  assert.equal(stallVerdict(clock({ lastEventAt: T - 1_000, lastProgressAt: since - 3_000, reconnectingSince: T - 4_000 })), 'live');
  // Progress after the reconnect: the stream is carrying the answer again.
  assert.equal(stallVerdict(clock({ lastEventAt: T, lastProgressAt: since + 500, reconnectingSince: since })), 'live');
  // No reconnect in progress: the reconnect rule does not apply.
  assert.equal(stallVerdict(clock({ lastProgressAt: T - 30_000, reconnectingSince: 0 })), 'live');
});

const engine = readFileSync(join(process.cwd(), 'v2', 'runtime', 'chat-engine', 'engine.ts'), 'utf8').replace(/\r\n/g, '\n');

test('the engine checks every second, and a stall follows the turn by its status at once', () => {
  assert.match(engine, /if \(verdict !== 'live'\) recoverFromStall\(\);\s*\}, STALL_CHECK_MS\);/);
  const recover = engine.slice(engine.indexOf('function recoverFromStall()'), engine.indexOf('// ─── Stale-stream check'));
  assert.match(recover, /eventSource\.close\(\);/);
  assert.match(recover, /pollForCompletion\(convId\);/);
  // Not a reconnect: the server cannot replay what the dead connection took.
  assert.doesNotMatch(recover, /reconnectStream\(\)/);
  // The status check goes out at once, then every few seconds.
  assert.match(engine, /void tick\(\);\s*pollInterval = setInterval\(\(\) => void tick\(\), POLL_INTERVAL_MS\);/);
});

test('a reconnect starts its own clock when the stream is back, and the handshake is not progress', () => {
  assert.match(engine, /if \(es\.readyState === CONNECTING\) \{[\s\S]*?reconnectingSince = Date\.now\(\);\s*return;/);
  assert.match(engine, /markDataEvent\(\);\s*\/\/[^\n]*\n[^\n]*\n\s*if \(reconnectingSince > 0\) reconnectingSince = Date\.now\(\);/);
  assert.match(engine, /lastDataEventTime = Date\.now\(\);\s*lastProgressAt = lastDataEventTime;/);
});
