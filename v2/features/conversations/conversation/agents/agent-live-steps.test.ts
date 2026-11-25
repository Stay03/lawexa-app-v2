import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stepsOnCalling, stepsOnComplete } from './agent-live-steps';

/* An agent's lookups as lines on its row while it works. TEST DATA. */

const call = (name: string, id?: string) => ({ tool_call: { name, parameters: { query: `TEST DATA ${id ?? name}` } }, tool_call_id: id });

test('each call is a line, open until it ends; a call listed twice stays one line', () => {
  let steps = stepsOnCalling([], call('search_cases', 'c1'));
  steps = stepsOnCalling(steps, call('search_statutes', 'c2'));
  steps = stepsOnCalling(steps, call('search_cases', 'c1'));
  assert.deepEqual(steps.map((s) => [s.key, s.name, s.done]), [['c1', 'search_cases', false], ['c2', 'search_statutes', false]]);
  steps = stepsOnComplete(steps, call('search_statutes', 'c2'));
  assert.deepEqual(steps.map((s) => s.done), [false, true]);
  assert.deepEqual(steps[0].parameters, { query: 'TEST DATA c1' });
});

test('with no ids, the oldest open line of the same tool ends', () => {
  let steps = stepsOnCalling([], call('search_cases'));
  steps = stepsOnCalling(steps, call('search_cases'));
  assert.deepEqual(steps.map((s) => s.key), ['call-0', 'call-1']);
  steps = stepsOnComplete(steps, call('search_cases'));
  assert.deepEqual(steps.map((s) => s.done), [true, false]);
  steps = stepsOnComplete(steps, call('get_case'));
  assert.deepEqual(steps.map((s) => s.done), [true, false], 'an end for a tool with no open line changes nothing');
});

test('a lookup that ends keeps how many things came back; with no count it stays unknown', () => {
  let steps = stepsOnCalling([], call('search_cases', 'c1'));
  steps = stepsOnCalling(steps, call('get_case', 'c2'));
  assert.deepEqual(steps.map((s) => s.resultCount), [null, null]);
  steps = stepsOnComplete(steps, { ...call('search_cases', 'c1'), result_count: 3 });
  steps = stepsOnComplete(steps, { ...call('get_case', 'c2'), result_count: null });
  assert.deepEqual(steps.map((s) => s.resultCount), [3, null]);
});
