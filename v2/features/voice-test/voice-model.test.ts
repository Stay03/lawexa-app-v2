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
  expectedSpokenMs,
  handOffFinished,
  handOffOnInterruption,
  handOffOnMode,
  handOffOnReply,
  isActionOutcome,
  MAX_EXPECTED_MS,
  mayPassResultIn,
  admitResult,
  emptyResultLine,
  isStillWorking,
  sentNoticeTurn,
  type HandOff,
  type ResultLine,
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

test('a research answer goes in only on a quiet line: not while the voice speaks or the caller talks', () => {
  const base = { now: 10_000, live: true, speaking: false, callerVoiceAt: null, inFlight: null };
  assert.equal(mayPassResultIn(base), true);
  assert.equal(mayPassResultIn({ ...base, live: false }), false);
  assert.equal(mayPassResultIn({ ...base, speaking: true }), false);
  // The caller talked 0.5 s ago: wait; 1 s ago: quiet enough.
  assert.equal(mayPassResultIn({ ...base, callerVoiceAt: 9_500 }), false);
  assert.equal(mayPassResultIn({ ...base, callerVoiceAt: 9_000 }), true);
  // Passed in but not started: wait, up to 8 s, then go on.
  const sent = { turnUuid: 't1', sentAt: 9_000, startedAt: null, quietSince: null, answerChars: null, interrupted: false };
  assert.equal(mayPassResultIn({ ...base, inFlight: sent }), false);
  assert.equal(mayPassResultIn({ ...base, now: 17_000, inFlight: sent }), true);
});

// Stay's call, 22 November 2026: answer 1 (about 6,150 characters, several minutes spoken) started at
// t=652 s; a sentence pause at t=750 s read as 'listening' and answer 2 went in, cutting answer 1.
test('a pause in a long answer does not count as finished, even after 3 s of quiet', () => {
  const started = 652_000;
  const answer = { turnUuid: 't1', sentAt: 651_000, startedAt: started, quietSince: 749_000, answerChars: 6_150, interrupted: false };
  assert.equal(handOffFinished(answer, 753_000), false);
  assert.equal(mayPassResultIn({ now: 753_000, live: true, speaking: false, callerVoiceAt: null, inFlight: answer }), false);
});

// Techlead's re-review: with a 3-minute cap and a timer that did not need quiet, the same answer was cut
// at its first pause after 5 minutes.
test('the same long answer still holds at a pause 5 minutes in', () => {
  const started = 652_000;
  const answer = { turnUuid: 't1', sentAt: 651_000, startedAt: started, quietSince: started + 300_000, answerChars: 6_150, interrupted: false };
  assert.equal(handOffFinished(answer, started + 304_000), false);
  assert.equal(mayPassResultIn({ now: started + 304_000, live: true, speaking: false, callerVoiceAt: null, inFlight: answer }), false);
  // Read to the end: quiet for 3 s once the longest result's spoken length has passed.
  assert.equal(handOffFinished({ ...answer, quietSince: started + 430_000 }, started + 433_000), true);
});

test('a real interruption ends the answer: the next waits only for 3 s of quiet, not the long answer', () => {
  // The caller cut a 6,000-character answer at 10 s ("stop, set a reminder instead").
  const cut = { turnUuid: 't1', sentAt: 0, startedAt: 1_000, quietSince: 11_000, answerChars: 6_000, interrupted: true };
  assert.equal(handOffFinished(cut, 12_000), false);
  assert.equal(handOffFinished(cut, 14_000), true);
  assert.equal(mayPassResultIn({ now: 14_000, live: true, speaking: false, callerVoiceAt: null, inFlight: cut }), true);
  // Not interrupted, the same moment is a pause: still in flight.
  assert.equal(handOffFinished({ ...cut, interrupted: false }, 14_000), false);
});

test('no answer is expected to take longer than the longest result Backend sends takes to say', () => {
  assert.equal(Math.round(MAX_EXPECTED_MS / 1000), 429);
  assert.equal(expectedSpokenMs(18_000), MAX_EXPECTED_MS);
  assert.equal(expectedSpokenMs(6_150), MAX_EXPECTED_MS);
  assert.equal(Math.round(expectedSpokenMs(1_400)), 100_000);
});

test('a real finish: the expected length has passed and the voice has been quiet for 3 s', () => {
  const answer = { turnUuid: 't1', sentAt: 0, startedAt: 1_000, quietSince: 45_000, answerChars: 600, interrupted: false };
  assert.equal(handOffFinished(answer, 47_000), false);
  assert.equal(handOffFinished(answer, 48_000), true);
  // Quiet for 3 s but not yet the expected length: not finished.
  assert.equal(handOffFinished({ ...answer, quietSince: 20_000 }, 30_000), false);
  // The text never arrived: 3 s of quiet is enough.
  assert.equal(handOffFinished({ ...answer, answerChars: null, quietSince: 10_000 }, 13_000), true);
  // Never quiet: no timer lets the next in, however long it runs.
  assert.equal(handOffFinished({ ...answer, quietSince: null }, 3_600_000), false);
});

// The controller's steps, played as the call plays them: the answer goes in at t=0.
const passedIn: HandOff = { turnUuid: 't1', sentAt: 0, startedAt: null, quietSince: null, answerChars: null, interrupted: false };

test('the answer is sized by the longest reply since it went in, so a short reply to the caller cannot stand in for it', () => {
  let flight = handOffOnMode(passedIn, 'speaking', 1_000);
  flight = handOffOnReply(flight, 6_000);
  flight = handOffOnMode(flight, 'listening', 60_000);
  // The caller asks something; the voice answers "Sure, one moment" (16 characters) mid-answer.
  flight = handOffOnMode(flight, 'speaking', 61_000);
  flight = handOffOnReply(flight, 16);
  flight = handOffOnMode(flight, 'listening', 62_000);
  assert.equal(flight.answerChars, 6_000);
  assert.equal(handOffFinished(flight, 66_000), false);
  // Read to the end of the 6,000 characters (about 429 s), then 3 s of quiet.
  flight = handOffOnMode(handOffOnMode(flight, 'speaking', 63_000), 'listening', 430_000);
  assert.equal(handOffFinished(flight, 433_000), true);
});

test("cutting off the voice's own earlier reply does not end the answer that has just gone in", () => {
  // The voice is still finishing a short reply when the answer goes in; the caller cuts that reply.
  let flight = handOffOnMode(passedIn, 'speaking', 500);
  flight = handOffOnInterruption(flight);
  assert.equal(flight.interrupted, false);
  flight = handOffOnMode(flight, 'listening', 2_000);
  assert.equal(handOffFinished(flight, 5_000), true, 'nothing of the answer has arrived yet, so 3 s of quiet frees the line as before');
  // The answer's own reply arrives; cutting it now does end it.
  flight = handOffOnReply(handOffOnMode(flight, 'speaking', 6_000), 6_000);
  assert.equal(handOffFinished(handOffOnMode(flight, 'listening', 20_000), 23_000), false);
  flight = handOffOnInterruption(flight);
  assert.equal(flight.interrupted, true);
  flight = handOffOnMode(flight, 'listening', 20_000);
  assert.equal(handOffFinished(flight, 23_000), true);
});

test('an interruption before the voice starts the answer changes nothing', () => {
  assert.deepEqual(handOffOnInterruption(passedIn), passedIn);
  assert.deepEqual(handOffOnMode(passedIn, 'listening', 1_000), passedIn);
});

// The voice action hold (Techlead and Backend, 22 November 2026, branch voice-held-actions; Backend's contract).
const ready = (turn_uuid: string) => ({
  session_uuid: 'TEST-session',
  turn_uuid,
  marker: turn_uuid.startsWith('action-')
    ? `[[LAWEXA RESULT for "held action ${turn_uuid.slice(7)}"]] Done: TEST DATA reminder set for 9 am.`
    : `[[LAWEXA RESULT ${turn_uuid}]] TEST DATA`,
});

test("an action outcome's marker is kept out of the transcript like any result", () => {
  assert.equal(isResearchMarker(ready('action-K3F9Q2').marker), true);
});

test("an action's outcome is told apart from a research turn by its action- turn", () => {
  assert.equal(isActionOutcome('action-K7Q2ZP'), true);
  assert.equal(isActionOutcome('00000000-0000-4000-8000-000000000001'), false);
});

// Backend's exact shape (API 1b04c6a3): the question, up to 300 characters, quotes and ] swapped, nothing after.
const nudge = (turn_uuid: string) => ({ session_uuid: 'TEST-session', turn_uuid, marker: '[[LAWEXA STILL WORKING for "TEST DATA what does section 24 (2) of the NDPA say"]]' });
type Ready = ReturnType<typeof ready>;
/** Plays events into a line; returns the line, which were taken in, and the waiting order. */
function playLine(events: Ready[], start: ResultLine<Ready> = emptyResultLine()) {
  let line = start;
  const accepted: boolean[] = [];
  for (const event of events) {
    const admitted = admitResult(line, event);
    line = admitted.line;
    accepted.push(admitted.accepted);
  }
  return { line, accepted, order: line.waiting.map((event) => `${isStillWorking(event.marker) ? 'nudge' : 'result'} ${event.turn_uuid}`) };
}

test('the server is told when a research result went in, never for an action outcome or a nudge', () => {
  assert.equal(sentNoticeTurn(ready('00000000-0000-4000-8000-000000000001')), '00000000-0000-4000-8000-000000000001');
  assert.equal(sentNoticeTurn(ready('action-K7Q2ZP')), null);
  assert.equal(sentNoticeTurn(nudge('00000000-0000-4000-8000-000000000001')), null);
});

test('research results and action outcomes wait in one line, oldest first, and a repeated event is not read twice', () => {
  const first = playLine(['t-research-1', 'action-K7Q2ZP', 't-research-1', 't-research-2'].map(ready));
  assert.deepEqual(first.order, ['result t-research-1', 'result action-K7Q2ZP', 'result t-research-2']);
  assert.deepEqual(first.accepted, [true, true, false, true]);
  // Once passed in, the event stays seen: the same event arriving later is dropped.
  const later = playLine([ready('t-research-1')], { ...first.line, waiting: first.line.waiting.slice(1) });
  assert.deepEqual(later.accepted, [false]);
  assert.deepEqual(later.order, ['result action-K7Q2ZP', 'result t-research-2']);
});

test('a nudge waits its turn like any result, and is kept out of the transcript', () => {
  assert.equal(isResearchMarker(nudge('t-research-3').marker), true);
  assert.deepEqual(playLine([ready('t-research-1'), nudge('t-research-3')]).order, ['result t-research-1', 'nudge t-research-3']);
});

test("a nudge whose turn's result is waiting, in flight or read is never said", () => {
  // Waiting: the result came first.
  assert.deepEqual(playLine([ready('t-research-3'), nudge('t-research-3')]).accepted, [true, false]);
  // In flight or read: the result has left the line, and its turn stays answered.
  const answered = playLine([ready('t-research-3')]).line;
  const afterPass = playLine([nudge('t-research-3')], { ...answered, waiting: [] });
  assert.deepEqual(afterPass.accepted, [false]);
  assert.deepEqual(afterPass.order, []);
});

test('a result takes out the nudge for its turn still waiting, so "still working" never comes just before the answer', () => {
  const line = playLine([ready('t-research-1'), nudge('t-research-3'), nudge('t-research-4'), ready('t-research-3')]);
  assert.deepEqual(line.order, ['result t-research-1', 'nudge t-research-4', 'result t-research-3']);
});

test('an action outcome goes in by the same one-at-a-time rule: not while the read-back before it is still in flight', () => {
  // The read-back went in at t=0 and the voice started it; it is mid-sentence-pause at 5 s.
  const readBack: HandOff = { turnUuid: 't-research-1', sentAt: 0, startedAt: 500, quietSince: 5_000, answerChars: 300, interrupted: false };
  assert.equal(mayPassResultIn({ now: 8_000, live: true, speaking: false, callerVoiceAt: null, inFlight: readBack }), false);
  // Read to the end (300 characters, about 21 s) and quiet for 3 s: the outcome may go in.
  const done = { ...readBack, quietSince: 22_000 };
  assert.equal(mayPassResultIn({ now: 25_000, live: true, speaking: false, callerVoiceAt: null, inFlight: done }), true);
});
