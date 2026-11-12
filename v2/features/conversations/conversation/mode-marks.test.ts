import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

/* A browser tab whose sessionStorage already marks one chat confidential and
 * another redacted, as v1's stores persist them. Installed before the module
 * reads it (it seeds lazily, on first use). */
const storage = new Map<string, string>([
  ['lawexa-confidential-mode', JSON.stringify({ state: { confidentialIds: ['conf-1'] }, version: 0 })],
  ['lawexa-redacted-mode', JSON.stringify({ state: { redactedIds: ['red-1'] }, version: 0 })],
]);
(globalThis as { window?: unknown }).window = {
  sessionStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  },
};

const marks = await import('./mode-marks');

function Probe({ id }: { id: string }) {
  const { isConfidential, isRedacted } = marks.useModeMarks(id);
  return createElement('p', null, `${isConfidential ? 'confidential' : 'open'}/${isRedacted ? 'redacted' : 'plain'}`);
}

test('the flags travel as one number, and back', () => {
  assert.deepEqual(marks.modeMarksFromBits(0), { isConfidential: false, isRedacted: false });
  assert.deepEqual(marks.modeMarksFromBits(1), { isConfidential: true, isRedacted: false });
  assert.deepEqual(marks.modeMarksFromBits(2), { isConfidential: false, isRedacted: true });
  assert.deepEqual(marks.modeMarksFromBits(3), { isConfidential: true, isRedacted: true });
  assert.equal(marks.SERVER_MODE_MARK_BITS, 0);
});

test('the hydration render draws what the server drew: no marks, even when this tab has them', () => {
  // React renders with the server snapshot both on the server and while
  // hydrating; before the fix the hook read sessionStorage beside it and drew
  // the banner the server had not ("Hydration failed").
  assert.equal(renderToString(createElement(Probe, { id: 'conf-1' })), '<p>open/plain</p>');
  assert.equal(renderToString(createElement(Probe, { id: 'red-1' })), '<p>open/plain</p>');
});

test('after mount the snapshot carries the real marks from sessionStorage', () => {
  assert.equal(marks.modeMarkBits('conf-1'), 1);
  assert.equal(marks.modeMarkBits('red-1'), 2);
  assert.equal(marks.modeMarkBits('other'), 0);
  assert.equal(marks.modeMarkBits(null), 0);
});

test('a mark added in-session changes the snapshot, so readers re-render; an unmark clears it', () => {
  assert.equal(marks.modeMarkBits('both-1'), 0);
  marks.markConfidential('both-1');
  marks.markRedacted('both-1');
  assert.equal(marks.modeMarkBits('both-1'), 3);
  marks.unmarkConfidential('both-1');
  assert.equal(marks.modeMarkBits('both-1'), 2);
  marks.unmarkRedacted('both-1');
  assert.equal(marks.modeMarkBits('both-1'), 0);
  // The confidential chat's mark survives, so it never reads as open after mount.
  assert.equal(marks.modeMarkBits('conf-1'), 1);
});
