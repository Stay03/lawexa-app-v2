import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  STALL_QUIET_CHECK_MS,
  STALL_RECONNECT_MS,
  STALL_SILENCE_MS,
  hiddenDuring,
  quietCheckDue,
  stallVerdict,
} from './stall';

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

test('silent: no event of any kind for 15 s, three missed heartbeats, is a dead connection; a heartbeat keeps it alive', () => {
  assert.equal(STALL_SILENCE_MS, 15_000);
  assert.equal(stallVerdict(clock({ lastEventAt: T - 14_999 })), 'live');
  assert.equal(stallVerdict(clock({ lastEventAt: T - 15_000 })), 'silent');
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
  assert.match(engine, /watchdog = setInterval\(watch, STALL_CHECK_MS\);/);
  assert.match(engine, /if \(verdict !== 'live'\) \{\s*recoverFromStall\(verdict\);\s*return;\s*\}/);
  const recover = engine.slice(engine.indexOf('function recoverFromStall('), engine.indexOf('// ─── Stale-stream check'));
  // The server cannot see a stall: the app reports it, with the answer's run.
  assert.match(recover, /code: 'stream_stall',[\s\S]*?conversationId,\s*executionId,/);
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

/* On desktop the stream went quiet 14 to 28 s after the answer was saved, and
 * its final event never came (the techlead, 4 November 2026). The engine now
 * asks the status once while the stream is quiet, and loads a saved answer
 * then. A phone that froze the page in the background is reported apart. */

test('quiet: one status check once a heartbeat is missed, and one per quiet spell', () => {
  assert.equal(STALL_QUIET_CHECK_MS, 6_000);
  // Under one missed heartbeat, nothing.
  assert.equal(quietCheckDue({ now: T, lastEventAt: T - 5_999, checkedAt: 0 }), false);
  assert.equal(quietCheckDue({ now: T, lastEventAt: T - 6_000, checkedAt: 0 }), true);
  // Checked in this spell: not again, however long it stays quiet.
  assert.equal(quietCheckDue({ now: T, lastEventAt: T - 12_000, checkedAt: T - 6_000 }), false);
  // An event since the check starts a new spell, due again once it is quiet.
  assert.equal(quietCheckDue({ now: T, lastEventAt: T - 6_000, checkedAt: T - 9_000 }), true);
  // The quiet check comes before the stall rule ends the stream.
  assert.ok(STALL_QUIET_CHECK_MS < STALL_SILENCE_MS);
});

test('hidden: the part of the quiet spell the page spent in the background', () => {
  const gap = (over: Partial<Parameters<typeof hiddenDuring>[0]>) => ({
    now: T,
    lastEventAt: T - 60_000,
    hiddenFrom: 0,
    hiddenUntil: 0,
    ...over,
  });
  // Never hidden.
  assert.equal(hiddenDuring(gap({})), 0);
  // Hidden 50 s into the gap, back 5 s ago.
  assert.equal(hiddenDuring(gap({ hiddenFrom: T - 55_000, hiddenUntil: T - 5_000 })), 50_000);
  // Still hidden: counted up to now.
  assert.equal(hiddenDuring(gap({ hiddenFrom: T - 20_000 })), 20_000);
  // Hidden before the last event and back since: only the part after the event counts.
  assert.equal(hiddenDuring(gap({ hiddenFrom: T - 90_000, hiddenUntil: T - 40_000 })), 20_000);
  // Back before the last event: the gap was all in view.
  assert.equal(hiddenDuring(gap({ hiddenFrom: T - 90_000, hiddenUntil: T - 70_000 })), 0);
});

test('the watchdog asks the status of a quiet stream, and a saved answer whose end never came is reported', () => {
  const watch = engine.slice(engine.indexOf('function watch()'), engine.indexOf('function onVisibility()'));
  assert.match(watch, /if \(quietCheckDue\(\{ now, lastEventAt: lastEventTime, checkedAt: quietCheckedAt \}\)\) \{\s*quietCheckedAt = now;\s*void checkStaleStream\(\{ quietSince: lastEventTime \}\);/);
  const check = engine.slice(engine.indexOf('async function checkStaleStream('), engine.indexOf('// ─── History adoption'));
  // The stream spoke while the status was on its way: it finishes the turn itself.
  assert.match(check, /if \(quiet && lastEventTime !== quiet\.quietSince\) return;/);
  // Saved: reported with the answer's run, then the stream is closed and the saved answer loaded.
  assert.match(check, /if \(response\.data\.status !== 'pending'\) \{\s*if \(quiet\) \{[\s\S]*?code: 'stream_end_missing',[\s\S]*?executionId,[\s\S]*?\}\s*stopWatchdog\(\);/);
  // The heartbeat path's check reports nothing: only `quiet` does.
  assert.match(engine, /void checkStaleStream\(\);/);
});

test('a page in the background is noted while a stream is open, and its gap reported apart', () => {
  const start = engine.slice(engine.indexOf('function startWatchdog()'), engine.indexOf('function recoverFromStall('));
  assert.match(start, /document\.addEventListener\('visibilitychange', onVisibility\);/);
  const stop = engine.slice(engine.indexOf('function stopWatchdog()'), engine.indexOf('function watch()'));
  assert.match(stop, /document\.removeEventListener\('visibilitychange', onVisibility\);/);
  // Back in view: looked at at once.
  const onVisibility = engine.slice(engine.indexOf('function onVisibility()'), engine.indexOf('function startWatchdog()'));
  assert.match(onVisibility, /hiddenUntil = Date\.now\(\);\s*if \(watchdog\) watch\(\);/);
  const recover = engine.slice(engine.indexOf('function recoverFromStall('), engine.indexOf('// ─── Stale-stream check'));
  assert.match(recover, /hiddenMs > 0\s*\?\s*\{\s*code: 'stream_background',\s*message: `The page was in the background for/);
});
