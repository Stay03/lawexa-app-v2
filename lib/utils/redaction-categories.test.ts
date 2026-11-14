import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REDACTION_CATEGORIES,
  hiddenCount,
  hiddenList,
  hiddenSummary,
  orderedCategories,
  readRedactionCategories,
  sameCategories,
  shortLabelsOf,
  toggleCategory,
} from './redaction-categories';

/* What a redacted chat hides (Stay, 14 November 2026, thread cce2eafe: six
 * choices; Backend's 20dce5a2). TEST DATA only. */

const LABELS = {
  names: 'names',
  addresses: 'addresses',
  phones: 'phone numbers',
  emails: 'emails',
  identity: 'IDs',
  financial: 'accounts',
} as const;

test('the six kinds are in the server order', () => {
  assert.deepEqual(REDACTION_CATEGORIES, ['names', 'addresses', 'phones', 'emails', 'identity', 'financial']);
});

test('the short names come from the server options, by key; unknown keys drop', () => {
  const options = [
    { key: 'phones', label: 'Phone numbers', short_label: 'phone numbers', description: 'TEST DATA' },
    { key: 'other', label: 'Other', short_label: 'other', description: 'TEST DATA' },
  ] as unknown as Parameters<typeof shortLabelsOf>[0];
  assert.deepEqual(shortLabelsOf(options), { phones: 'phone numbers' });
});

test("a chat's record names its choice; null or nothing named reads as null (an older chat hides everything)", () => {
  assert.deepEqual(readRedactionCategories(['financial', 'names', 'unknown']), ['names', 'financial']);
  assert.equal(readRedactionCategories(null), null);
  assert.equal(readRedactionCategories(undefined), null);
  assert.equal(readRedactionCategories([]), null);
  assert.equal(readRedactionCategories(['contacts']), null);
});

test('the summary names what it hides by short names, and every kind or an older chat is all 6 kinds', () => {
  assert.equal(hiddenSummary(['names'], LABELS), 'names');
  assert.equal(hiddenSummary(['addresses', 'names'], LABELS), 'names, addresses');
  assert.equal(hiddenSummary(['names', 'addresses', 'phones'], LABELS), 'names, addresses, phone numbers');
  assert.equal(hiddenSummary(['emails', 'phones', 'financial'], LABELS), 'phone numbers, emails, accounts');
  assert.equal(hiddenSummary([...REDACTION_CATEGORIES], LABELS), 'all 6 kinds');
  assert.equal(hiddenSummary(null, LABELS), 'all 6 kinds');
  // For a screen reader and the locked menu row: every kind by name, all six for an older chat.
  assert.equal(hiddenList(['names', 'emails'], LABELS), 'names, emails');
  assert.equal(hiddenList(null, LABELS), 'names, addresses, phone numbers, emails, IDs, accounts');
  // Before the short names arrive nothing half-named shows; "all 6 kinds" needs no names.
  assert.equal(hiddenSummary(['names', 'phones'], {}), null);
  assert.equal(hiddenList(['names'], { addresses: 'addresses' }), null);
  assert.equal(hiddenSummary(null, {}), 'all 6 kinds');
});

test('a line too narrow for the names says how many: 4 of 6 kinds, or all 6 kinds', () => {
  assert.equal(hiddenCount(['names', 'addresses', 'phones', 'emails']), '4 of 6 kinds');
  assert.equal(hiddenCount(['names']), '1 of 6 kinds');
  assert.equal(hiddenCount([...REDACTION_CATEGORIES]), 'all 6 kinds');
  assert.equal(hiddenCount(null), 'all 6 kinds');
});

test('one kind toggles on and off in the server order, and the last one stays on', () => {
  assert.deepEqual(toggleCategory(['names', 'addresses'], 'names'), ['addresses']);
  assert.deepEqual(toggleCategory(['addresses'], 'names'), ['names', 'addresses']);
  assert.deepEqual(toggleCategory(['identity'], 'identity'), ['identity']);
});

test('two choices are the same whatever their order; repeats and unknown keys drop', () => {
  assert.equal(sameCategories(['addresses', 'names'], ['names', 'addresses']), true);
  assert.equal(sameCategories(['names'], ['names', 'addresses']), false);
  assert.deepEqual(orderedCategories(['financial', 'names', 'names', 'other']), ['names', 'financial']);
});
