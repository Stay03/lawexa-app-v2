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
      font: null,
      size: null,
    },
  });
  assert.deepEqual(parts[2], { kind: 'text', text: '\nTell me what to change.' });
});

test('while it streams, an open draft runs to the end and a half-written tag is held back', () => {
  const growing = 'TEST DATA. Drafting now.\n<draft title="Notice to Quit">\nTake notice that you are to quit';
  const [, draft] = splitDrafts(growing, true);
  assert.deepEqual(draft, {
    kind: 'draft',
    draft: { title: 'Notice to Quit', body: 'Take notice that you are to quit', complete: false, font: null, size: null },
  });
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
  assert.equal(draftStatus({ title: 'A', body, complete: true, font: null, size: null }, false), 'Draft · 3 words');
  assert.equal(draftStatus({ title: 'A', body, complete: false, font: null, size: null }, true), 'Writing · 3 words');
  assert.equal(draftStatus({ title: 'A', body, complete: false, font: null, size: null }, false), 'Unfinished · 3 words');
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
  // A create names its chat and draft; the server's existing note for that draft takes this save.
  assert.match(hook, /source_conversation_uuid: conversationId,\s*source_draft: ordinal,/);
  assert.match(hook, /if \(!created\.data\.existing\) return created;\s*\/\/[^\n]*\n\s*return notesApi\.update\(created\.data\.id, \{/);
  // Opening a draft asks the server for its note and records it before the editor mounts.
  const lookup = readFileSync(new URL('./use-draft-note.ts', import.meta.url), 'utf8');
  assert.match(lookup, /const note = await notesApi\.byDraft\(conversationId, ordinal\);\s*if \(note\) \{\s*writeSavedDraftNote\(/);
  const api = readFileSync(new URL('../../../notes/api.ts', import.meta.url), 'utf8');
  assert.match(api, /apiClient\.get<NoteEnvelope>\('\/notes\/by-draft', \{\s*params: \{ conversation: conversationUuid, draft \},/);
  assert.match(api, /if \(isNotFoundError\(error\)\) return null;/);
  assert.match(hook, /invalidates: \[notesQueries\.lists\(\)\]/);
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /<ExportMenu slug=\{saved\.slug\} \/>/);
  assert.match(bar, /target=\{\{ type: 'note', contentId: saved\.id \}\}/);
  assert.match(bar, /space=\{space \?\? undefined\}/);
});

test('a draft opens itself when Lawexa finishes it, unless the reader is writing in the message box', async () => {
  const { readFileSync } = await import('node:fs');
  const card = readFileSync(new URL('./DraftCard.tsx', import.meta.url), 'utf8');
  // Only a draft the card saw being written opens by itself; a saved one waits for a tap.
  assert.match(card, /const seenWriting = useRef\(!draft\.complete && live\);/);
  assert.match(card, /if \(!seenWriting\.current \|\| !panel\) return;\s*seenWriting\.current = false;\s*if \(!readerIsTyping\(\)\) panel\.open\(\{ kind: 'draft', ordinal \}\);/);
  // Writing means the box is focused or holds words.
  assert.match(card, /document\.querySelector<HTMLTextAreaElement>\('\[data-v2-chat-dock\] textarea'\)/);
  assert.match(card, /return document\.activeElement === box \|\| box\.value\.trim\(\) !== '';/);
});

test('the draft tag may carry the whole draft\'s font and size; other values are dropped', () => {
  const [draft] = draftsIn('<draft title="TEST DATA Lease" font="Georgia" size="12">\nBody\n</draft>');
  assert.equal(draft.title, 'TEST DATA Lease');
  assert.equal(draft.font, 'Georgia');
  assert.equal(draft.size, 12);
  assert.equal(draft.body, 'Body');
  // Either one alone, in any order after the title.
  const [sized] = draftsIn('<draft title="T" size="14">\nB\n</draft>');
  assert.equal(sized.font, null);
  assert.equal(sized.size, 14);
  const [swapped] = draftsIn('<draft title="T" size="10" font="Arial">\nB\n</draft>');
  assert.deepEqual([swapped.font, swapped.size], ['Arial', 10]);
  // Not on the list: the house font and size.
  const [odd] = draftsIn('<draft title="T" font="Papyrus" size="13">\nB\n</draft>');
  assert.deepEqual([odd.font, odd.size], [null, null]);
  // The plain tag still reads as before.
  assert.deepEqual([draftsIn('<draft title="T">\nB\n</draft>')[0].font, draftsIn('<draft title="T">\nB\n</draft>')[0].size], [null, null]);
});

/* Take B on a computer (Stay, 24 October 2026): a slim title line with Save at
 * its end, a floating bar over the document, no foot. The phone sheet keeps
 * its wrapped bar and its foot. */

test('on a computer the draft panel has no foot: Save sits at the end of the slim title line', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('./DraftPanel.tsx', import.meta.url), 'utf8');
  const frame = readFileSync(new URL('../side-panel/ChatSidePanel.tsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  // The frame's slim line is the draft's, with no rule under it; the draft passes no footer.
  assert.equal(panel.match(/\bslim\b\s*(>|\n)/g)?.length, 2);
  assert.doesNotMatch(panel, /footer=/);
  assert.match(frame, /slim && 'xl:h-11 xl:gap-2 xl:border-b-0 xl:py-0 xl:pr-2\.5'/);
  assert.match(frame, /<div ref=\{setActionSlot\} className="contents" \/>/);
  assert.match(frame, /return slot \? createPortal\(children, slot\) : null;/);
  // The sheet's foot is not drawn on a computer; the title line's control is drawn only there.
  assert.match(bar, /<div className="sticky bottom-0 z-10 [^"]* xl:hidden">/);
  assert.match(bar, /<div className="relative hidden shrink-0 items-center gap-0\.5 xl:flex">/);
  assert.match(editor, /<SidePanelActions>\s*<DraftSaveControl draft=\{draft\} dirty=\{dirty\} space=\{space\} \/>\s*<\/SidePanelActions>/);
  // One save and one folder picker serve both places.
  assert.equal(editor.match(/useDraftSave\(/g)?.length, 1);
  assert.equal(editor.match(/<DraftFolderPicker /g)?.length, 1);
});

test('the gold Save as note is the only primary action on the computer panel', async () => {
  const { readFileSync } = await import('node:fs');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  const control = bar.slice(bar.indexOf('export function DraftSaveControl'), bar.indexOf('function SavedNoteMenu'));
  assert.equal(control.match(/\bbg-primary\b(?!\/)/g)?.length, 1);
  assert.match(control, /return draft\.saved \? 'Save changes' : 'Save as note';|\{saveLabel\(draft\)\}/);
  assert.match(bar, /return draft\.saved \? 'Save changes' : 'Save as note';/);
  assert.doesNotMatch(editor, /\bbg-primary\b(?!\/)/);
  // A failed save still says why, beside the button.
  assert.match(control, /role="alert"[\s\S]*?\{saveFailureSentence\(mutation\.error\)\}/);
});

test('once saved, a quiet Saved chip and a ··· menu with the note, both exports and Save to folder', async () => {
  const { readFileSync } = await import('node:fs');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  const control = bar.slice(bar.indexOf('export function DraftSaveControl'), bar.indexOf('function SavedNoteMenu'));
  assert.match(control, /\{saved && !dirty \? \(\s*<span className="[^"]*bg-primary\/12[^"]*">\s*<Check aria-hidden className="size-\[15px\]" \/>\s*Saved\s*<\/span>/);
  assert.match(control, /\{saved \? \(\s*<SavedNoteMenu/);
  const menu = bar.slice(bar.indexOf('function SavedNoteMenu'), bar.indexOf('export function DraftFolderPicker'));
  const order = ['Saved to your notes', 'Open note', 'Export Word', '.docx', 'Export PDF', '.pdf', '{folder}'];
  let at = -1;
  for (const word of order) {
    const next = menu.indexOf(word, at + 1);
    assert.ok(next > at, word);
    at = next;
  }
  assert.match(menu, /onSelect=\{\(\) => void download\('docx'\)\}/);
  assert.match(menu, /onSelect=\{\(\) => void download\('pdf'\)\}/);
  assert.match(menu, /<Link href=\{`\/notes\/\$\{slug\}`\}>/);
});

test('the computer bar floats over the document; its ··· holds the lists, alignment and Copy', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  const pill = editor.slice(editor.indexOf('function DraftPillToolbar'), editor.indexOf('function PillMoreMenu'));
  const more = editor.slice(editor.indexOf('function PillMoreMenu'));
  // Sticky over the top of the document, drawn on a computer only; the sheet's bar is not.
  assert.match(pill, /className="@container\/draft sticky top-0 z-10 hidden h-0 xl:block"/);
  assert.match(pill, /className="v2-draft-pill pointer-events-auto flex /);
  assert.match(editor, /className="sticky top-0 z-10 flex shrink-0 flex-wrap [^"]* xl:hidden"/);
  // undo, redo · style, font and size · B I U, then ···.
  assert.match(pill, /<StyleSelect editor=\{editor\} state=\{state\} mac=\{mac\} pill /);
  assert.match(pill, /<FontSizeMenu editor=\{editor\} /);
  assert.match(pill, /<PillMoreMenu /);
  assert.doesNotMatch(pill, /LIST_VERBS\.map|<AlignMenu|icon=\{copied/);
  assert.match(more, /LIST_VERBS\.map/);
  assert.match(more, /ALIGN_OPTIONS\.map/);
  assert.match(more, /'Copy text'/);
  // At a narrow panel Redo and Underline fold into ···, by the same width in CSS and in the menu.
  assert.match(editor, /const PILL_FOLD_WIDTH = 520;/);
  assert.equal(pill.match(/@max-\[32\.5rem\]\/draft:hidden/g)?.length, 2);
  assert.match(more, /\{folded \? \(/);
});
