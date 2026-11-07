import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Cancel is easy to find (Richard 433760d9, approved by the techlead): in
 * Billing it sits in the Plan block under the plan row, above the invoices;
 * Usage's plan row links to it; the plan cards and the trial dialog carry the
 * renewal notice. TEST DATA only. */

const here = join(process.cwd(), 'v2', 'features');
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');

test('Billing: Cancel plan sits in the Plan block, above Invoices, and only once', () => {
  const screen = read('settings', 'billing', 'BillingScreen.tsx');
  const plan = screen.indexOf('id="billing-plan"');
  const cancel = screen.indexOf("'Cancel free trial' : 'Cancel plan'");
  const invoices = screen.indexOf('id="billing-invoices"');
  assert.ok(plan > -1 && cancel > plan && invoices > cancel, 'plan row, then cancel, then invoices');
  assert.equal(screen.split("'Cancel free trial' : 'Cancel plan'").length - 1, 1);
});

test('Usage: the plan row links "Cancel any time" to Billing when the plan renews', () => {
  const screen = read('settings', 'usage', 'UsageScreen.tsx');
  assert.match(screen, /offersCancel\(plan\) \? \(\s*<Link\s+href="\/settings\/billing"[\s\S]*?Cancel any time/);
});

test('the plan card and the trial dialog show the renewal notice', () => {
  assert.match(read('pricing', 'PlanCard.tsx'), /const notice = renewalNotice\(plan, trialOffer\);/);
  assert.match(read('pricing', 'TrialDialog.tsx'), /renewalNotice\(plan, true\)/);
});
