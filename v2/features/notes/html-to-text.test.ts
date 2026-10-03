import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText } from '@/lib/utils/html-to-text';

/* v1's case-mention tooltip strips case text with this (security fix,
 * 3 October 2026). Node has no DOMParser, so this pins the fallback path; the
 * DOMParser path is checked in a real browser alongside the note fix. */
test('markup with an onerror image reduces to its text', () => {
  assert.equal(htmlToText('<p>Held: <img src=x onerror=alert(1)>damages <b>lie</b>.</p>'), 'Held: damages lie .');
});

test('empty input gives an empty string', () => {
  assert.equal(htmlToText(null), '');
  assert.equal(htmlToText(''), '');
});
