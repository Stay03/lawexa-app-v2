import { test } from 'node:test';
import assert from 'node:assert/strict';

import { plainPreview } from './plain-preview';
import { lastMessageLine } from '../spaces/model';

/* Tester, 20 October 2026 (finding 29): a Space's chat row printed an answer's
 * "**" and "##" marks. */

test('a preview loses its markdown marks and keeps its words', () => {
  assert.equal(plainPreview('## Notice to quit\n**Held:** the notice was valid'), 'Notice to quit Held: the notice was valid');
  assert.equal(plainPreview('- first\n1. second\n> quoted `code`'), 'first second quoted code');
  assert.equal(plainPreview('<p>Tenancy</p>  law'), 'Tenancy law');
});

test("a Space chat row shows the answer's words, not its marks", () => {
  const at = '2026-10-20T10:00:00Z';
  assert.equal(
    lastMessageLine({ role: 'assistant', preview: '## Short answer\n**Yes**, a landlord must serve notice.', created_at: at, author: null }, 'u1'),
    'Lawexa: Short answer Yes, a landlord must serve notice.',
  );
  // A preview that is only marks counts as none.
  assert.equal(lastMessageLine({ role: 'assistant', preview: '## **', created_at: at, author: null }, 'u1'), null);
});
