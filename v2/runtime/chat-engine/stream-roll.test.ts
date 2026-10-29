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

test('the planned drop starts no stall clock; the server alone decides when the text is seeded', () => {
  const source = engine();
  const onerror = source.slice(source.indexOf('es.onerror = () => {'));
  assert.match(onerror, /if \(es\.readyState === CONNECTING\) \{[\s\S]*?if \(pausedRoll\) return;\s*\/\/[^\n]*\n[^\n]*\n\s*reconnectingSince = Date\.now\(\);/);
  // Backend's 6de74c55: `connected` carries `accumulated_text` only when the
  // server will not replay from Last-Event-ID, so the app seeds whenever it is
  // there, after a pause too, and a pause only ends on its reconnect.
  const connected = source.slice(source.indexOf("es.addEventListener('connected'"), source.indexOf('handlers.onConnected?.();'));
  assert.match(connected, /pausedRoll = false;\s*const data = parseEvent<ConnectedEvent>/);
  assert.match(connected, /if \(data\?\.accumulated_text\) \{/);
  assert.doesNotMatch(connected, /rolled/);
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

test('a planned drop never leaks into the next stream: the flag clears with every reset of the reconnect clock', () => {
  const source = engine();
  // Paused, then the turn fell back to polling: the watchdog's start, the stall
  // recovery, the end-before-completed path and a new turn each clear it, so the
  // next turn's first real drop arms the clock and its reconnect seeds the text.
  const body = (name: string) => source.slice(source.indexOf(name), source.indexOf('\n  }\n', source.indexOf(name)));
  assert.match(body('function startWatchdog() {'), /reconnectingSince = 0;\s*pausedRoll = false;/);
  assert.match(body('function recoverFromStall('), /reconnectingSince = 0;\s*pausedRoll = false;/);
  const ended = source.slice(source.indexOf("es.addEventListener('end'"), source.indexOf("es.addEventListener('timeout'"));
  assert.match(ended, /reconnectingSince = 0;\s*pausedRoll = false;\s*pollForCompletion\(convId\);/);
  assert.match(source, /lastProgressAt = 0;\s*reconnectingSince = 0;\s*pausedRoll = false;\s*dedupKeys = new Set\(\);/);
  // Every reset of the clock clears the flag: none is missed.
  const resets = source.match(/reconnectingSince = 0;/g)?.length ?? 0;
  const clears = source.match(/reconnectingSince = 0;\s*pausedRoll = false;/g)?.length ?? 0;
  assert.equal(clears, resets - 1, 'every reset but the declaration clears the flag');
});

test('the classic chat (staff on the classic design) rolls too: it seeds as the server says, with a 25-minute cap', () => {
  const classic = readFileSync(join(process.cwd(), 'lib', 'hooks', 'useChatStream.ts'), 'utf8');
  assert.match(classic, /const POLL_MAX_DURATION_MS = 25 \* 60_000;/);
  // The pause only freshens the 60 s watchdog's clock; no flag, no seed rule of its own.
  assert.match(classic, /eventSource\.addEventListener\('stream_paused', \(\) => \{\s*lastEventTimeRef\.current = Date\.now\(\);\s*\}\);/);
  assert.match(classic, /if \(data\.accumulated_text\) \{/);
  assert.doesNotMatch(classic, /pausedRollRef|rolled/);
});
