import { test } from 'node:test';
import assert from 'node:assert/strict';

import { statuteKindLabel } from './statute-kind';

/* Arthur, 21 October 2026: a statute is labelled by its kind, not "Act" for
 * every one (backend `kind`, read from the title). */

test('the label is the kind the server read from the title', () => {
  assert.equal(statuteKindLabel({ kind: 'Rules', document_type: 'act' }), 'Rules');
  assert.equal(statuteKindLabel({ kind: 'Practice Direction', document_type: 'act' }), 'Practice Direction');
});

test('a server without kind keeps the old label', () => {
  assert.equal(statuteKindLabel({ document_type: 'act' }), 'Act');
  assert.equal(statuteKindLabel({ kind: '  ', document_type: 'statutory_instrument' }), 'Statutory instrument');
  assert.equal(statuteKindLabel({ kind: null, document_type: null }), null);
});
