import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TEXT_DRAFT, readDraft, useDraft, writeDraft } from './draft-store';
import { PASTED_DRAFT } from './usePastedContent';

/** A browser stand-in: a working localStorage, or one that throws on write. */
function fakeWindow({ blocked = false } = {}) {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (blocked) throw new Error('QuotaExceededError');
      data.set(key, value);
    },
    removeItem: (key: string) => {
      if (blocked) throw new Error('QuotaExceededError');
      data.delete(key);
    },
  };
  Object.assign(globalThis, {
    window: { localStorage, addEventListener() {}, removeEventListener() {} },
  });
  return data;
}

function Draft({ storageKey }: { storageKey: string }) {
  const [text] = useDraft(storageKey, TEXT_DRAFT);
  const [items] = useDraft(`${storageKey}_pasted`, PASTED_DRAFT);
  return createElement('div', null, `text=[${text}] cards=${items.length}`);
}

test('the server render shows no draft even when storage holds one', () => {
  // The hydration pass reads the same server snapshot, so the client's first
  // render matches this HTML and React keeps it (Fable SSR review F2).
  const data = fakeWindow();
  data.set('d1', 'half-typed question');
  data.set('d1_pasted', JSON.stringify(['a long paste']));
  assert.equal(
    renderToString(createElement(Draft, { storageKey: 'd1' })),
    '<div>text=[] cards=0</div>',
  );
});

test('the client snapshot reads the stored draft and keeps one object while it is unchanged', () => {
  const data = fakeWindow();
  data.set('d2', JSON.stringify(['first', 'second']));
  const first = readDraft('d2', PASTED_DRAFT);
  assert.deepEqual(first.map((item) => item.text), ['first', 'second']);
  assert.equal(readDraft('d2', PASTED_DRAFT), first);
});

test('a write is read back with its ids, and a change from another tab is seen', () => {
  const data = fakeWindow();
  const items = [{ id: 'paste-x', text: 'kept' }];
  writeDraft('d3', PASTED_DRAFT, items);
  assert.equal(data.get('d3'), '["kept"]');
  assert.equal(readDraft('d3', PASTED_DRAFT), items);

  data.set('d3', '["from another tab"]');
  assert.deepEqual(readDraft('d3', PASTED_DRAFT).map((item) => item.text), ['from another tab']);
});

test('an empty draft removes the key', () => {
  const data = fakeWindow();
  writeDraft('d4', TEXT_DRAFT, 'something');
  assert.equal(data.get('d4'), 'something');
  writeDraft('d4', TEXT_DRAFT, '');
  assert.equal(data.has('d4'), false);
  assert.equal(readDraft('d4', TEXT_DRAFT), '');
});

test('blocked storage keeps the draft in memory for the page', () => {
  fakeWindow({ blocked: true });
  writeDraft('d5', TEXT_DRAFT, 'not lost');
  assert.equal(readDraft('d5', TEXT_DRAFT), 'not lost');
});

test('a paste saved before multi-paste is read as one card', () => {
  fakeWindow();
  assert.deepEqual(PASTED_DRAFT.decode('plain old paste').map((item) => item.text), ['plain old paste']);
  assert.equal(PASTED_DRAFT.decode(''), PASTED_DRAFT.empty);
});
