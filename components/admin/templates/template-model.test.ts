import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  anyProcessing,
  approveBlocker,
  batchesFor,
  blankSegments,
  blanksIn,
  blanksLabel,
  changedFields,
  fieldsOf,
  folderAreas,
  foldersLabel,
  nearestSubfolder,
  precheckUpload,
  refusalSentence,
  sortFolderFiles,
  uploadInBatches,
  type BatchProgress,
} from './template-model';

/* The admin templates page (Stay's go 4 November 2026, thread 2b658111):
 * what an upload sends, the blanks, the approve rule, and polling. */

const MB = 1024 * 1024;
const file = (name: string, size = MB) => ({ name, size });

test('an upload sends Word, RTF and PDF files up to 20 MB, at most 20 at a time', () => {
  const files = [file('TEST DATA lease.docx'), file('memo.DOC'), file('notice.rtf'), file('deed.pdf'), file('photo.png'), file('huge.pdf', 21 * MB)];
  const { send, refused } = precheckUpload(files);
  assert.deepEqual(send.map((f) => f.name), ['TEST DATA lease.docx', 'memo.DOC', 'notice.rtf', 'deed.pdf']);
  assert.deepEqual(refused, [
    { name: 'photo.png', reason: 'type' },
    { name: 'huge.pdf', reason: 'size' },
  ]);
  // The 21st good file waits for the next batch.
  const many = Array.from({ length: 21 }, (_, i) => file(`f${i}.pdf`));
  const batch = precheckUpload(many);
  assert.equal(batch.send.length, 20);
  assert.deepEqual(batch.refused, [{ name: 'f20.pdf', reason: 'count' }]);
  assert.match(refusalSentence('duplicate'), /already a template/);
  assert.match(refusalSentence('count'), /20 files/);
});

test('blanks are capital words in square brackets; citations and references are not', () => {
  const text = "This lease between [PARTY A] and [PARTY B] starts on [DATE].\n\nRent is [AMOUNT], as in Smith v Jones [2020] 1 NWLR, under [s. 3]. Notice goes to [PARTY A'S ADDRESS]. Again [PARTY A].";
  assert.deepEqual(blanksIn(text), ['[PARTY A]', '[PARTY B]', '[DATE]', '[AMOUNT]', "[PARTY A'S ADDRESS]"]);
  const segments = blankSegments('Pay [AMOUNT] by [DATE].');
  assert.deepEqual(segments, [
    { text: 'Pay ', blank: false },
    { text: '[AMOUNT]', blank: true },
    { text: ' by ', blank: false },
    { text: '[DATE]', blank: true },
    { text: '.', blank: false },
  ]);
  assert.deepEqual(blankSegments('No blanks [2020].'), [{ text: 'No blanks [2020].', blank: false }]);
  assert.equal(blanksLabel(0), 'No blanks');
  assert.equal(blanksLabel(1), '1 blank');
  assert.equal(blanksLabel(4), '4 blanks');
});

test('only the changed fields are saved, and an emptied label is none', () => {
  const saved = fieldsOf({ name: 'Tenancy agreement', practice_area: 'Property', document_type: 'Agreement', country: { id: 160, name: 'Nigeria' }, text: 'A [PARTY A]' });
  assert.deepEqual(changedFields(saved, saved), {});
  assert.deepEqual(changedFields(saved, { ...saved, practice_area: '  ', text: 'A [PARTY A] and [PARTY B]' }), {
    practice_area: null,
    text: 'A [PARTY A] and [PARTY B]',
  });
  assert.deepEqual(changedFields(saved, { ...saved, name: ' Lease ', country_id: null }), { name: 'Lease', country_id: null });
  assert.deepEqual(fieldsOf({ name: 'x', practice_area: null, document_type: null, country: null, text: '' }), {
    name: 'x',
    practice_area: '',
    document_type: '',
    country_id: null,
    text: '',
  });
});

test('a draft goes live with a name and a text; reading or failed ones say why not', () => {
  assert.equal(approveBlocker('draft', { name: 'Lease', text: 'A [PARTY A]' }), null);
  assert.match(approveBlocker('draft', { name: ' ', text: 'x' }) ?? '', /name/);
  assert.match(approveBlocker('draft', { name: 'Lease', text: '\n' }) ?? '', /no text/);
  assert.match(approveBlocker('processing', { name: 'Lease', text: 'x' }) ?? '', /still reading/);
  assert.match(approveBlocker('failed', { name: 'Lease', text: 'x' }) ?? '', /Try again/);
});

test('the list keeps asking while any template is being read', () => {
  assert.equal(anyProcessing([{ status: 'draft' }, { status: 'processing' }]), true);
  assert.equal(anyProcessing([{ status: 'draft' }, { status: 'live' }, { status: 'failed' }]), false);
  assert.equal(anyProcessing([]), false);
});

/* A folder upload (Arthur, 4 November 2026: over 300 templates in folders
 * with subfolders, in one go). */

const at = (path: string, size = MB) => ({ file: file(path.slice(path.lastIndexOf('/') + 1), size), path });

test('a folder upload takes every Word, RTF and PDF file in its subfolders; the rest is skipped and counted', () => {
  const sorted = sortFolderFiles([
    at('Library/TEST DATA lease.docx'),
    at('Library/Property/TEST DATA deed.pdf'),
    at('Library/Property/Leases/TEST DATA tenancy.DOC'),
    at('Library/Corporate/TEST DATA resolution.rtf'),
    at('Library/Corporate/notes.txt'),
    at('Library/Corporate/logo.png'),
    // Word's lock file beside an open document, and a hidden file.
    at('Library/Property/~$TEST DATA deed.docx', 162),
    at('Library/.DS_Store', 6),
    at('Library/Property/TEST DATA scan.pdf', 25 * MB),
  ]);
  assert.deepEqual(sorted.take.map((f) => f.file.name), ['TEST DATA lease.docx', 'TEST DATA deed.pdf', 'TEST DATA tenancy.DOC', 'TEST DATA resolution.rtf']);
  assert.equal(sorted.skipped, 4);
  // Too big is named, with where it sits.
  assert.deepEqual(sorted.tooBig, [{ name: 'Library/Property/TEST DATA scan.pdf', reason: 'size' }]);
  // The folders the taken files sit in: Library, Property, Leases, Corporate.
  assert.equal(sorted.folders, 4);
  assert.equal(foldersLabel(1), '1 folder');
  assert.equal(foldersLabel(4), '4 folders');
});

test("each subfolder's name is its files' practice area; the top folder's own files get none", () => {
  assert.equal(nearestSubfolder('Library/Property/Leases/TEST DATA lease.docx'), 'Leases');
  assert.equal(nearestSubfolder('Library/Corporate/TEST DATA resolution.rtf'), 'Corporate');
  assert.equal(nearestSubfolder('Library/TEST DATA lease.docx'), null);
  // Dropped loose, not in a folder.
  assert.equal(nearestSubfolder('TEST DATA lease.docx'), null);
  // Within the server's 100 characters, trimmed; a blank name is none.
  assert.equal(nearestSubfolder(`Library/  ${'P'.repeat(120)}/TEST DATA deed.pdf`), 'P'.repeat(100));
  assert.equal(nearestSubfolder('Library/   /TEST DATA deed.pdf'), null);

  const found = [
    at('Library/TEST DATA general.docx'),
    ...Array.from({ length: 25 }, (_, i) => at(`Library/Property/TEST DATA deed ${i}.pdf`)),
    at('Library/Corporate/TEST DATA resolution.rtf'),
    at('Library/Property/Leases/TEST DATA tenancy.docx'),
  ];
  const byFolder = batchesFor(found, true);
  // One subfolder per request, 20 at most: Property's 25 take two.
  assert.deepEqual(
    byFolder.map((batch) => [batch.practiceArea, batch.files.length]),
    [[null, 1], ['Property', 20], ['Property', 5], ['Corporate', 1], ['Leases', 1]],
  );
  assert.deepEqual(folderAreas(found), ['Property', 'Corporate', 'Leases']);
  // Switched off: in the order found, 20 to a request, none with a practice area.
  const plain = batchesFor(found, false);
  assert.deepEqual(plain.map((batch) => [batch.practiceArea, batch.files.length]), [[null, 20], [null, 8]]);
  assert.equal(plain[0].files[0].name, 'TEST DATA general.docx');
});

test('a folder goes 20 files to a request, one request after another, with progress after each', async () => {
  const files = Array.from({ length: 45 }, (_, i) => at(`Library/TEST DATA ${i}.docx`));
  const batches: string[][] = [];
  const areas: (string | null)[] = [];
  let inFlight = 0;
  let mostInFlight = 0;
  const seen: BatchProgress[] = [];
  const outcome = await uploadInBatches(
    batchesFor(files, true),
    async (batch, practiceArea) => {
      inFlight += 1;
      mostInFlight = Math.max(mostInFlight, inFlight);
      areas.push(practiceArea);
      batches.push(batch.map((f) => f.name));
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      // The server turns down the first file of each batch as already uploaded.
      return { created: batch.slice(1), refused: [{ original_name: batch[0].name, reason: 'duplicate' as const }] };
    },
    (progress) => seen.push(progress),
  );
  assert.deepEqual(batches.map((batch) => batch.length), [20, 20, 5]);
  assert.deepEqual(areas, [null, null, null]);
  assert.equal(mostInFlight, 1);
  assert.deepEqual(seen.map((progress) => progress.sent), [20, 40, 45]);
  assert.equal(outcome.stoppedAt, null);
  assert.equal(outcome.created, 42);
  assert.deepEqual(outcome.refused.map((item) => item.name), ['TEST DATA 0.docx', 'TEST DATA 20.docx', 'TEST DATA 40.docx']);
});

test('a failed request stops the folder there, and says where to pick up', async () => {
  const batches = batchesFor(Array.from({ length: 50 }, (_, i) => at(`Library/TEST DATA ${i}.docx`)), true);
  let calls = 0;
  const outcome = await uploadInBatches(
    batches,
    async (batch) => {
      calls += 1;
      if (calls === 2) throw new Error('offline');
      return { created: [...batch], refused: [] };
    },
    () => {},
  );
  assert.equal(calls, 2);
  // The second request is the first still to send.
  assert.equal(outcome.stoppedAt, 1);
  assert.equal(outcome.sent, 20);
  assert.equal(outcome.created, 20);
  assert.equal((outcome.error as Error).message, 'offline');
  assert.equal(batches.slice(outcome.stoppedAt ?? 0).reduce((sum, batch) => sum + batch.files.length, 0), 30);
});
