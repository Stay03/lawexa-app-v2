import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notePeekFor, rememberNotePeek } from './note-peek';

/* Speed step 5, notes (17 October 2026): a tapped row's name and author draw
 * at once, in the masthead's own type. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the tap keeps the row\'s name and author, for that note only, one entry', () => {
  rememberNotePeek({ slug: 'a-note', title: 'Service by WhatsApp', hasTitle: true, author: 'Ada Obi' });
  assert.deepEqual(notePeekFor('a-note'), { slug: 'a-note', title: 'Service by WhatsApp', hasTitle: true, author: 'Ada Obi' });
  assert.equal(notePeekFor('b-note'), null);
  assert.equal(notePeekFor(undefined), null);
  rememberNotePeek({ slug: 'b-note', title: 'Untitled', hasTitle: false, author: null });
  assert.equal(notePeekFor('a-note'), null);
  assert.equal(notePeekFor('b-note')?.hasTitle, false);
});

test('the row leaves its facts on the tap, and both waits draw them; the date and draft mark wait for the note', () => {
  assert.match(read('library', 'NoteRow.tsx'), /onClick=\{\(\) => rememberNotePeek\(row\)\}/);
  const fallback = read('reader', 'NoteFallback.tsx');
  assert.match(fallback, /const peek = useNotePeek\(slugOf\(usePathname\(\)\)\);/);
  assert.match(fallback, /<NoteDocumentSkeleton masthead=\{peek \? <PeekMasthead peek=\{peek\} \/> : undefined\} \/>/);
  assert.match(fallback, /<h1 className=\{cn\('doc-title text-foreground', !peek\.hasTitle && 'doc-title-untitled'\)\}>/);
  // The editor's address is not a note to peek at: the slug must end the path.
  assert.ok(fallback.includes('pathname?.match(/\\/notes\\/([^/]+)\\/?$/)'));
  // Nothing that would draw a date or a draft mark from the row.
  assert.doesNotMatch(fallback, /formatNoteDate|updatedAt|isDraft|peek\.status/);
  assert.match(fallback, /import '\.\/note-masthead\.css';/);
  assert.doesNotMatch(fallback, /from '\.\/Note(Screen|Document|Content)'/);
  assert.match(read('reader', 'NoteScreen.tsx'), /if \(query\.isPending\) return <NoteFallback \/>;/);
  const masthead = read('reader', 'note-masthead.css');
  const documentCss = read('reader', 'note-document.css');
  for (const rule of ['.v2-note-doc .doc-kicker', '.v2-note-doc .doc-title', '.v2-note-doc .doc-title-untitled']) {
    assert.ok(masthead.includes(rule), rule);
    assert.ok(!documentCss.includes(`${rule} {`), `${rule} defined once`);
  }
  assert.match(read('reader', 'NoteDocument.tsx'), /import '\.\/note-masthead\.css';/);
});

test('the kicker and the name do not fade when the note arrives under them', () => {
  assert.match(read('reader', 'NoteScreen.tsx'), /arrival === 'peeked'\s*\? 'v2-note-arrive-peeked'/);
  assert.match(
    read('reader', 'note-document.css'),
    /\.v2-note-arrive-peeked > article > :not\(header\),\s*\.v2-note-arrive-peeked > article > header > :not\(\.doc-kicker, \.doc-title\)/,
  );
});
