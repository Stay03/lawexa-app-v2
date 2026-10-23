import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { noteRow } from '../note-row-model';
import { formatRowDate, noteRowMeta } from './note-row-meta';

/* The Notes list, the owner's take A (23 October 2026): title, a two-line
 * summary, then one grey line. My notes: date · tags. All notes: the author
 * first, then the date, then the first tag only. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

// Noon, so no time zone moves the day.
const NOW = Date.parse('2026-10-24T12:00:00Z');
const row = {
  author: 'Ada Okafor',
  updatedAt: '2026-10-23T12:00:00Z',
  tags: ['Land law', 'Property'],
};

test('My notes: the date, then every tag; no author', () => {
  assert.deepEqual(noteRowMeta(row, 'mine', NOW), ['23 Oct', 'Land law, Property']);
});

test('All notes: the author first, then the date, then the first tag only', () => {
  assert.deepEqual(noteRowMeta(row, 'all', NOW), ['Ada Okafor', '23 Oct', 'Land law']);
});

test('a part the note does not have is dropped, never filled in', () => {
  assert.deepEqual(noteRowMeta({ ...row, tags: [] }, 'mine', NOW), ['23 Oct']);
  assert.deepEqual(noteRowMeta({ ...row, tags: [] }, 'all', NOW), ['Ada Okafor', '23 Oct']);
  assert.deepEqual(noteRowMeta({ ...row, author: null }, 'all', NOW), ['23 Oct', 'Land law']);
  assert.deepEqual(noteRowMeta({ ...row, updatedAt: 'not a date' }, 'mine', NOW), ['Land law, Property']);
});

test('the year shows only for a date outside the current year', () => {
  assert.equal(formatRowDate('2026-01-05T12:00:00Z', NOW), '5 Jan');
  assert.equal(formatRowDate('2025-12-30T12:00:00Z', NOW), '30 Dec 2025');
});

test('the row draws take A: title, summary, then the meta line, with the menu and no star', () => {
  const source = read('NoteRow.tsx');
  assert.match(source, /const meta = noteRowMeta\(row, tab, now\);/);
  const title = source.indexOf('{row.title}\n');
  const summary = source.indexOf('{row.preview}');
  const metaLine = source.indexOf('{meta.map(');
  assert.ok(title > 0 && title < summary && summary < metaLine, 'title, then summary, then meta');
  assert.match(source, /'block truncate text-base font-semibold leading-6/);
  assert.match(source, /line-clamp-2 max-w-\[640px\] text-sm leading-\[22px\]/);
  assert.match(source, /mt-2 block truncate text-\[13px\] leading-5 text-muted-foreground/);
  assert.match(source, /<NoteRowMenu row=\{row\} onAddToFolder=\{onAddToFolder\} onDelete=\{onDelete\} \/>/);
  assert.doesNotMatch(source, /NoteBookmarkButton|NotebookPen|formatRelativeTime/);
  // Hairline under every row, the last one too.
  assert.match(source, /<li\s+className="border-b border-border\/60/);
});

test('the row menu holds Save, Add to folder, Share and Export, and Edit and Delete on own notes', () => {
  const menu = read('NoteRowMenu.tsx');
  const order = ["'Remove from Saved' : 'Save'", 'Add to folder', 'Share\n', "'Exporting…' : 'Export'", 'Edit\n', 'Delete\n'];
  const items = menu.slice(menu.indexOf('<DropdownMenuContent'));
  let last = -1;
  for (const label of order) {
    const at = items.indexOf(label);
    assert.ok(at > last, `${label} in order`);
    last = at;
  }
  assert.match(menu, /useToggleNoteBookmark\(row\.id\)/);
  assert.match(menu, /\{signedIn && !row\.isSpaceCopy \? \(\s*<DropdownMenuItem onSelect=\{addToFolder\}>/);
  assert.match(menu, /\{row\.canEdit \? \(/);
  assert.match(menu, /\{row\.isSpaceCopy \? null : \(\s*<DropdownMenuItem variant="destructive"/);
  // The reader's export, the shared share behaviour and the editor's delete dialog, reused.
  assert.match(menu, /useNoteExport\(row\.slug\)/);
  assert.match(menu, /useShareAction\(\{/);
  const dialogs = read('note-row-dialogs.tsx');
  assert.match(dialogs, /<FolderPicker\s+key=\{filing\.key\}\s+target=\{\{ type: 'note', contentId: filing\.noteId \}\}/);
  assert.match(dialogs, /<DeleteNoteDialog/);
  assert.match(read('..', 'reader', 'NoteActions.tsx'), /useNoteExport\(slug\)/);
});

test('the list passes the tab and the viewer, and the search sits under the tab row', () => {
  const page = read('NotesBrowser.tsx');
  assert.match(page, /mapped\.push\(noteRow\(note, viewerId\)\);/);
  assert.match(page, /tab=\{tab\}\s+onAddToFolder=\{rowDialogs\.openAddToFolder\}\s+onDelete=\{rowDialogs\.openDelete\}/);
  assert.ok(page.indexOf('<NoteTabs') < page.indexOf('{searchAtTop ? <div className="mb-4">{searchField}</div> : null}'));
  const fallback = read('NotesFallback.tsx');
  assert.ok(fallback.indexOf('w-44') < fallback.indexOf('<SearchFieldShape className="mb-4" />'));
});

test('the row model carries the tags, and Edit only for the note\'s author', () => {
  const note = {
    id: 7,
    slug: 'consent',
    title: 'Consent',
    content_preview: 'Section 22',
    tags: [' Land law ', '', 'Property'],
    is_free: true,
    thumbnail_url: null,
    user: { id: 3, name: 'Ada Okafor' },
    created_at: '2026-10-23T12:00:00Z',
    is_bookmarked: false,
    bookmarks_count: 0,
  };
  assert.deepEqual(noteRow(note, 3).tags, ['Land law', 'Property']);
  assert.equal(noteRow(note, 3).canEdit, true);
  assert.equal(noteRow(note, 4).canEdit, false);
  assert.equal(noteRow(note).canEdit, false);
  assert.deepEqual(noteRow({ ...note, tags: null }, 3).tags, []);
});
