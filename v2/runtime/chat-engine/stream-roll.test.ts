import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stallVerdict, STALL_RECONNECT_MS } from './stall';

/* The 5-minute stream fix (thread 96ed15f3, Backend's A with the Fable review's
 * amendments, approved 29 October 2026). At its 5-minute limit the server says
 * `stream_paused` and ends this connection's body without `end`, while the
 * answer goes on. The transport reconnects with Last-Event-ID as for any drop.
 * The app only has to treat that drop as planned, and to keep checking the
 * turn's status for as long as the job may run. The engine is driven by a live
 * stream, so it is pinned by source; the stall rule is pure, tested by numbers. */

const engine = () => readFileSync(join(process.cwd(), 'v2', 'runtime', 'chat-engine', 'engine.ts'), 'utf8');

test('stream_paused marks the next drop as planned, and nothing else', () => {
  const source = engine();
  const paused = source.slice(source.indexOf("es.addEventListener('stream_paused'"), source.indexOf("es.addEventListener('heartbeat'"));
  assert.match(paused, /lastEventTime = Date\.now\(\);\s*pausedRoll = true;/);
  // No close, no poll, no error: the transport reconnects by itself.
  assert.doesNotMatch(paused, /close\(|pollForCompletion|reportChatError|setState/);
});

test('the planned drop starts no stall clock, and its reconnect does not seed the text twice', () => {
  const source = engine();
  const onerror = source.slice(source.indexOf('es.onerror = () => {'));
  assert.match(onerror, /if \(es\.readyState === CONNECTING\) \{[\s\S]*?if \(pausedRoll\) return;\s*\/\/[^\n]*\n[^\n]*\n\s*reconnectingSince = Date\.now\(\);/);
  const connected = source.slice(source.indexOf("es.addEventListener('connected'"));
  assert.match(connected, /const rolled = pausedRoll;\s*pausedRoll = false;/);
  assert.match(connected, /if \(data\?\.accumulated_text && !rolled\) \{/);
});

test('with no stall clock, a quiet reconnect after the pause stays live', () => {
  // The clock a planned drop leaves: `reconnectingSince` stays 0.
  const at = 1_000_000;
  const verdict = stallVerdict({
    now: at + STALL_RECONNECT_MS * 3,
    lastEventAt: at + STALL_RECONNECT_MS * 3 - 1_000,
    lastProgressAt: at,
    reconnectingSince: 0,
  });
  assert.equal(verdict, 'live');
  // The same quiet stream after an unplanned drop is still caught.
  assert.equal(
    stallVerdict({ now: at + STALL_RECONNECT_MS, lastEventAt: at + STALL_RECONNECT_MS - 1_000, lastProgressAt: at, reconnectingSince: at }),
    'reconnected-empty',
  );
});

test('the status check outlasts the job: 25 minutes, past its 20-minute limit', () => {
  const source = engine();
  assert.match(source, /const POLL_MAX_DURATION_MS = 25 \* 60_000;/);
  assert.doesNotMatch(source, /POLL_MAX_DURATION_MS = 600_000/);
});
