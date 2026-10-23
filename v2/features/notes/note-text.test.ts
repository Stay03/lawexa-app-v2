import { test } from 'node:test';
import assert from 'node:assert/strict';

import { notePreviewText } from './note-text';

/* A note row's summary (techlead, 23 October 2026): a note that opens with a
 * heading no longer runs the heading into its first sentence. */

test('a leading heading is left out of the summary', () => {
  assert.equal(
    notePreviewText(
      'Tenancy Agreement\nTEST DATA. This agreement is made on 1 November 2026.',
      '<h2>Tenancy Agreement</h2><p>TEST DATA. This agreement is made on 1 November 2026.</p>',
    ),
    'TEST DATA. This agreement is made on 1 November 2026.',
  );
  // Two headings in a row are both left out.
  assert.equal(
    notePreviewText('Notice to quit Part 1 The tenancy ends.', '<h1>Notice to quit</h1><h3>Part 1</h3><p>The tenancy ends.</p>'),
    'The tenancy ends.',
  );
});

test('a note without a leading heading, or with only headings, keeps its text', () => {
  assert.equal(notePreviewText('TEST DATA. A tenancy ends.', '<p>TEST DATA. A tenancy ends.</p>'), 'TEST DATA. A tenancy ends.');
  // A heading later in the note stays.
  assert.equal(notePreviewText('Intro. Terms here.', '<p>Intro.</p><h2>Terms</h2>'), 'Intro. Terms here.');
  // A note that is only a heading still shows it, rather than nothing.
  assert.equal(notePreviewText('Tenancy Agreement', '<h2>Tenancy Agreement</h2>'), 'Tenancy Agreement');
  // A heading the HTML preview cut short is left in.
  assert.equal(notePreviewText('A very long heading text', '<h2>A very long hea'), 'A very long heading text');
  // No plain text: the HTML fallback, minus its heading.
  assert.equal(notePreviewText(null, '<h2>Title</h2><p>Body.</p>'), 'Body.');
  assert.equal(notePreviewText('', ''), null);
});
