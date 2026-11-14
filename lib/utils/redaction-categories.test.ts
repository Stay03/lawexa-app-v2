import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REDACTION_CATEGORIES,
  hiddenList,
  hiddenSummary,
  orderedCategories,
  readRedactionCategories,
  sameCategories,
  toggleCategory,
} from './redaction-categories';

/* What a redacted chat hides (Stay, 13 November 2026, thread cce2eafe: "only
 * the 5"; Backend's 62fd6f65). TEST DATA only. */

test('the five kinds are in the server order', () => {
  assert.deepEqual(REDACTION_CATEGORIES, ['names', 'addresses', 'contacts', 'identity', 'financial']);
});

test("a chat's record names its choice; null or nothing named reads as null (an older chat hides everything)", () => {
  assert.deepEqual(readRedactionCategories(['financial', 'names', 'unknown']), ['names', 'financial']);
  assert.equal(readRedactionCategories(null), null);
  assert.equal(readRedactionCategories(undefined), null);
  assert.equal(readRedactionCategories([]), null);
  assert.equal(readRedactionCategories(['unknown']), null);
});

test('the summary names what it hides by short names, and every kind or an older chat is all 5 kinds', () => {
  assert.equal(hiddenSummary(['names']), 'names');
  assert.equal(hiddenSummary(['addresses', 'names']), 'names, addresses');
  assert.equal(hiddenSummary(['names', 'contacts', 'financial']), 'names, contacts, accounts');
  assert.equal(hiddenSummary(['names', 'addresses', 'contacts', 'identity']), 'names, addresses, contacts, IDs');
  assert.equal(hiddenSummary([...REDACTION_CATEGORIES]), 'all 5 kinds');
  assert.equal(hiddenSummary(null), 'all 5 kinds');
  // For a screen reader and the locked menu row: every kind by name, all five for an older chat.
  assert.equal(hiddenList(['names', 'contacts']), 'names, contacts');
  assert.equal(hiddenList(null), 'names, addresses, contacts, IDs, accounts');
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
