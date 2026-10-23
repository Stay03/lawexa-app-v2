import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countDrafts, draftStatus, draftWordsLabel, draftsIn, mayHoldDraft, splitDrafts } from './draft-blocks';
import { parseSidePanelValue, sidePanelValue } from '../side-panel/side-panel-value';
import { draftOffsets, locateDraft } from './draft-ordinals';

/* The draft editor (Stay, 23 October 2026: "Yes build and push"): Lawexa writes
 * a draft as <draft title="…">Markdown</draft>, and the chat shows it in a side
 * panel. TEST DATA throughout. */

const ANSWER = [
  'TEST DATA. Here is a first draft.',
  '<draft title="Tenancy Agreement for 12 Allen &quot;A&quot; &amp; Co">',
  '# Tenancy Agreement',
  '',
  'This agreement is made on the 1st day of November 2026.',
  '</draft>',
  'Tell me what to change.',
].join('\n');

test('a finished draft is split from the reply around it, with its title decoded', () => {
  const parts = splitDrafts(ANSWER);
  assert.equal(parts.length, 3);
  assert.deepEqual(parts[0], { kind: 'text', text: 'TEST DATA. Here is a first draft.\n' });
  assert.deepEqual(parts[1], {
    kind: 'draft',
    draft: {
      title: 'Tenancy Agreement for 12 Allen "A" & Co',
      body: '# Tenancy Agreement\n\nThis agreement is made on the 1st day of November 2026.',
      complete: true,
    },
  });
  assert.deepEqual(parts[2], { kind: 'text', text: '\nTell me what to change.' });
});

test('while it streams, an open draft runs to the end and a half-written tag is held back', () => {
  const growing = 'TEST DATA. Drafting now.\n<draft title="Notice to Quit">\nTake notice that you are to quit';
  const [, draft] = splitDrafts(growing, true);
  assert.deepEqual(draft, { kind: 'draft', draft: { title: 'Notice to Quit', body: 'Take notice that you are to quit', complete: false } });
  // The closing tag's first letters never show in the body.
  assert.equal(draftsIn(`${growing} the premises.\n</dra`, true)[0].body, 'Take notice that you are to quit the premises.');
  // An opening tag still being written shows nothing of itself.
  assert.deepEqual(splitDrafts('TEST DATA. Here it is.\n<draft title="Noti', true), [{ kind: 'text', text: 'TEST DATA. Here it is.\n' }]);
  assert.deepEqual(splitDrafts('TEST DATA. Here it is.\n<dr', true), [{ kind: 'text', text: 'TEST DATA. Here it is.\n' }]);
  // Finished text keeps a stray "<" (legal prose rarely has one, but it is the reader's).
  assert.deepEqual(splitDrafts('TEST DATA. 3 < 4'), [{ kind: 'text', text: 'TEST DATA. 3 < 4' }]);
});

test('several drafts in one answer are counted in order; text with none is one text part', () => {
  const two = `${ANSWER}\n<draft title="Second">\nBody two\n</draft>`;
  assert.equal(countDrafts(two), 2);
  assert.deepEqual(draftsIn(two).map((draft) => draft.title), ['Tenancy Agreement for 12 Allen "A" & Co', 'Second']);
  assert.equal(countDrafts('TEST DATA. No drafts here.'), 0);
  assert.equal(mayHoldDraft('TEST DATA. No drafts here.'), false);
  assert.deepEqual(splitDrafts('TEST DATA. Plain.'), [{ kind: 'text', text: 'TEST DATA. Plain.' }]);
  // A draft with an empty title is still a draft.
  assert.equal(draftsIn('<draft title="">\nx\n</draft>')[0].title, 'Draft');
});

test('the card counts the words written so far', () => {
  assert.equal(draftWordsLabel(''), 'Starting');
  assert.equal(draftWordsLabel('# Title\n\nOne two, three.'), '4 words');
  assert.equal(draftWordsLabel('word'), '1 word');
});

test('the side panel names a draft by its place, a file by id and a note by slug', () => {
  assert.equal(sidePanelValue({ kind: 'draft', ordinal: 3 }), 'draft:3');
  assert.deepEqual(parseSidePanelValue('draft:0'), { kind: 'draft', ordinal: 0 });
  assert.deepEqual(parseSidePanelValue('file:812'), { kind: 'file', id: 812 });
  assert.deepEqual(parseSidePanelValue(sidePanelValue({ kind: 'note', slug: 'my note/1' })), { kind: 'note', slug: 'my note/1' });
  for (const bad of [null, '', 'draft', 'draft:x', 'file:0', 'file:-1', 'note:', 'game:1', 'note:%E0%A4%A']) {
    assert.equal(parseSidePanelValue(bad), null, String(bad));
  }
});

test('a draft is found by its place in the transcript, the streaming answer last', () => {
  const one = '<draft title="A">\na\n</draft>';
  const two = `${one}\n<draft title="B">\nb\n</draft>`;
  const messages = [
    { id: 'u1', role: 'user', content: 'TEST DATA. Draft A.' },
    { id: 'a1', role: 'assistant', content: one },
    { id: 'a2', role: 'assistant', content: 'TEST DATA. No draft.' },
    { id: 'a3', role: 'assistant', content: two },
    // The answer still streaming: its text is not in `content` yet.
    { id: 'a4', role: 'assistant', content: '' },
  ];
  assert.deepEqual([...draftOffsets(messages)], [['a1', 0], ['a2', 1], ['a3', 1], ['a4', 3]]);
  assert.deepEqual(locateDraft(messages, 0), { messageId: 'a1', index: 0 });
  assert.deepEqual(locateDraft(messages, 2), { messageId: 'a3', index: 1 });
  assert.deepEqual(locateDraft(messages, 3), { streamingIndex: 0 });
});

test('the status says finished, being written, or cut short in a saved answer', () => {
  const body = 'One two three';
  assert.equal(draftStatus({ title: 'A', body, complete: true }, false), 'Draft · 3 words');
  assert.equal(draftStatus({ title: 'A', body, complete: false }, true), 'Writing · 3 words');
  assert.equal(draftStatus({ title: 'A', body, complete: false }, false), 'Unfinished · 3 words');
});

test('a failed Save as note names a newer copy and the size cap, else asks to retry', async () => {
  const { saveFailureSentence } = await import('./draft-save-failure');
  assert.equal(saveFailureSentence({ response: { status: 409 } }), 'This note was changed somewhere else. Open it to see the newer copy.');
  assert.equal(saveFailureSentence({ response: { status: 413 } }), 'This draft is too large to save as one note.');
  assert.equal(saveFailureSentence(new Error('offline')), "Couldn't save the note. Check your connection and try again.");
});

test('Save as note makes a note once, then updates it with the copy it was made from', async () => {
  const { readFileSync } = await import('node:fs');
  const hook = readFileSync(new URL('./use-save-draft-note.ts', import.meta.url), 'utf8');
  assert.match(hook, /notesApi\.update\(saved\.id, \{ title: cleanTitle, content: html, base_updated_at: saved\.updatedAt \}\)/);
  assert.match(hook, /: notesApi\.create\(\{ title: cleanTitle, content: html \}\);/);
  assert.match(hook, /invalidates: \[notesQueries\.lists\(\)\]/);
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /<ExportMenu slug=\{saved\.slug\} \/>/);
  assert.match(bar, /target=\{\{ type: 'note', contentId: saved\.id \}\}/);
  assert.match(bar, /space=\{space \?\? undefined\}/);
});
