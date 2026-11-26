import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AgentLiveStep } from './agent-live-steps';
import { cardStatus, deckLine, deckStartedAt, elapsedWords, foldLine, settled, stepSubject, workingWords, type StepWords } from './agent-deck';

/* The agent deck's words (round 9, version 1). TEST DATA. */

const wordsOf: StepWords = (step) =>
  step.name === 'search_cases'
    ? { action: step.done ? 'Searched cases' : 'Searching cases', detail: `for "${String(step.parameters.query)}"` }
    : { action: step.done ? 'Read a statute' : 'Reading a statute' };
const step = (over: Partial<AgentLiveStep>): AgentLiveStep => ({ key: 'k', name: 'search_cases', parameters: { query: 'TEST DATA data breach' }, done: false, resultCount: null, ...over });

test('a working card names the lookup it runs and what for, not the agent’s text', () => {
  assert.equal(workingWords({ steps: [step({})], writing: false }, wordsOf), 'Searching cases · TEST DATA data breach');
  assert.equal(workingWords({ steps: [step({ name: 'get_statute' })], writing: false }, wordsOf), 'Reading a statute');
});

test('after a lookup, the card says how many things came back; while the reply streams, only that it writes', () => {
  assert.equal(workingWords({ steps: [step({ done: true, resultCount: 3 })], writing: false }, wordsOf), 'Searched cases: 3 results');
  assert.equal(workingWords({ steps: [step({ done: true, resultCount: 1 })], writing: false }, wordsOf), 'Searched cases: 1 result');
  assert.equal(workingWords({ steps: [step({ done: true })], writing: false }, wordsOf), 'Searched cases');
  assert.equal(workingWords({ steps: [step({ done: true, resultCount: 3 })], writing: true }, wordsOf), 'Writing its reply');
  assert.equal(workingWords({ steps: [], writing: false }, wordsOf), 'Reading the question');
  assert.equal(workingWords(null, wordsOf), 'Reading the question');
});

test('an open lookup wins over the reply and the finished ones', () => {
  const live = { steps: [step({ key: 'a', done: true, resultCount: 2 }), step({ key: 'b', name: 'get_statute' })], writing: true };
  assert.equal(workingWords(live, wordsOf), 'Reading a statute');
});

test('a long line is cut at a word', () => {
  const words = workingWords({ steps: [step({ parameters: { query: 'TEST DATA damages for a health data breach under the Nigeria Data Protection Act' } })], writing: false }, wordsOf);
  assert.ok(words.length <= 49, words);
  assert.ok(words.endsWith('…'), words);
  assert.ok(!/\s…$/.test(words), words);
});

test('the lookup’s subject loses its grammar and quotes', () => {
  assert.equal(stepSubject('for "TEST DATA breach"'), 'TEST DATA breach');
  assert.equal(stepSubject('from Section 25'), 'Section 25');
  assert.equal(stepSubject(undefined), null);
  assert.equal(stepSubject('for ""'), null);
});

test('each state has its line and its tone', () => {
  const base = { replySummary: null, waitingFor: null };
  assert.deepEqual(cardStatus({ ...base, state: 'waiting', waitingFor: 'Law Checker' }, null, wordsOf), { words: 'With Law Checker', tone: 'waiting' });
  assert.deepEqual(cardStatus({ ...base, state: 'waiting' }, null, wordsOf), { words: 'Waiting for its helper', tone: 'waiting' });
  assert.deepEqual(cardStatus({ ...base, state: 'replied', replySummary: 'TEST DATA Two cases on damages' }, null, wordsOf), { words: 'TEST DATA Two cases on damages', tone: 'done' });
  assert.deepEqual(cardStatus({ ...base, state: 'replied' }, null, wordsOf), { words: 'Replied', tone: 'done' });
  assert.deepEqual(cardStatus({ ...base, state: 'stopped' }, null, wordsOf), { words: 'Stopped', tone: 'quiet' });
  assert.deepEqual(cardStatus({ ...base, state: 'failed' }, null, wordsOf), { words: 'Couldn’t reply', tone: 'failed' });
  assert.equal(cardStatus({ ...base, state: 'running' }, { steps: [], writing: true }, wordsOf).tone, 'working');
});

test('a running agent with no turn to follow says what is true, without a spinner', () => {
  const base = { replySummary: null, waitingFor: null, executionId: null };
  // Its helper replied and it has not been woken to read the reply yet (Backend's three-deep run).
  assert.deepEqual(cardStatus({ ...base, state: 'running', children: [{ name: 'Case Finder', state: 'replied' }] }, null, wordsOf), { words: 'Case Finder replied', tone: 'waiting' });
  // Not started, or a helper still out: no claim of work.
  assert.deepEqual(cardStatus({ ...base, state: 'running', children: [] }, null, wordsOf), { words: 'Starting', tone: 'waiting' });
  assert.deepEqual(cardStatus({ ...base, state: 'running', children: [{ name: 'Case Finder', state: 'replied' }, { name: 'Law Checker', state: 'running' }] }, null, wordsOf), { words: 'Starting', tone: 'waiting' });
  // With a turn to follow, the stream's words as before.
  assert.equal(cardStatus({ ...base, executionId: 'exec-1', state: 'running' }, { steps: [], writing: true }, wordsOf).words, 'Writing its reply');
});

test('Lawexa’s line counts who it still waits for, and the queued messages', () => {
  const row = (name: string, state: 'running' | 'waiting' | 'replied' | 'stopped' | 'failed') => ({ name, state });
  const five = ['Issue Spotter', 'Case Finder', 'Damages Estimator', 'Drafter', 'Risk Reviewer'];
  assert.equal(deckLine(five.map((n) => row(n, 'running'))), '5 agents at work');
  assert.equal(deckLine(five.map((n, i) => row(n, i < 2 ? 'replied' : i === 2 ? 'waiting' : 'running'))), 'Waiting for 3 agents');
  assert.equal(deckLine(five.map((n, i) => row(n, i === 4 ? 'running' : 'replied'))), 'Waiting for Risk Reviewer');
  assert.equal(deckLine([row('Issue Spotter', 'running')]), 'Waiting for Issue Spotter');
  assert.equal(deckLine(five.map((n) => row(n, 'running')), 1), '5 agents at work · 1 message queued');
  assert.equal(deckLine(five.map((n) => row(n, 'running')), 2), '5 agents at work · 2 messages queued');
});

test('the fold says how many replied, and every finish counts as settled', () => {
  assert.equal(foldLine([{ state: 'replied' }, { state: 'replied' }]), '2 agents replied');
  assert.equal(foldLine([{ state: 'replied' }]), '1 agent replied');
  assert.equal(foldLine([{ state: 'replied' }, { state: 'stopped' }, { state: 'failed' }]), '1 of 3 agents replied');
  assert.equal(foldLine([{ state: 'stopped' }]), '1 agent stopped');
  assert.equal(foldLine([{ state: 'stopped' }, { state: 'failed' }]), '0 of 2 agents replied');
  assert.deepEqual(['running', 'waiting', 'replied', 'stopped', 'failed'].map((state) => settled({ state: state as 'running' })), [false, false, true, true, true]);
});

test('the clock starts at the earliest call and reads in minutes and seconds', () => {
  assert.equal(deckStartedAt([{ calledAt: '2026-11-25T22:00:10Z' }, { calledAt: '2026-11-25T22:00:04Z' }, { calledAt: null }]), Date.parse('2026-11-25T22:00:04Z'));
  assert.equal(deckStartedAt([{ calledAt: null }]), null);
  assert.equal(elapsedWords(7_400), '0:07');
  assert.equal(elapsedWords(102_000), '1:42');
  assert.equal(elapsedWords(-5), '0:00');
  assert.equal(elapsedWords(3_725_000), '1:02:05');
  assert.equal(elapsedWords(163_621_000), '45:27:01');
});
