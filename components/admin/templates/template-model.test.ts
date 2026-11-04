import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  anyProcessing,
  approveBlocker,
  approveInRounds,
  batchesFor,
  blankSegments,
  bulkApproveMessage,
  bulkApprovePayload,
  canTick,
  blanksIn,
  blanksLabel,
  changedFields,
  fieldsOf,
  folderAreas,
  foldersLabel,
  folderPathOf,
  NO_SELECTION,
  selectedCount,
  toggleDraft,
  togglePage,
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

test("each file's folders, the top folder included, are its practice area", () => {
  // The server matches from the nearest name up: Leases inside Property becomes Property,
  // and a top folder that is no practice area ("Library") is passed over.
  assert.equal(folderPathOf('Library/Property/Leases/TEST DATA lease.docx'), 'Library / Property / Leases');
  // Arthur picks the Property folder itself: its own files keep the area.
  assert.equal(folderPathOf('Property/TEST DATA lease.docx'), 'Property');
  assert.equal(folderPathOf('Property/Leases/TEST DATA lease.docx'), 'Property / Leases');
  // Dropped loose, not in a folder.
  assert.equal(folderPathOf('TEST DATA lease.docx'), null);
  // Names trimmed, a blank one left out.
  assert.equal(folderPathOf(' Property /   /Leases/TEST DATA deed.pdf'), 'Property / Leases');
  // Within the server's 255 characters: the folders farthest from the file go first.
  const deep = `Library/${'A'.repeat(200)}/${'B'.repeat(100)}/Leases/TEST DATA deed.pdf`;
  assert.equal(folderPathOf(deep), `${'B'.repeat(100)} / Leases`);
  assert.equal(folderPathOf(`${'P'.repeat(300)}/TEST DATA deed.pdf`), 'P'.repeat(255));

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
    [['Library', 1], ['Library / Property', 20], ['Library / Property', 5], ['Library / Corporate', 1], ['Library / Property / Leases', 1]],
  );
  assert.deepEqual(folderAreas(found), ['Library', 'Library / Property', 'Library / Corporate', 'Library / Property / Leases']);
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
  assert.deepEqual(areas, ['Library', 'Library', 'Library']);
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

/* Bulk approve (Arthur, thread 2b658111, 4 November 2026: 300 drafts,
 * approved in one go, not one by one). */

test('only drafts can be ticked; a reading, failed or live template has no box', () => {
  assert.equal(canTick({ status: 'draft' }), true);
  for (const status of ['processing', 'failed', 'live'] as const) assert.equal(canTick({ status }), false);
});

test('ticks, the page box and "Select all drafts" make the selection the button approves', () => {
  const page = ['a', 'b', 'c'];
  let selection = toggleDraft(NO_SELECTION, 'a', page);
  assert.equal(selectedCount(selection, 300), 1);
  selection = togglePage(selection, page);
  assert.equal(selectedCount(selection, 300), 3);
  // All on: the page box clears them.
  selection = togglePage(selection, page);
  assert.equal(selectedCount(selection, 300), 0);
  // Every draft under the filters, on every page: counted from the server's total.
  assert.equal(selectedCount({ kind: 'all' }, 300), 300);
  // Unticking one with all selected keeps the rest of this page ticked.
  const after = toggleDraft({ kind: 'all' }, 'b', page);
  assert.deepEqual(after.kind === 'some' ? [...after.uuids].sort() : [], ['a', 'c']);
});

test('the server gets the ticked uuids, or every draft under the current filters', () => {
  assert.deepEqual(bulkApprovePayload({ kind: 'some', uuids: new Set(['a', 'b']) }, { practice_area: 'Property' }), { uuids: ['a', 'b'] });
  assert.deepEqual(bulkApprovePayload({ kind: 'all' }, { practice_area: 'Property', search: '', country_id: 160 }), {
    all_drafts: true,
    practice_area: 'Property',
    country_id: 160,
  });
});

test('the result says how many went live and why the rest were skipped', () => {
  assert.deepEqual(bulkApproveMessage({ approved: 12, skipped: [] }), { title: '12 templates are live.', detail: null });
  assert.deepEqual(bulkApproveMessage({ approved: ['x'], skipped: [] }), { title: '1 template is live.', detail: null });
  assert.deepEqual(
    bulkApproveMessage({
      approved: 9,
      skipped: [
        { uuid: 'a', code: 'missing_name_or_text', reason: 'A template needs a name and its text before it can go live.' },
        { uuid: 'b', code: 'missing_name_or_text', reason: 'A template needs a name and its text before it can go live.' },
        { uuid: 'c', code: 'not_found', reason: 'No template with this id.' },
        { uuid: 'd', code: 'something_new', reason: 'It is locked by another admin.' },
      ],
    }),
    { title: '9 approved, 4 skipped', detail: '2 missing a name or text; 1 deleted; 1: It is locked by another admin' },
  );
  // Before Backend sends codes: grouped by its sentence.
  assert.deepEqual(
    bulkApproveMessage({ approved: 1, skipped: [{ uuid: 'a', reason: 'Only a draft can be approved.' }, { uuid: 'b', reason: 'Only a draft can be approved.' }] }),
    { title: '1 approved, 2 skipped', detail: '2: Only a draft can be approved' },
  );
});

test('"Select all drafts" calls again while drafts go live and some remain, never on remaining alone', async () => {
  // 812 drafts, 500 a call; 2 have no name and stay drafts for good.
  const answers = [
    { approved: 500, skipped: [{ uuid: 'n1', code: 'missing_name_or_text', reason: 'x' }], remaining: 312 },
    { approved: 310, skipped: [{ uuid: 'n1', code: 'missing_name_or_text', reason: 'x' }, { uuid: 'n2', code: 'missing_name_or_text', reason: 'x' }], remaining: 2 },
    { approved: 0, skipped: [{ uuid: 'n1', code: 'missing_name_or_text', reason: 'x' }, { uuid: 'n2', code: 'missing_name_or_text', reason: 'x' }], remaining: 2 },
  ];
  let calls = 0;
  const progress: number[] = [];
  const result = await approveInRounds({ all_drafts: true }, async () => answers[calls++], (n) => progress.push(n));
  // The third call approved none: it stops though 2 remain.
  assert.equal(calls, 3);
  assert.deepEqual(progress, [500, 810, 810]);
  assert.equal(result.approved, 810);
  // A draft skipped in two rounds is counted once.
  assert.deepEqual(result.skipped.map((item) => item.uuid), ['n1', 'n2']);
  assert.deepEqual(bulkApproveMessage(result), { title: '810 approved, 2 skipped', detail: '2 missing a name or text' });
});

test('ticked drafts go in one call, whatever remains', async () => {
  let calls = 0;
  const result = await approveInRounds({ uuids: ['a', 'b'] }, async () => {
    calls += 1;
    return { approved: 2, skipped: [], remaining: 40 };
  }, () => {});
  assert.equal(calls, 1);
  assert.equal(result.approved, 2);
});
