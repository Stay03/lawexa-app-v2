import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { noteRow, noteTags } from '../note-row-model';
import { ROW_TAGS, formatRowDate, noteRowMeta, rowTags } from './note-row-meta';

/* The Notes list, the owner's take A (23 October 2026): title, a two-line
 * summary, then one grey line. My notes: the date. All notes: the author, then
 * the date. On a computer the tags follow as pills, 3 then "+N", the same on
 * both tabs; a phone row has no tags (Stay, 25 October 2026). */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

// Noon, so no time zone moves the day.
const NOW = Date.parse('2026-10-24T12:00:00Z');
const row = {
  author: 'Ada Okafor',
  updatedAt: '2026-10-23T12:00:00Z',
  tags: ['Land law', 'Property'],
};

const nine = [
  'Start Up Law',
  'Company law',
  'Contract',
  'Tax',
  'Employment',
  'Intellectual property',
  'Finance',
  'Regulation',
  'Data protection',
];

test('My notes: the date; no author', () => {
  assert.deepEqual(noteRowMeta(row, 'mine', NOW), ['23 Oct']);
});

test('All notes: the author first, then the date', () => {
  assert.deepEqual(noteRowMeta(row, 'all', NOW), ['Ada Okafor', '23 Oct']);
});

test('a row shows 3 tags, then +N for the rest', () => {
  assert.equal(ROW_TAGS, 3);
  assert.deepEqual(rowTags(nine), { shown: ['Start Up Law', 'Company law', 'Contract'], more: 6 });
  assert.deepEqual(rowTags(nine.slice(0, 4)), { shown: ['Start Up Law', 'Company law', 'Contract'], more: 1 });
  assert.deepEqual(rowTags(nine.slice(0, 3)), { shown: ['Start Up Law', 'Company law', 'Contract'], more: 0 });
  assert.deepEqual(rowTags(['Tax']), { shown: ['Tax'], more: 0 });
  assert.equal(rowTags([]), null);
});

test('the tags, and the dot before them, show on a computer only; the +N never shrinks', () => {
  const source = read('NoteRow.tsx');
  assert.match(source, /const tags = rowTags\(row\.tags\);/);
  assert.match(
    source,
    /\{tags \? \(\s*<span className="flex min-w-0 items-baseline max-sm:hidden">\s*\{meta\.length > 0 \? <MetaDot \/> : null\}\s*<NoteTagList tags=\{tags\.shown\} more=\{tags\.more\} \/>/,
  );
  // The author and the date keep their width; the tags are the part that gives way.
  assert.match(source, /<span className="shrink-0">\{part\}<\/span>/);
  const css = read('..', 'note-tags.css');
  assert.match(css, /\.v2-note-tag \{\s*flex: 0 1 auto;/);
  assert.match(css, /\.v2-note-tag-more \{\s*flex: none;/);
  // Look A, the light grey pill, with no switch left from the probe.
  assert.match(css, /border-radius: 999px;\s*background: color-mix\(in oklab, var\(--muted\) 90%, var\(--foreground\) 4%\);/);
  assert.doesNotMatch(css + read('..', 'note-tag-list.tsx'), /data-tag-look|PROBE/);
});

test('a part the note does not have is dropped, never filled in', () => {
  assert.deepEqual(noteRowMeta({ ...row, author: null }, 'all', NOW), ['23 Oct']);
  assert.deepEqual(noteRowMeta({ ...row, updatedAt: 'not a date' }, 'mine', NOW), []);
  assert.deepEqual(noteRowMeta({ ...row, author: null, updatedAt: 'not a date' }, 'all', NOW), []);
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
  assert.match(source, /mt-2 flex min-w-0 items-baseline overflow-hidden whitespace-nowrap text-\[13px\] leading-5 text-muted-foreground/);
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

test('the note page ends with every tag as pills under a hairline, on a phone and a computer', () => {
  assert.deepEqual(noteTags([' Land law ', '', 'Property']), ['Land law', 'Property']);
  assert.deepEqual(noteTags(null), []);
  const page = read('..', 'reader', 'NoteDocument.tsx');
  assert.match(page, /const tags = noteTags\(note\.tags\);/);
  // Every tag, wrapping, with no width class hiding them.
  assert.match(
    page,
    /\{tags\.length > 0 \? \(\s*<footer className="border-t border-border\/60 pt-6">\s*<NoteTagList tags=\{tags\} wrap \/>\s*<\/footer>\s*\) : null\}\s*<\/article>/,
  );
  // After the body, and only once.
  const tags = page.indexOf('<NoteTagList');
  assert.ok(tags > page.indexOf('<NoteContent html={body} />') && tags > page.indexOf('</header>'));
  assert.equal(page.split('<NoteTagList').length, 2);
  const list = read('..', 'note-tag-list.tsx');
  assert.match(list, /<span className="sr-only">Tags: <\/span>/);
  assert.match(list, /<span className="sr-only">and <\/span>\+\{more\}/);
});
