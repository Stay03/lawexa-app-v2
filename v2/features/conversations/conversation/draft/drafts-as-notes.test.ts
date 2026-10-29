import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fromChatsParam, parseNotesSource } from '@/v2/features/notes/library/notes-source';
import { noteRowMeta } from '@/v2/features/notes/library/note-row-meta';

/* Drafts saved as notes, the screen half (Stay's "go", 27 October 2026; the
 * design approved 29 October 2026, thread 1e44eb39; woz's API a518eaf3). The
 * wiring, pinned by source; the rules are in draft-note-state.test.ts and
 * draft-flush.test.ts. TEST DATA throughout. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const DRAFT = ['v2', 'features', 'conversations', 'conversation', 'draft'];

test('the API is woz’s: the list, the revisions, one revision, restore, and My notes’ from_chats', () => {
  const api = read('v2', 'features', 'notes', 'api.ts');
  assert.match(api, /apiClient\.get<DraftNotesEnvelope>\(\s*`\/conversations\/\$\{encodeURIComponent\(conversationUuid\)\}\/draft-notes`,/);
  assert.match(api, /apiClient\.get<NoteRevisionsEnvelope>\(`\/notes\/\$\{id\}\/revisions`, \{ params: \{ page \} \}\)/);
  assert.match(api, /apiClient\.get<NoteRevisionEnvelope>\(`\/notes\/\$\{id\}\/revisions\/\$\{revision\}`\)/);
  assert.match(api, /apiClient\.post<NoteRestoreEnvelope>\(`\/notes\/\$\{id\}\/revisions\/\$\{revision\}\/restore`\)/);
  assert.match(api, /from_chats: params\.from_chats,/);
  // The manual Save as note's read is gone with it.
  assert.doesNotMatch(api, /by-draft/);
  const types = read('v2', 'features', 'notes', 'types.ts');
  assert.match(types, /note_missing: DraftNoteMissing \| null;/);
  assert.match(types, /export type DraftNoteMissing = 'deleted' \| 'limit' \| 'moved' \| 'hidden';/);
  assert.match(types, /data: \{ note: NoteRecord; revision: number \};/);
});

test('the list is the server’s answer, never kept on the device, and is read again every 2 s only while a note catches up', () => {
  const queries = read('v2', 'features', 'notes', 'queries.ts');
  const leaf = queries.slice(queries.indexOf('draftNotes: ('), queries.indexOf('draftNoteOpen: ('));
  assert.doesNotMatch(leaf, /persist/);
  assert.match(leaf, /staleTime: 0,/);
  const hook = read(...DRAFT, 'use-draft-notes.ts');
  assert.match(hook, /return catchUpPoll\(state, waitingSince === null \? 0 : Date\.now\(\) - waitingSince\);/);
  // The wait is timed from the read that first showed it, never from a clock read in render.
  assert.match(hook, /if \(state\.kind === 'catching-up' && waitingSince === null\) setWaitingSince\(query\.dataUpdatedAt\);/);
});

test('the panel finds its document by the draft’s group and knows the newest version on screen', () => {
  const panel = read(...DRAFT, 'DraftPanel.tsx');
  assert.match(panel, /groupKey=\{draftGroupKey\(draft\)\}\s*latestOrdinal=\{version\?\.ordinals\[version\.count - 1\] \?\? ordinal\}/);
  const report = read('v2', 'features', 'radars', 'report', 'ReportDraftPanel.tsx');
  assert.match(report, /groupKey=\{draftGroupKey\(draft\)\}\s*latestOrdinal=\{target\.ordinal\}/);
  const editor = read(...DRAFT, 'DraftEditor.tsx');
  assert.match(editor, /useDraftNoteState\(conversationId, \{ ordinal, key: groupKey, latestOrdinal \}\)/);
  // An older version offers the latest; a list not reached, or a note slow to catch up, Try again.
  assert.match(editor, /state\.kind === 'older'\s*\?\s*\{ label: 'Open latest', onPress: \(\) => panel\?\.open\(\{ kind: 'draft', ordinal: state\.latestOrdinal \}\) \}/);
  assert.match(editor, /state\.kind === 'unlisted' \|\| \(state\.kind === 'catching-up' && waitedMs >= CATCH_UP_LIMIT_MS\)\s*\?\s*\{ label: 'Try again', onPress: retry \}/);
});

test('each state opens the right editor: the note, the page’s memory, or Lawexa’s text read only', () => {
  const editor = read(...DRAFT, 'DraftEditor.tsx');
  const pick = editor.slice(editor.indexOf('function DraftEditorFor'), editor.indexOf('function DraftNoteOpen'));
  assert.match(pick, /case 'loading':\s*return <DraftEditorSkeleton/);
  assert.match(pick, /case 'editable':\s*case 'read-only':\s*return \(\s*<DraftNoteOpen/);
  assert.match(pick, /case 'notes-off': \{[\s\S]*?mode=\{\{ kind: 'memory' \}\}/);
  assert.match(pick, /default:\s*return \(\s*<DraftEditorBody\s+key="lawexa"[\s\S]*?mode=\{\{ kind: 'lawexa' \}\}/);
  // Only the note, edited, and the page's memory where no note is kept take typing; the bar's formatting is drawn only then.
  assert.match(editor, /const editable = savesToNote \|\| mode\.kind === 'memory';/);
  assert.match(editor, /editable,\s*onUpdate:/);
  assert.match(editor, /\{editable \? <DraftToolbar editor=\{editor\} onFind=\{openFind\} \/> : null\}/);
  // The editor is drawn again only for a newer copy of the note, never for its own saves.
  assert.match(editor, /key=\{`\$\{record\.id\}:\$\{record\.updated_at \?\? ''\}`\}/);
});

test('an open draft registers its save with the send while it edits the note, and settles when all is saved', () => {
  const editor = read(...DRAFT, 'DraftEditor.tsx');
  assert.match(editor, /if \(!savesToNote\) return;\s*return registerDraftFlush\(conversationId, ordinal, \(\) => \{/);
  assert.match(editor, /if \(statusRef\.current === 'clean'\) return Promise\.resolve\(true\);/);
  assert.match(editor, /const SAVE_STOPPED: ReadonlySet<string> = new Set\(\['error', 'conflict', 'blocked'\]\);/);
  // A save of the reader's edits marks the card's document edited, without reading the list again.
  assert.match(editor, /onSaved: \(\) => \{\s*if \(mode\.kind === 'note'\) markDraftEdited\(queryClient, \{ conversationId, viewerId \}, mode\.documentKey\);/);
});

test('the version history: newest first, who and when, the chosen one against now, and Restore that asks first', () => {
  const dialog = read(...DRAFT, 'DraftHistoryDialog.tsx');
  assert.match(dialog, /\{revisionAuthorLabel\(row, userUuid\)\}/);
  assert.match(dialog, /diffDocs\(generateJSON\(now, extensions\), generateJSON\(then, extensions\)\)/);
  // Restore: never the newest, only for an editor, only once the draft's own edits are saved, and after a question.
  assert.match(dialog, /\{chosen && canRestore && chosen\.revision !== newest \? \(/);
  assert.match(dialog, /disabled=\{saving \|\| restore\.isPending\}/);
  assert.match(dialog, /<AlertDialogTitle>Restore this version\?<\/AlertDialogTitle>/);
  assert.match(dialog, /if \(chosen\) restore\.mutate\(chosen\.revision\);/);
  // After a restore the panel reads the note again and opens on it.
  assert.match(dialog, /onRestored\?\.\(\);/);
  const editor = read(...DRAFT, 'DraftEditor.tsx');
  assert.match(editor, /saving=\{savesToNote && autosave\.status !== 'clean'\}/);
  assert.match(editor, /onRestored=\{onReload\}/);
});

test('the newest version’s card says Edited once the reader changed it', () => {
  const card = read(...DRAFT, 'DraftCard.tsx');
  assert.match(card, /useDraftEdited\(chat\?\.conversationId, draftGroupKey\(draft\), Boolean\(panel\) && draft\.complete && !older\)/);
  assert.match(card, /\{edited \? ' · Edited' : null\}/);
  // The list is shared by the chat's cards: a card that does not ask never reads another's answer.
  const hook = read(...DRAFT, 'use-draft-notes.ts');
  assert.match(hook, /if \(!enabled\) return false;\s*return query\.data\?\.data\.documents\.find\(\(document\) => document\.key === key\)\?\.edited === true;/);
});

test('My notes shows all, the notes written here, or the drafts from chats, and marks the ones from a chat', () => {
  assert.equal(parseNotesSource(null), 'all');
  assert.equal(parseNotesSource('chats'), 'chats');
  assert.equal(parseNotesSource('own'), 'own');
  assert.equal(parseNotesSource('trending'), 'all');
  assert.equal(fromChatsParam('chats'), true);
  assert.equal(fromChatsParam('own'), false);
  assert.equal(fromChatsParam('all'), undefined);
  const now = Date.parse('2026-10-29T12:00:00Z');
  assert.deepEqual(noteRowMeta({ author: null, updatedAt: '2026-10-28T09:00:00Z', fromChat: true }, 'mine', now), ['28 Oct', 'From a chat']);
  assert.deepEqual(noteRowMeta({ author: null, updatedAt: '2026-10-28T09:00:00Z', fromChat: false }, 'mine', now), ['28 Oct']);
  const browser = read('v2', 'features', 'notes', 'library', 'NotesBrowser.tsx');
  assert.match(browser, /\.\.\.notesQueries\.mine\(\{ \.\.\.params, from_chats: fromChatsParam\(source\) \}\),/);
  assert.match(browser, /\{tab === 'mine' && canWrite \? \(\s*<div className="mb-4">\s*<NotesSourceFilter value=\{source\} onChange=\{setSource\} \/>/);
  const queries = read('v2', 'features', 'notes', 'queries.ts');
  // Each filter is its own cached list.
  assert.match(queries, /\{ search: params\.search \?\? null, fromChats: params\.from_chats \?\? null \},/);
});
