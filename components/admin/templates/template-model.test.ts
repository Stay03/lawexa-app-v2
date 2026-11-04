import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  anyProcessing,
  approveBlocker,
  blankSegments,
  blanksIn,
  blanksLabel,
  changedFields,
  fieldsOf,
  precheckUpload,
  refusalSentence,
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
