import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';

import type { VoiceServerTurn } from '@/types/voice-test';
import {
  applyCallEvent,
  delayCsv,
  delayRows,
  EMPTY_CALL_LOG,
  exhaustedBlock,
  isResearchMarker,
  mayPassResultIn,
  researchRows,
  secondsLabel,
  spokenText,
  type CallEvent,
  type CallLog,
} from './voice-model';

/* The staff voice test page (thread ac47b1df; Backend's shapes of 21
 * November 2026). TEST DATA throughout. */

const play = (events: [CallEvent, number][]): CallLog =>
  events.reduce((log, [event, at]) => applyCallEvent(log, event, at), EMPTY_CALL_LOG);
const you = (text: string): CallEvent => ({ kind: 'message', message: { source: 'user', text } });
const lawexa = (text: string): CallEvent => ({ kind: 'message', message: { source: 'ai', text } });
const speaking: CallEvent = { kind: 'mode', mode: 'speaking' };
const listening: CallEvent = { kind: 'mode', mode: 'listening' };

test('audio tags are spoken but never shown; the research marker is never a line', () => {
  assert.equal(spokenText('[thoughtful] Under the  Tenancy Law [laughs] a notice'), 'Under the Tenancy Law a notice');
  assert.equal(spokenText('[sighs]'), '');
  assert.equal(spokenText('See Bello v Ade [2019] 1 NWLR (Pt. 1650) 1 [Warmly] on service.'), 'See Bello v Ade [2019] 1 NWLR (Pt. 1650) 1 on service.', 'a citation keeps its year');
  assert.equal(spokenText('The court said [the appellant] was wrong [clears throat].'), 'The court said [the appellant] was wrong .', 'only the server’s tag words go');
  assert.equal(isResearchMarker('[[lawexa:research_ready:abc]]'), true);
  assert.equal(isResearchMarker('  [[lawexa:research_ready:abc]]'), true);
  assert.equal(isResearchMarker('Is there a case on it?'), false);
});

test('a plain answer: the first sound is timed from the end of the question', () => {
  const log = play([
    [speaking, 0],
    [lawexa('Hello, I’m Lawexa.'), 10],
    [listening, 1500],
    [you('TEST DATA. Is pasting a notice valid service?'), 4000],
    [speaking, 5100],
    [lawexa('[thoughtful] Not unless the agreement allows it.'), 5120],
    [listening, 8000],
  ]);
  assert.deepEqual(log.lines.map((line) => [line.who, line.text]), [
    ['lawexa', 'Hello, I’m Lawexa.'],
    ['you', 'TEST DATA. Is pasting a notice valid service?'],
    ['lawexa', 'Not unless the agreement allows it.'],
  ]);
  assert.equal(log.turns.length, 1, 'the greeting before any question is no turn');
  const [row] = delayRows(log.turns, []);
  assert.equal(row.firstSound, 1.1);
  assert.equal(row.research, false);
  assert.equal(row.answerSound, null);
  assert.equal(row.lawexaSaid, 'Not unless the agreement allows it.');
});

test('a research turn: the holding line first, then the answer after the marker, with the server timings beside', () => {
  const log = play([
    [you('TEST DATA. Is there a case that says so?'), 1000],
    [speaking, 1700],
    [lawexa('Ehen... let me check that.'), 1710],
    [listening, 3000],
    [{ kind: 'marker' }, 6200],
    [you('[[lawexa:research_ready:t1]]'), 6210],
    [speaking, 6900],
    [lawexa('I found two Court of Appeal decisions.'), 6920],
    [listening, 9000],
  ]);
  assert.equal(log.turns.length, 1, 'the marker echoed back is not a new question');
  assert.equal(log.lines.filter((line) => line.who === 'you').length, 1, 'the marker is never shown');
  const server: VoiceServerTurn = {
    uuid: 't1', user_text: 'TEST DATA. Is there a case that says so?', kind: 'research', answer_text: 'x', tags: [],
    received_at: null, first_text_at: null, filler_sent_at: null, research_started_at: null, research_done_at: null, research_spoken_at: null,
    first_text_ms: 420, research_ms: 4800,
  };
  const [row] = delayRows(log.turns, [server]);
  assert.equal(row.firstSound, 0.7);
  assert.equal(row.research, true);
  assert.equal(row.answerSound, 5.9);
  assert.equal(row.serverFirstText, 0.42);
  assert.equal(row.serverResearch, 4.8);
  assert.equal(row.lawexaSaid, 'Ehen... let me check that. I found two Court of Appeal decisions.');
  assert.equal(secondsLabel(row.answerSound), '5.9 s');
  assert.equal(secondsLabel(null), '–');
});

test('the table copies as CSV, quoting what needs it', () => {
  const log = play([[you('TEST DATA. Is "pasting", valid?'), 0], [speaking, 1234]]);
  const csv = delayCsv(delayRows(log.turns, []), 'c', 'Temitope');
  const [header, row] = csv.split('\n');
  assert.equal(header, 'call,voice,turn,you said,lawexa said,first sound s,research,answer sound s,server first text s,server research s');
  assert.equal(row, 'c,Temitope,1,"TEST DATA. Is ""pasting"", valid?",,1.23,no,,,');
});

test('out of messages at Call is typed chat refusal: a 403 with ai_messages_exhausted gives its block, anything else none', () => {
  const refusal = (status: number, errors: unknown) =>
    new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, { status, statusText: '', headers: {}, config: {} as never, data: { success: false, message: 'No messages left.', errors } });
  const block = { code: 'ai_messages_exhausted', reason: 'plan_limit_reached', message: 'You have used all your messages.', resets_at: '2026-12-01T00:00:00Z' };
  assert.deepEqual(exhaustedBlock(refusal(403, block)), block);
  assert.equal(exhaustedBlock(refusal(403, { reason: 'no_access' })), null);
  assert.equal(exhaustedBlock(refusal(503, block)), null);
  assert.equal(exhaustedBlock(new Error('offline')), null);
});

// ── Lawexa voice (mode a; Backend, 22 November 2026) ──────────────────────

test('an a call’s research answer passed into the call is never shown as the caller’s words', () => {
  const marker = '[[LAWEXA RESULT for "TEST DATA. Is a pasted quit notice valid?"]] TEST DATA. Usually not.';
  assert.equal(isResearchMarker(marker), true);
  const log = applyCallEvent(EMPTY_CALL_LOG, { kind: 'message', message: { source: 'user', text: marker } }, 100);
  assert.deepEqual(log.lines, []);
});

test('the voice reading a passed-in answer times it, oldest first; research rows match by the turn', () => {
  let log: CallLog = EMPTY_CALL_LOG;
  log = applyCallEvent(log, { kind: 'delivered', turnUuid: 't1' }, 1000);
  log = applyCallEvent(log, { kind: 'delivered', turnUuid: 't2' }, 1500);
  log = applyCallEvent(log, { kind: 'mode', mode: 'speaking' }, 1800);
  log = applyCallEvent(log, { kind: 'mode', mode: 'listening' }, 5000);
  log = applyCallEvent(log, { kind: 'mode', mode: 'speaking' }, 5600);
  assert.deepEqual(log.deliveries.map((d) => d.spokenAt), [1800, 5600]);
  const turn = (uuid: string, kind: VoiceServerTurn['kind'], ms: number | null) =>
    ({ uuid, user_text: `TEST DATA ${uuid}`, kind, answer_text: '', tags: [], received_at: null, first_text_at: null, filler_sent_at: null,
      research_started_at: null, research_done_at: null, research_spoken_at: null, first_text_ms: null, research_ms: ms }) satisfies VoiceServerTurn;
  const rows = researchRows(
    [turn('t1', 'research', 4200), turn('t2', 'research', 6100), turn('t3', 'queued', null), turn('t4', 'failed', null), turn('t5', 'dropped', null), turn('x', 'answer', null)],
    log.deliveries,
  );
  assert.deepEqual(rows.map((r) => [r.question, r.status, r.research, r.spokenAfter]), [
    ['TEST DATA t1', 'done', 4.2, 0.8],
    ['TEST DATA t2', 'done', 6.1, 4.1],
    ['TEST DATA t3', 'queued', null, null],
    ['TEST DATA t4', 'failed', null, null],
    ['TEST DATA t5', 'dropped', null, null],
  ]);
});

test('a research answer goes in only on a quiet line: not while the voice speaks or the caller talks, and one at a time', () => {
  const base = { now: 10_000, live: true, speaking: false, callerVoiceAt: null, inFlight: null };
  assert.equal(mayPassResultIn(base), true);
  assert.equal(mayPassResultIn({ ...base, live: false }), false);
  assert.equal(mayPassResultIn({ ...base, speaking: true }), false);
  // The caller talked 0.5 s ago: wait; 1 s ago: quiet enough.
  assert.equal(mayPassResultIn({ ...base, callerVoiceAt: 9_500 }), false);
  assert.equal(mayPassResultIn({ ...base, callerVoiceAt: 9_000 }), true);
  // The answer before is passed in but not started: wait, up to 8 s, then go on.
  assert.equal(mayPassResultIn({ ...base, inFlight: { turnUuid: 't1', sentAt: 9_000, startedAt: null } }), false);
  assert.equal(mayPassResultIn({ ...base, now: 17_000, inFlight: { turnUuid: 't1', sentAt: 9_000, startedAt: null } }), true);
  // Started and not finished: wait, up to 2 minutes.
  assert.equal(mayPassResultIn({ ...base, inFlight: { turnUuid: 't1', sentAt: 5_000, startedAt: 6_000 } }), false);
  assert.equal(mayPassResultIn({ ...base, now: 126_000, inFlight: { turnUuid: 't1', sentAt: 5_000, startedAt: 6_000 } }), true);
});
