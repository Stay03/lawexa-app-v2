import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Statute } from '@/types/statute';
import { incompleteNotice, statuteSource } from './statute-source';

const statute = (fields: Partial<Statute>): Statute => fields as Statute;

test('no source recorded shows no badge, including a payload from before the fields existed', () => {
  assert.equal(statuteSource(statute({})), null);
  assert.equal(statuteSource(statute({ source_type: null, source_type_label: null })), null);
});

test("the API's label wins, with the source note under it", () => {
  assert.deepEqual(
    statuteSource(statute({
      source_type: 'official_gazette',
      source_type_label: 'Official Gazette',
      source_note: '  Lagos State Gazette No. 12, Vol. 45, 31 December 2012  ',
    })),
    { label: 'Official Gazette', note: 'Lagos State Gazette No. 12, Vol. 45, 31 December 2012', official: true },
  );
});

test('a type without a label still shows; an unofficial copy is marked as not official', () => {
  assert.deepEqual(statuteSource(statute({ source_type: 'unofficial_reproduction' })), {
    label: 'Unofficial reproduction',
    note: null,
    official: false,
  });
  assert.equal(statuteSource(statute({ source_type: 'law_report_copy' as never }))?.label, 'Law report copy');
});

test('the Incomplete notice shows only when the flag is set, with its note', () => {
  assert.equal(incompleteNotice(statute({})), null);
  assert.equal(incompleteNotice(statute({ incomplete_text: false, incomplete_note: 'stale' })), null);
  assert.equal(
    incompleteNotice(statute({ incomplete_text: true, incomplete_note: 'Forms 207 to 212 are not in this copy.' })),
    'Forms 207 to 212 are not in this copy.',
  );
  assert.equal(incompleteNotice(statute({ incomplete_text: true, incomplete_note: ' ' })), 'Part of this text is missing.');
});
