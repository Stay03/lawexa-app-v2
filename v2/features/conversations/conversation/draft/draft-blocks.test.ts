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
  // The phone sheet's foot, once saved, is one row: the line and the saved note's ··· menu, 40px to tap
  // (Arthur's iPhone recording, 24 October 2026: four pills wrapped onto two rows).
  assert.match(bar, /<SavedNoteMenu\s+slug=\{saved\.slug\}\s+dirty=\{dirty\}\s+folder=\{folderLabel\(space\)\}\s+onFolder=\{\(\) => draft\.setFolderOpen\(true\)\}\s+triggerClassName="size-10"\s+\/>/);
  assert.doesNotMatch(bar, /<ExportMenu\b/);
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

/* Take B2 on a computer (Stay, 24 October 2026: "find a way to add save to that
 * toolbar and still remove that heading text and word count at the top"): no
 * header, one bar with the formatting, Save and the close, the document across
 * the panel's width, no outlines. The phone sheet keeps its header, its
 * wrapped bar and its foot. */

test('on a computer the draft panel has no title line and no foot: one bar holds Save and the close', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('./DraftPanel.tsx', import.meta.url), 'utf8');
  const frame = readFileSync(new URL('../side-panel/ChatSidePanel.tsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  // Every state of the draft panel is bare: the header is not drawn on a computer.
  assert.equal(panel.match(/\bbare\b\s*(>|\n)/g)?.length, 2);
  assert.doesNotMatch(panel, /footer=/);
  assert.match(frame, /bare && 'xl:hidden',/);
  // The phone sheet keeps its header: the title, "Draft · 219 words" and the tile.
  assert.match(panel, /subtitle=\{draftStatus\(draft, Boolean\(streamingMessage\)\)\}/);
  // One bar: the formatting, then Save, then the close; every state has the close.
  assert.match(editor, /<div className="flex min-w-0 flex-1 items-center">\{tools\}<\/div>\s*\{actions\}\s*<SidePanelCloseButton \/>/);
  assert.match(editor, /<DraftBar\s+tools=\{<DraftBarTools editor=\{editor\} frameRef=\{frameRef\} \/>\}\s+actions=\{<DraftSaveControl draft=\{draft\} dirty=\{dirty\} space=\{space\} \/>\}\s+\/>/);
  assert.equal(panel.match(/<DraftBar \/>/g)?.length, 2);
  assert.match(frame, /export function SidePanelCloseButton\(\)/);
  // The sheet's foot is not drawn on a computer; the bar's Save is drawn only there.
  assert.match(bar, /<div className="v2-draft-save-foot sticky bottom-0 z-10 [^"]* xl:hidden">/);
  assert.match(bar, /<div className=\{cn\('relative hidden shrink-0 items-center xl:flex', saved \? 'gap-0\.5' : 'gap-px'\)\}>/);
  assert.match(editor, /className="v2-draft-bar sticky top-0 z-10 hidden h-12 shrink-0 items-center [^"]*xl:flex"/);
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
  // "Save" (Stay, 25 October 2026: "just have 'Save'"); a screen reader hears "Save as a note".
  assert.match(bar, /return draft\.saved \? 'Save changes' : 'Save';/);
  assert.match(bar, /return draft\.saved \|\| draft\.mutation\.isPending \? null : <span className="sr-only"> as a note<\/span>;/);
  assert.doesNotMatch(bar.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), />\s*Save as note\s*</);
  // A narrow panel (a 1280 screen) says "Save", by the bar's own fold width.
  assert.match(control, /<span className="@max-\[37\.5rem\]\/draft:hidden">\s*\{saveLabel\(draft\)\}\s*<SaveAsNoteHint draft=\{draft\} \/>\s*<\/span>\s*<span className="hidden @max-\[37\.5rem\]\/draft:inline">\s*\{shortSaveLabel\(draft\)\}\s*<SaveAsNoteHint draft=\{draft\} \/>\s*<\/span>/);
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
  assert.match(menu, /<DropdownMenuContent align="end" className=\{DRAFT_MENU\}>/);
});

test('the bar\'s ··· holds the lists, alignment and Copy, and its rows never wrap', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./draft-panel.css', import.meta.url), 'utf8');
  const tools = editor.slice(editor.indexOf('function DraftBarTools'), editor.indexOf('/** The bar\'s ···'));
  const more = editor.slice(editor.indexOf('function BarMoreMenu'));
  // undo, redo · style, font and size · B I U, then ···.
  assert.match(tools, /<StyleSelect editor=\{editor\} state=\{state\} mac=\{mac\} pill menuClassName=\{DRAFT_MENU\} \/>/);
  assert.match(tools, /<FontSizeMenu editor=\{editor\} menuClassName=\{DRAFT_MENU\} \/>/);
  assert.match(tools, /<BarMoreMenu /);
  assert.doesNotMatch(tools, /LIST_VERBS\.map|<AlignMenu|icon=\{copied/);
  assert.match(more, /LIST_VERBS\.map/);
  assert.match(more, /ALIGN_OPTIONS\.map/);
  assert.match(more, /'Copy text'/);
  // At a narrow panel Redo, Underline and the text style fold into ···, by one width in CSS and in the menu.
  assert.match(editor, /const BAR_FOLD_WIDTH = 600;/);
  assert.equal(tools.match(/@max-\[37\.5rem\]\/draft:hidden/g)?.length, 3);
  assert.match(more, /\{folded \? \(/);
  assert.match(more, /STYLE_OPTIONS\.map/);
  // No row wraps (718accef's fix, here for the draft's menus).
  assert.match(bar, /export const DRAFT_MENU = 'v2-draft-menu w-max min-w-56 max-w-\[calc\(100vw-1rem\)\]';/);
  assert.match(more, /className=\{DRAFT_MENU\}/);
  assert.match(css, /\[data-slot='dropdown-menu-radio-item'\],\s*\.v2-draft-menu \[data-slot='dropdown-menu-label'\] \{\s*white-space: nowrap;\s*\}/);
});

test('the document spans the panel with even margins up to a reading width, in the same type', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('./DraftPanel.tsx', import.meta.url), 'utf8');
  const frame = readFileSync(new URL('../side-panel/ChatSidePanel.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./draft-panel.css', import.meta.url), 'utf8');
  // 48px margins, 32px under 37.5rem, up to 780px of text; the phone sheet keeps its measure.
  assert.match(editor, /export const DRAFT_DOCUMENT =\s*'mx-auto w-full max-w-\[68ch\] px-5 py-6 xl:max-w-\[876px\] xl:px-8 xl:pt-8 xl:pb-30 xl:text-\[15px\] xl:@min-\[37\.5rem\]\/draft:px-12';/);
  assert.match(editor, /<div ref=\{frameRef\} className="@container\/draft flex min-h-full flex-col">/);
  assert.match(panel, /<article className=\{DRAFT_DOCUMENT\}>/);
  // A wide monitor gets a wide panel, up to 56rem.
  assert.match(frame, /bare && 'v2-side-panel-bare xl:w-\[min\(52%,56rem\)\] xl:border-l-0',/);
  // The type size stays.
  assert.match(css, /\.v2-draft-doc \{\s*font-size: 15px;\s*line-height: 1\.72;\s*\}/);
});

test('no outlines on a computer: a background step from the chat, a filled bar, menus with no ring', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./draft-panel.css', import.meta.url), 'utf8');
  const sideCss = readFileSync(new URL('../side-panel/side-panel.css', import.meta.url), 'utf8');
  // The panel stands apart by its background, light and dark, with no rule.
  assert.match(sideCss, /:root \{\s*--v2-side-panel-bg: oklch\(0\.982 0 0\);\s*\}/);
  assert.match(sideCss, /\.dark \{\s*--v2-side-panel-bg: oklch\(0\.178 0 0\);\s*\}/);
  assert.match(sideCss, /\.v2-side-panel-bare \{\s*background: var\(--v2-side-panel-bg\);\s*\}/);
  // The bar is a filled band: no stroke, no shadow, no corners.
  assert.match(css, /\.v2-draft-bar \{\s*background: var\(--v2-draft-bar-bg\);\s*\}/);
  const barClass = editor.match(/className="(v2-draft-bar [^"]*)"/)?.[1] ?? '';
  assert.doesNotMatch(barClass, /\bborder\b|\bshadow\b|\brounded|\bring\b/);
  assert.doesNotMatch(css, /v2-draft-pill|0 0 0 1px|inset 0 0 0 1px/);
  // The only rules in the document are the draft's own: its tables and its horizontal rules.
  assert.equal(css.match(/border(-bottom)?: 1px solid/g)?.length, 1);
});

test('Escape in a menu opened from the panel closes the menu alone, not the panel (B2 pictures, 24 October 2026)', async () => {
  const { readFileSync } = await import('node:fs');
  const frame = readFileSync(new URL('../side-panel/ChatSidePanel.tsx', import.meta.url), 'utf8');
  // The menus draw in a portal outside the panel and React still passes their keys up: only an Escape
  // whose target is inside the panel's own element closes it.
  assert.match(frame, /if \(event\.key !== 'Escape' \|\| !event\.currentTarget\.contains\(event\.target as Node\)\) return;\s*event\.stopPropagation\(\);\s*requestClose\(\);/);
});

test('on a phone the sheet takes the visible rectangle, so the keyboard never hides it, and the chat box is not drawn under it (Arthur, 24 October 2026)', async () => {
  const { readFileSync } = await import('node:fs');
  const frame = readFileSync(new URL('../side-panel/ChatSidePanel.tsx', import.meta.url), 'utf8');
  // Placed from the top of what is visible, at what is visible less the 2.5rem strip; never from the page's bottom.
  assert.match(frame, /'fixed inset-x-0 top-\[calc\(var\(--visual-top,0px\)\+2\.5rem\)\] z-50 flex h-\[calc\(var\(--visual-height,100dvh\)-2\.5rem\)\] flex-col/);
  assert.doesNotMatch(frame, /fixed inset-x-0 bottom-0 z-50/);
  // The keyboard hook still publishes the rectangle the sheet reads.
  const hook = readFileSync(new URL('../../../../shell/use-keyboard-inset.ts', import.meta.url), 'utf8');
  assert.match(hook, /root\.style\.setProperty\('--visual-height', `\$\{viewport\.height\}px`\);/);
  assert.match(hook, /root\.style\.setProperty\('--visual-top', `\$\{top\}px`\);/);
  const shell = readFileSync(new URL('../../../../shell/shell.css', import.meta.url), 'utf8');
  assert.match(shell, /@media \(max-width: 79\.999rem\) \{[\s\S]*?html\[data-v2-side-panel\] \.v2-shell__dock \{\s*visibility: hidden;\s*\}/);
});

test('the caret stays in view as the keyboard rises: scrolled to on focus and on every visible-area change (Arthur, 24 October 2026)', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  assert.match(editor, /viewport\?\.addEventListener\('resize', keepCaretInView\);\s*editor\.on\('focus', keepCaretInView\);/);
  assert.match(editor, /if \(!editor\.isFocused\) return;/);
  assert.match(editor, /if \(!editor\.isDestroyed\) editor\.commands\.scrollIntoView\(\);/);
  assert.match(editor, /scrollMargin: \{ top: CARET_MARGIN_TOP, bottom: CARET_MARGIN_BOTTOM, left: 0, right: 0 \},/);
});

test('while the reader types on a phone: the title row down to ×, one row of tools, no Save foot (WebKit at a 420px visible height)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('./draft-panel.css', import.meta.url), 'utf8');
  // Typing: the editor has focus, or a menu from the folded row is open (its opening takes the focus).
  const typing = String.raw`\.v2-side-panel-bare:is\(:has\(\.ProseMirror-focused\), :has\(\.v2-draft-typing-tools \[aria-expanded='true'\]\)\)`;
  assert.match(css, new RegExp(`${typing} > header \\{\\s*justify-content: flex-end;`));
  assert.match(css, new RegExp(`${typing} > header > :not\\(:last-child\\),\\s*${typing} \\.v2-draft-sheet-tools,\\s*${typing} \\.v2-draft-save-foot \\{\\s*display: none;`));
  assert.match(css, new RegExp(`${typing} \\.v2-draft-typing-tools \\{\\s*display: flex;`));
  // Held by the trigger's aria-expanded, never its data-state: the font menu's tooltip writes its own
  // data-state on the same button and wins, so a data-state rule never held, and the menu closed as the
  // row swapped back under the reader's finger (WebKit, 24 October 2026).
  assert.doesNotMatch(css, /v2-draft-typing-tools \[data-state/);
  // The phone's sticky rows are solid: in WebKit a blurred, see-through row showed the text scrolled under it
  // (keyboard-typed, 24 October 2026).
  const rows = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8') + readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  for (const row of ['v2-draft-typing-tools', 'v2-draft-sheet-tools', 'v2-draft-save-foot']) {
    const className = rows.match(new RegExp(`className="${row} ([^"]*)"`))?.[1] ?? '';
    assert.match(className, /(^| )bg-popover( |$)/, row);
    assert.doesNotMatch(className, /backdrop-blur|bg-popover\//, row);
  }
  // The folded row is the computer bar's own tools; the three-row toolbar carries its class.
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  assert.match(editor, /<div className="v2-draft-typing-tools sticky top-0 z-10 hidden [^"]*">\s*<DraftBarTools editor=\{editor\} frameRef=\{frameRef\} \/>/);
  assert.match(editor, /className="v2-draft-sheet-tools sticky top-0 z-10 flex shrink-0 flex-wrap /);
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /<div className="v2-draft-save-foot sticky bottom-0 z-10/);
  // Only the draft's sheet carries the class (ChatSidePanel's `bare`).
  const frame = readFileSync(new URL('../side-panel/ChatSidePanel.tsx', import.meta.url), 'utf8');
  assert.match(frame, /bare && 'v2-side-panel-bare /);
});
