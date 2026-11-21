import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { VoiceServerTurn } from '@/types/voice-test';
import {
  applyCallEvent,
  delayCsv,
  delayRows,
  EMPTY_CALL_LOG,
  isResearchMarker,
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
