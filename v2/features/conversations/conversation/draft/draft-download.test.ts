import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { documentFallbackName, filenameFromDisposition, type ExportedFile } from '@/lib/api/export';
import { downloadFailureSentence, fetchDraftFile, type DraftFileInput } from './draft-download';

/* Save as note as a split button (Stay, 24 October 2026: "That save as note
 * should be a drop-down of 'save note, download docx, download pdf' or
 * something"): before the first save the draft downloads as Word or PDF, with
 * no note made. TEST DATA throughout. */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const INPUT: DraftFileInput = { title: 'TEST DATA Lease', html: '<p>TEST DATA body</p>', format: 'docx' };

test('a failed download names signed out, too large and too many, else asks to retry', () => {
  assert.equal(downloadFailureSentence({ response: { status: 401 } }), 'Sign in to download this draft.');
  assert.equal(downloadFailureSentence({ response: { status: 413 } }), 'This draft is too large to download.');
  assert.equal(downloadFailureSentence({ response: { status: 429 } }), 'Too many downloads. Try again in a minute.');
  assert.equal(downloadFailureSentence({ response: { status: 500 } }), "Couldn't download the draft. Try again.");
  assert.equal(downloadFailureSentence(new Error('offline')), "Couldn't download the draft. Try again.");
  assert.equal(downloadFailureSentence(null), "Couldn't download the draft. Try again.");
});

test('a draft file with no name from the server is lawexa-draft.docx or .pdf', () => {
  assert.equal(documentFallbackName('docx'), 'lawexa-draft.docx');
  assert.equal(documentFallbackName('pdf'), 'lawexa-draft.pdf');
  assert.equal(filenameFromDisposition(undefined, documentFallbackName('pdf')), 'lawexa-draft.pdf');
  assert.equal(filenameFromDisposition('attachment', documentFallbackName('docx')), 'lawexa-draft.docx');
  assert.equal(
    filenameFromDisposition('attachment; filename="TEST DATA Lease.docx"', documentFallbackName('docx')),
    'TEST DATA Lease.docx',
  );
});

test('with a mocked route, a download hands back the file it was sent', async () => {
  const blob = new Blob(['TEST DATA'], { type: 'application/pdf' });
  const sent: DraftFileInput[] = [];
  const fetcher = async (input: DraftFileInput): Promise<ExportedFile> => {
    sent.push(input);
    return { blob, filename: 'TEST DATA Lease.pdf' };
  };
  const result = await fetchDraftFile(fetcher, { ...INPUT, format: 'pdf' });
  assert.deepEqual(sent, [{ title: 'TEST DATA Lease', html: '<p>TEST DATA body</p>', format: 'pdf' }]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.file.blob, blob);
    assert.equal(result.file.filename, 'TEST DATA Lease.pdf');
  }
});

test('with a mocked route that answers 429, a download says to wait a minute', async () => {
  const fetcher = async (): Promise<ExportedFile> => {
    throw { response: { status: 429 } };
  };
  const result = await fetchDraftFile(fetcher, INPUT);
  assert.deepEqual(result, { ok: false, failure: 'Too many downloads. Try again in a minute.' });
});

test('the route posts the title, the html and the format, and reads a file', () => {
  const api = read('../../../../../lib/api/export.ts');
  assert.match(
    api,
    /apiClient\.post<Blob>\(\s*'\/export\/document',\s*\{ title: input\.title, html: input\.html, format: input\.format \},\s*\{ responseType: 'blob' \},\s*\)/,
  );
  assert.match(api, /filenameFromDisposition\(response\.headers\['content-disposition'\], documentFallbackName\(input\.format\)\)/);
  assert.match(api, /export type DocumentExportFormat = 'docx' \| 'pdf';/);
  // The editor's own HTML and the draft's title, through the mocked-above core.
  const hook = read('./use-draft-download.ts');
  assert.match(hook, /fetchDraftFile\(exportApi\.document, \{ title, html: editor\.getHTML\(\), format \}\)/);
  // One at a time, and the URL revoked on the next task with the timer cleared on unmount.
  assert.match(hook, /if \(!editor \|\| busyRef\.current\) return;/);
  assert.match(hook, /URL\.revokeObjectURL\(url\);\s*\}, 0\);/);
  assert.match(hook, /if \(revokeRef\.current !== null\) window\.clearTimeout\(revokeRef\.current\);\s*\},\s*\[\],/);
  const bar = read('./DraftSaveBar.tsx');
  assert.match(bar, /const downloads = useDraftDownload\(editor, title\);/);
});

test('on a computer, before the first save, a gold chevron holds Save as note, Word and PDF', () => {
  const bar = read('./DraftSaveBar.tsx');
  const control = bar.slice(bar.indexOf('export function DraftSaveControl'), bar.indexOf('function SavedNoteMenu'));
  // The chevron only before the first save; after it, the Saved chip and its ··· as before.
  assert.match(control, /\{saved \? \(\s*<SavedNoteMenu[\s\S]*?\/>\s*\) : \(\s*<SaveMoreMenu draft=\{draft\} \/>\s*\)\}/);
  assert.match(control, /saved \? 'rounded-\[9px\]' : 'rounded-l-\[9px\]',/);
  assert.match(control, /\{saved && !dirty \? \(\s*<span className="[^"]*bg-primary\/12[^"]*">\s*<Check aria-hidden className="size-\[15px\]" \/>\s*Saved\s*<\/span>/);
  // A failed download says why in the save failure's place.
  assert.match(control, /<p role="alert" className=\{FAILURE_BOX\}>\s*\{downloads\.failure\}\s*<\/p>/);
  const menu = bar.slice(bar.indexOf('function SaveMoreMenu'));
  assert.match(menu, /<DropdownMenuTrigger\s+aria-label="More ways to save"/);
  assert.match(menu, /rounded-r-\[9px\] bg-primary text-primary-foreground/);
  assert.match(menu, /\{downloading \? \(\s*<Loader2 /);
  assert.match(menu, /<DropdownMenuContent align="end" className=\{DRAFT_MENU\}>/);
  const order = ['Save as note', 'Download Word', '.docx', 'Download PDF', '.pdf'];
  let at = -1;
  for (const word of order) {
    const next = menu.indexOf(word, at + 1);
    assert.ok(next > at, word);
    at = next;
  }
  assert.match(menu, /onSelect=\{draft\.press\}>\s*<NotebookPen aria-hidden className="size-4 text-foreground\/62" \/>/);
  assert.match(menu, /onSelect=\{\(\) => void download\('docx'\)\}>\s*<Download aria-hidden className="size-4 text-foreground\/62" \/>/);
  assert.match(menu, /onSelect=\{\(\) => void download\('pdf'\)\}>\s*<Download aria-hidden className="size-4 text-foreground\/62" \/>/);
  // The saved note's ··· menu is unchanged.
  const saved = bar.slice(bar.indexOf('function SavedNoteMenu'), bar.indexOf('export function DraftFolderPicker'));
  assert.match(saved, /aria-label="Saved note"/);
  assert.match(saved, /Export Word\s*<DropdownMenuShortcut>\.docx<\/DropdownMenuShortcut>/);
});

test('on the phone sheet, before the first save, the foot has Download Word and Download PDF', () => {
  const bar = read('./DraftSaveBar.tsx');
  const foot = bar.slice(bar.indexOf('export function DraftSaveBar'), bar.indexOf('export function DraftSaveControl'));
  assert.match(
    foot,
    /\) : \(\s*<>\s*<DownloadPill downloads=\{draft\.downloads\} format="docx" label="Download Word" \/>\s*<DownloadPill downloads=\{draft\.downloads\} format="pdf" label="Download PDF" \/>\s*<\/>\s*\)\}/,
  );
  // Once saved, the foot is as before: Open note, Export and Save to folder.
  assert.match(foot, /\{saved \? \(\s*<>\s*<Link href=\{`\/notes\/\$\{saved\.slug\}`\}/);
  assert.match(foot, /<p role="alert" className="mt-2 text-xs text-destructive">\s*\{draft\.downloads\.failure\}/);
  const pill = bar.slice(bar.indexOf('function DownloadPill'));
  assert.match(pill, /className=\{cn\(ACTION_PILL, FOCUS_RING\)\}/);
  assert.match(pill, /\{downloads\.downloading === format \? \(\s*<Loader2 /);
});

test('the route’s 422 is shown in its own words; a guest is asked to sign in (backend 2390231a)', async () => {
  const input: DraftFileInput = { title: 'TEST DATA Draft', html: '<p>TEST DATA</p>', format: 'pdf' };
  const tooLarge = 'The document is too large to download. It can be at most 2 MB.';
  // The request asks for a file, so the error body is a Blob holding the JSON.
  const blob = new Blob([JSON.stringify({ message: 'The given data was invalid.', errors: { html: [tooLarge] } })], { type: 'application/json' });
  const refused = await fetchDraftFile(() => Promise.reject({ response: { status: 422, data: blob } }), input);
  assert.deepEqual(refused, { ok: false, failure: tooLarge });
  const empty = 'There is nothing in the document to download.';
  const plain = await fetchDraftFile(() => Promise.reject({ response: { status: 422, data: { errors: { html: [empty] } } } }), input);
  assert.deepEqual(plain, { ok: false, failure: empty });
  // A 422 with no readable reason falls back to the retry sentence.
  const unreadable = await fetchDraftFile(() => Promise.reject({ response: { status: 422, data: 'not json' } }), input);
  assert.deepEqual(unreadable, { ok: false, failure: "Couldn't download the draft. Try again." });
  assert.equal(downloadFailureSentence({ response: { status: 403 } }), 'Sign in to download this draft.');
});
