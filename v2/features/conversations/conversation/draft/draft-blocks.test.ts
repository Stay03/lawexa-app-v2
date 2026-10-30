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
      id: null,
      version: null,
    },
  });
  assert.deepEqual(parts[2], { kind: 'text', text: '\nTell me what to change.' });
});

test('while it streams, an open draft runs to the end and a half-written tag is held back', () => {
  const growing = 'TEST DATA. Drafting now.\n<draft title="Notice to Quit">\nTake notice that you are to quit';
  const [, draft] = splitDrafts(growing, true);
  assert.deepEqual(draft, {
    kind: 'draft',
    draft: { title: 'Notice to Quit', body: 'Take notice that you are to quit', complete: false, font: null, size: null, id: null, version: null },
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

test('a tag may carry the draft’s fixed id and version; a bad one is dropped', () => {
  const [kept] = draftsIn('<draft title="TEST DATA Lease" version="2" id="k3f9q2" font="Georgia">\nx\n</draft>');
  assert.equal(kept.id, 'k3f9q2');
  assert.equal(kept.version, 2);
  assert.equal(kept.font, 'Georgia');
  for (const id of ['abc', 'abcdefghijklm', 'K3F9Q2', 'k3f-q2', 'k3f9 q2', '']) {
    assert.equal(draftsIn(`<draft title="A" id="${id}">\nx\n</draft>`)[0].id, null, id);
  }
  for (const version of ['0', '1000', '-1', '1.5', 'two', '']) {
    assert.equal(draftsIn(`<draft title="A" version="${version}">\nx\n</draft>`)[0].version, null, version);
  }
  // A tag without them reads as before.
  const [plain] = draftsIn('<draft title="A">\nx\n</draft>');
  assert.equal(plain.id, null);
  assert.equal(plain.version, null);
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
  assert.equal(draftStatus({ title: 'A', body, complete: true, font: null, size: null, id: null, version: null }, false), 'Draft · 3 words');
  assert.equal(draftStatus({ title: 'A', body, complete: false, font: null, size: null, id: null, version: null }, true), 'Writing · 3 words');
  assert.equal(draftStatus({ title: 'A', body, complete: false, font: null, size: null, id: null, version: null }, false), 'Unfinished · 3 words');
});

test('a draft saves into its note as it is typed, with the note editor’s own autosave, mirror and stale-copy check', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  // Drafts saved as notes (thread 1e44eb39): the note editor's autosave, made on the copy the editor opened.
  assert.match(editor, /const autosave = useNoteAutosave\(\{/);
  assert.match(editor, /\{ id: record\.id, draft: \{ title: record\.title, content: record\.content \?\? '' \}, updatedAt: record\.updated_at \?\? null \}/);
  assert.match(editor, /paused: !savesToNote,/);
  // Every change goes to the autosave and the device mirror; nothing saves from a panel that does not edit the note.
  assert.match(editor, /if \(!savesToNote \|\| !record\) return;\s*const draft = \{ title: record\.title, content: instance\.getHTML\(\) \};\s*reportDraft\(draft\);\s*mirrorWrite\(draft\);/);
  // A newer copy (409) stops saving and says so, with Reload.
  assert.match(editor, /\{autosave\.status === 'conflict' \? \(\s*<DraftLineBar\s+tone="alert"/);
  // Typing a save never reached is offered back to copy, never put over the note.
  assert.match(editor, /const typingOffer = savesToNote && !offerDismissed \? pickRestoreCandidate\(mirrorLookup\.data, record\) : null;/);
  assert.doesNotMatch(editor, /setContent\(typingOffer/);
  // The note opens from the server, never a kept copy.
  const queries = readFileSync(new URL('../../../notes/queries.ts', import.meta.url), 'utf8');
  assert.match(queries, /draftNoteOpen: \(\{ id, viewerId \}: \{ id: number \} & ViewerScoped\) =>\s*queryOptions\(\{\s*queryKey: \[\.\.\.notesQueries\.all, 'draft-note-open', id, \{ viewerId \}\] as const,\s*queryFn: \(\) => notesApi\.byId\(id\),\s*staleTime: 0,\s*gcTime: 0,/);
});

test('the panel’s note menu: Open note, both exports, Version history and Save to folder, on a phone too', async () => {
  const { readFileSync } = await import('node:fs');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  // The phone sheet's foot is one row: the save state and the note's ··· menu, 40px to tap
  // (Arthur's iPhone recording, 24 October 2026: four pills wrapped onto two rows).
  const foot = bar.slice(bar.indexOf('export function DraftSaveBar'), bar.indexOf('function DownloadPill'));
  assert.match(foot, /\{autosave \? <SaveIndicator \{\.\.\.autosave\} \/> : <span \/>\}/);
  assert.match(foot, /<NoteMenu\s+note=\{note\}\s+saving=\{autosave !== null\}\s+folder=\{folderLabel\(space\)\}\s+onFolder=\{\(\) => tools\.setFolderOpen\(true\)\}\s+onHistory=\{onHistory\}\s+triggerClassName="size-10"\s+\/>/);
  assert.match(bar, /target=\{\{ type: 'note', contentId: note\.id \}\}/);
  assert.match(bar, /space=\{space \?\? undefined\}/);
  // No Save button: the note saves itself.
  assert.doesNotMatch(bar, /NotebookPen|Save as note|useSaveDraftNote/);
});

test('a draft opens itself when Lawexa finishes it, unless the reader is writing in the message box', async () => {
  const { readFileSync } = await import('node:fs');
  const card = readFileSync(new URL('./DraftCard.tsx', import.meta.url), 'utf8');
  // Only a draft the card saw being written opens by itself; a saved one waits for a tap.
  assert.match(card, /const seenWriting = useRef\(!draft\.complete && live\);/);
  assert.match(card, /if \(!seenWriting\.current \|\| !panel\) return;\s*seenWriting\.current = false;[\s\S]*?if \(!readerIsTyping\(\)\) panel\.open\(\{ kind: 'draft', ordinal \}\);/);
  // A version just finished reads the chat's draft notes again (drafts saved as notes: "Edited" stays true),
  // once its answer has ended and so is saved, not at the draft's closing tag (Arthur's report, 30 October 2026).
  assert.match(card, /seenWriting\.current = false;\s*readWhenSaved\.current = true;/);
  assert.match(
    card,
    /if \(live \|\| chatStreaming \|\| !draft\.complete \|\| !readWhenSaved\.current\) return;\s*readWhenSaved\.current = false;\s*if \(chat\?\.conversationId\) \{\s*void queryClient\.invalidateQueries\(\{ queryKey: \[\.\.\.notesQueries\.all, 'draft-notes', chat\.conversationId\] \}\);/,
  );
  // The open at the closing tag no longer reads the list: the card reads it in one place only.
  assert.equal(card.split('invalidateQueries').length - 1, 1);
  // Writing means the box is focused or holds words.
  // The shell's box on a chat's route, the case chat's own on a case page.
  assert.match(card, /document\.querySelector<HTMLTextAreaElement>\(\s*'\[data-v2-chat-dock\] textarea, \[data-v2-case-chat-composer\] textarea',\s*\)/);
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

test('on a computer the draft panel has no title line and no foot: one bar holds the save state and the close', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(new URL('./DraftPanel.tsx', import.meta.url), 'utf8');
  const frame = readFileSync(new URL('../side-panel/ChatSidePanel.tsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  // Every state of the draft panel is bare: the header is not drawn on a computer
  // (the draft, the one still due, the one no longer in the chat, and Show changes).
  assert.equal(panel.match(/\bbare\b\s*(>|\n)/g)?.length, 4);
  assert.doesNotMatch(panel, /footer=/);
  assert.match(frame, /bare && 'xl:hidden',/);
  // The phone sheet keeps its header: the title, "Draft · 219 words" and the tile.
  assert.match(panel, /subtitle=\{draftStatus\(draft, Boolean\(streamingMessage\)\)\}/);
  // One bar: the formatting (where the draft is edited), then the save state and menu, then the close.
  assert.match(editor, /<div className="flex min-w-0 flex-1 items-center">\{tools\}<\/div>\s*\{actions\}\s*<SidePanelCloseButton \/>/);
  assert.match(editor, /<DraftBar\s+tools=\{editable \? <DraftBarTools editor=\{editor\} frameRef=\{frameRef\} onFind=\{openFind\} \/> : null\}\s+actions=\{<DraftSaveControl \{\.\.\.actions\} \/>\}\s+\/>/);
  assert.equal(panel.match(/<DraftBar \/>/g)?.length, 4);
  assert.match(frame, /export function SidePanelCloseButton\(\)/);
  // The sheet's foot is not drawn on a computer; the bar's control is drawn only there.
  assert.match(bar, /<div className="v2-draft-save-foot sticky bottom-0 z-10 [^"]* xl:hidden">/);
  assert.match(bar, /<div className="relative hidden shrink-0 items-center gap-1 xl:flex">/);
  assert.match(editor, /className="v2-draft-bar sticky top-0 z-10 hidden h-12 shrink-0 items-center [^"]*xl:flex"/);
  // One set of tools and one folder picker serve both places.
  assert.equal(editor.match(/useDraftTools\(/g)?.length, 1);
  assert.equal(editor.match(/<DraftFolderPicker /g)?.length, 1);
});

test('the panel stays quiet: no gold fill, and the note editor’s transient save state, not a lit badge', async () => {
  const { readFileSync } = await import('node:fs');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8');
  // No gold fill anywhere in the panel (Stay, 25 October 2026: the gold button "looks ugly like a sore thumb").
  assert.doesNotMatch(bar, /\bbg-primary\b(?!\/)/);
  assert.doesNotMatch(editor, /\bbg-primary\b(?!\/)/);
  // The save state is the note editor's SaveIndicator: silent while saved, a short "Saved", a chip with Retry.
  const control = bar.slice(bar.indexOf('export function DraftSaveControl'), bar.indexOf('export function DraftSaveBar'));
  assert.match(control, /\{autosave \? <SaveIndicator \{\.\.\.autosave\} \/> : null\}/);
  assert.match(editor, /const saveState = savesToNote \? \{ \.\.\.autosave, onRetry: autosave\.retry \} : null;/);
  // A failed download still says why, under the control.
  assert.match(control, /role="alert"[\s\S]*?\{tools\.downloads\.failure\}/);
});

test('the note menu lists, in order: what saving does, Open note, Export Word and PDF, Version history, Save to folder', async () => {
  const { readFileSync } = await import('node:fs');
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  const control = bar.slice(bar.indexOf('export function DraftSaveControl'), bar.indexOf('export function DraftSaveBar'));
  // Where there is a note, its menu; where there is none, the downloads.
  assert.match(control, /\{note \? \(\s*<NoteMenu[\s\S]*?\) : \(\s*<DownloadMenu downloads=\{tools\.downloads\} \/>\s*\)\}/);
  const menu = bar.slice(bar.indexOf('function NoteMenu'), bar.indexOf('export function DraftFolderPicker'));
  const order = ['In your notes', 'Open note', 'Export Word', '.docx', 'Export PDF', '.pdf', 'Version history', '{folder}'];
  let at = -1;
  for (const word of order) {
    const next = menu.indexOf(word, at + 1);
    assert.ok(next > at, word);
    at = next;
  }
  assert.match(menu, /'Your edits save as you type, and Lawexa sees them\.'/);
  assert.match(menu, /onSelect=\{\(\) => void download\('docx'\)\}/);
  assert.match(menu, /onSelect=\{\(\) => void download\('pdf'\)\}/);
  assert.match(menu, /<Link href=\{`\/notes\/\$\{note\.slug\}`\}>/);
  assert.match(menu, /<DropdownMenuItem onSelect=\{onHistory\}>/);
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
  assert.match(editor, /<div ref=\{frameRef\} className="@container\/draft flex h-full min-h-0 flex-col">/);
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
  // The typing row's tools open find too (find and replace, 24 October 2026).
  assert.match(editor, /<div className="v2-draft-typing-tools sticky top-0 z-10 hidden [^"]*">\s*<DraftBarTools editor=\{editor\} frameRef=\{frameRef\} onFind=\{openFind\} \/>/);
  assert.match(editor, /className="v2-draft-sheet-tools sticky top-0 z-10 flex shrink-0 flex-wrap /);
  const bar = readFileSync(new URL('./DraftSaveBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /<div className="v2-draft-save-foot sticky bottom-0 z-10/);
  // Only the draft's sheet carries the class (ChatSidePanel's `bare`).
  const frame = readFileSync(new URL('../side-panel/ChatSidePanel.tsx', import.meta.url), 'utf8');
  assert.match(frame, /bare && 'v2-side-panel-bare /);
});

test('the draft scrolls in its own area: the bars and the find box sit above it, Save below it', async () => {
  const { readFileSync } = await import('node:fs');
  const editor = readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  // Arthur's iPhone, 25 October 2026: a find box inside the scroller made iOS scroll the draft back to its top.
  const frame = editor.indexOf('<div ref={frameRef} className="@container/draft flex h-full min-h-0 flex-col">');
  const bars = editor.indexOf('<div className="relative z-10 shrink-0">', frame);
  const find = editor.indexOf('<FindBar', bars);
  const scroll = editor.indexOf('<div\n        data-v2-draft-scroll\n        className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain', find);
  const content = editor.indexOf('<EditorContent editor={editor} />', scroll);
  const save = editor.indexOf('<DraftSaveBar', content);
  assert.ok(frame > 0 && frame < bars && bars < find && find < scroll && scroll < content && content < save);
  // The find box is not inside the scroll area: the area closes before Save, and opens after the find bar.
  assert.ok(editor.slice(scroll, save).indexOf('<FindBar') === -1);
  // The bars no longer stick inside a scroller: they are outside it.
  assert.doesNotMatch(editor.slice(frame, scroll), /<div className="sticky top-0 z-10 shrink-0">/);
  // The caret keeps a line of room inside that area; the bars are not in it any more.
  assert.match(editor, /const CARET_MARGIN_TOP = 24;\nconst CARET_MARGIN_BOTTOM = 24;/);
});
