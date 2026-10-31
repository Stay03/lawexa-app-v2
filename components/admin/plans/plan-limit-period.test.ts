import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { formPeriod, LIMIT_PERIOD_OPTIONS } from './plan-limit-period';
import { FILE_LIMIT_PERIOD } from './plan-file-limits';

/* A plan limit save never sends a period the server refuses
 * (UpdatePlanLimitsRequest: in:lifetime,billing_interval). */

const SERVER_PERIODS = new Set(['lifetime', 'billing_interval']);
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the dropdown offers only the two periods the server takes', () => {
  assert.deepEqual(LIMIT_PERIOD_OPTIONS.map((option) => [option.value, option.label]), [
    ['billing_interval', 'Each billing period'],
    ['lifetime', 'In total (never resets)'],
  ]);
  assert.ok(SERVER_PERIODS.has(FILE_LIMIT_PERIOD));
});

test('any stored period, old or missing, starts the form on one the server takes', () => {
  for (const stored of ['lifetime', 'billing_interval', 'month', 'day', '', null, undefined]) {
    assert.ok(SERVER_PERIODS.has(formPeriod(stored)), String(stored));
  }
  assert.equal(formPeriod('lifetime'), 'lifetime');
  assert.equal(formPeriod('month'), 'billing_interval');
  assert.equal(formPeriod(undefined), 'billing_interval');
});

test('the form, its schema and the payload type hold only those two', () => {
  const form = read('components', 'admin', 'plans', 'AdminPlanLimitsForm.tsx');
  assert.match(form, /period: z\.enum\(\['lifetime', 'billing_interval'\]\),/);
  assert.match(form, /period: formPeriod\(found\?\.period\),/);
  assert.match(form, /LIMIT_PERIOD_OPTIONS\.map\(\(opt\)/);
  assert.doesNotMatch(form, /'month'|'day'|Per Month|Per Day/);
  assert.match(read('types', 'admin-plans.ts'), /export type AdminLimitPeriod = 'lifetime' \| 'billing_interval';/);
});
