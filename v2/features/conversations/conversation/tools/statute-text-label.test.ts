import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { searchStatuteTextLabel, statuteFromSlug } from './statute-text-label';

/* search_statute_text steps name the statute and the words searched for. TEST DATA. */

test('a running search names the statute from its slug and the query', () => {
  assert.deepEqual(
    searchStatuteTextLabel({ statute: 'nigerian-ports-authority-act-1999', query: 'TEST DATA harbour dues' }, false, null),
    { action: 'Searching statute text', detail: 'in Nigerian Ports Authority Act 1999 for "TEST DATA harbour dues"' },
  );
});

test('a finished search names the statute by its title when one is known', () => {
  assert.deepEqual(
    searchStatuteTextLabel({ statute: 'nigerian-ports-authority-act-1999', query: 'TEST DATA pilotage' }, true, 'Nigerian Ports Authority Act, 1999'),
    { action: 'Searched statute text', detail: 'in Nigerian Ports Authority Act, 1999 for "TEST DATA pilotage"' },
  );
});

test('a missing statute or query leaves only what is known', () => {
  assert.deepEqual(searchStatuteTextLabel({ query: 'TEST DATA pilotage' }, true, null), { action: 'Searched statute text', detail: 'for "TEST DATA pilotage"' });
  assert.deepEqual(searchStatuteTextLabel({ statute: 'electoral-act-2022' }, true, null), { action: 'Searched statute text', detail: 'in Electoral Act 2022' });
  assert.deepEqual(searchStatuteTextLabel({ query: '  ' }, false, null), { action: 'Searching statute text', detail: undefined });
});

test('a slug reads as words; anything else is no statute', () => {
  assert.equal(statuteFromSlug('evidence_act-2011'), 'Evidence Act 2011');
  assert.equal(statuteFromSlug(''), null);
  assert.equal(statuteFromSlug(42), null);
});

test('the step line uses this label for search_statute_text', () => {
  const item = readFileSync(join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'tools', 'ToolStepItem.tsx'), 'utf8');
  assert.match(item, /const SEARCH_STATUTE_TEXT = 'search_statute_text';/);
  assert.match(item, /case SEARCH_STATUTE_TEXT:\s+return searchStatuteTextLabel\(/);
});
