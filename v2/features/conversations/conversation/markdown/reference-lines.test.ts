import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkReferenceLines } from './reference-lines';

test('a reference line becomes the case name, linked, with no raw address', () => {
  assert.equal(
    linkReferenceLines('[1] Umoetuk v UBN PLC (2002) 3 NWLR (Pt. 755) 647 - https://lawexa.com/cases/umoetuk-v-ubn-plc'),
    '[1] [Umoetuk v UBN PLC (2002) 3 NWLR (Pt. 755) 647](https://lawexa.com/cases/umoetuk-v-ubn-plc)',
  );
});

test('every line of a list is handled, and other lines are left alone', () => {
  const input = [
    'References:',
    '[1] Haway v Mediowa (Nig.) Ltd (2000) 13 NWLR (Pt. 683) 77 - https://lawexa.com/cases/haway-v-mediowa-nig-ltd',
    '[2] Evidence Act 2011, s. 135 – https://lawexa.com/statutes/evidence-act-2011',
  ].join('\n');
  assert.equal(
    linkReferenceLines(input),
    [
      'References:',
      '[1] [Haway v Mediowa (Nig.) Ltd (2000) 13 NWLR (Pt. 683) 77](https://lawexa.com/cases/haway-v-mediowa-nig-ltd)',
      '[2] [Evidence Act 2011, s. 135](https://lawexa.com/statutes/evidence-act-2011)',
    ].join('\n'),
  );
});

test('square brackets inside the name are kept as text', () => {
  assert.equal(
    linkReferenceLines('[3] Ojo v State [2010] 5 NWLR 1 - https://lawexa.com/cases/ojo-v-state'),
    '[3] [Ojo v State \[2010\] 5 NWLR 1](https://lawexa.com/cases/ojo-v-state)',
  );
});

test('an address that is not Lawexa\'s, or a line of another shape, is not touched', () => {
  const other = '[1] Hadley v Baxendale (1854) - https://www.bailii.org/ew/cases/EWHC/Exch/1854/J70.html';
  assert.equal(linkReferenceLines(other), other);
  const prose = 'See https://lawexa.com/cases/umoetuk-v-ubn-plc for the full case.';
  assert.equal(linkReferenceLines(prose), prose);
});
