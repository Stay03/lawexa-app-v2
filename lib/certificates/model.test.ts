import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bracketProblem,
  bySort,
  DEFAULT_CERTIFICATE_BODY,
  certificateFileName,
  certificateImageProblem,
  certificateVerifyPath,
  formatCertificateDate,
  formatCertificateScore,
  isHexColor,
  issueSummary,
  listItems,
  moveBySort,
  normalizeCertificateNumber,
  pageOf,
  programmeFormProblems,
  programmePayload,
  readCertificateVerification,
  readIssueResult,
  templateFormProblems,
  unknownFillIns,
  verificationOutcome,
} from './model';

const verified = {
  number: 'LX-2026-000123-K7Q9M',
  printed_name: 'Test Student',
  programme: 'The Future of Legal Research Is Here',
  partner_name: 'LASU Law Students’ Society',
  event_date: '2026-11-15',
  issued_at: '2026-11-15T18:00:00+00:00',
  valid: true,
  logos: [
    { label: 'Lawexa', url: 'https://api.test/api/certificate-logos/a' },
    { label: 'LASU LSS', url: 'https://api.test/api/certificate-logos/b' },
  ],
};

test('a typed number becomes the stored one; junk never reaches the server', () => {
  assert.equal(normalizeCertificateNumber('lx-2026-000123-k7q9m'), 'LX-2026-000123-K7Q9M');
  assert.equal(normalizeCertificateNumber(' LX-2026-000123-K7Q9M '), 'LX-2026-000123-K7Q9M');
  assert.equal(normalizeCertificateNumber('LX 2026 000123'), 'LX2026000123');
  assert.equal(normalizeCertificateNumber(''), null);
  assert.equal(normalizeCertificateNumber('   '), null);
  assert.equal(normalizeCertificateNumber('LX-2026-../../admin'), null);
  assert.equal(normalizeCertificateNumber('LX--2026'), null);
  assert.equal(normalizeCertificateNumber('-LX-2026'), null);
  assert.equal(normalizeCertificateNumber('A'.repeat(41)), null);
  assert.equal(normalizeCertificateNumber(null), null);
  assert.equal(normalizeCertificateNumber(undefined), null);
});

test('paths and file names carry the number safely', () => {
  assert.equal(certificateVerifyPath('LX-2026-000123-K7Q9M'), '/verify/LX-2026-000123-K7Q9M');
  assert.equal(certificateVerifyPath('A/B'), '/verify/A%2FB');
  assert.equal(certificateFileName('LX-2026-000123-K7Q9M'), 'lawexa-certificate-LX-2026-000123-K7Q9M.pdf');
});

test('dates are absolute, and unreadable ones print nothing', () => {
  assert.equal(formatCertificateDate('2026-11-15'), '15 November 2026');
  assert.equal(formatCertificateDate('2026-11-15T18:00:00+00:00').endsWith('November 2026'), true);
  assert.equal(formatCertificateDate('not a date'), '');
  assert.equal(formatCertificateDate(null), '');
});

test('scores print as a percentage, and a missing one prints nothing', () => {
  assert.equal(formatCertificateScore(80), '80%');
  assert.equal(formatCertificateScore(66.666), '66.7%');
  assert.equal(formatCertificateScore(0), '0%');
  assert.equal(formatCertificateScore(null), '');
  assert.equal(formatCertificateScore(Number.NaN), '');
});

test('the form flags fill-ins the server will not replace', () => {
  assert.deepEqual(unknownFillIns('This certifies that {name} took part in {programme} with {partner} on {date}, scoring {score}.'), []);
  assert.deepEqual(unknownFillIns('{nmae} and {Name} and {nmae}'), ['{nmae}', '{Name}']);
  assert.deepEqual(unknownFillIns('{}'), ['{}']);
  assert.deepEqual(unknownFillIns('No fill-ins at all'), []);
  assert.deepEqual(unknownFillIns(DEFAULT_CERTIFICATE_BODY), [], 'square brackets are allowed');
});

test('optional clauses in square brackets must be closed and not nested', () => {
  assert.equal(bracketProblem(DEFAULT_CERTIFICATE_BODY), null);
  assert.equal(bracketProblem('No clauses'), null);
  assert.equal(bracketProblem('a [b] c [d]'), null);
  assert.match(bracketProblem('a [b c') ?? '', /never closed/);
  assert.match(bracketProblem('a b] c') ?? '', /without a \[/);
  assert.match(bracketProblem('a [b [c]]') ?? '', /inside another/);
});

test('colours must be hex', () => {
  assert.equal(isHexColor('#1f2a44'), true);
  assert.equal(isHexColor('#ABCDEF'), true);
  assert.equal(isHexColor('#FFF'), false, 'the server takes six digits only');
  assert.equal(isHexColor(' #ffffff '), false);
  assert.equal(isHexColor('red'), false);
  assert.equal(isHexColor('#12345'), false);
  assert.equal(isHexColor('1f2a44'), false);
});

test('logos and signatories keep the server order, and moving renumbers from 0', () => {
  const items = [
    { uuid: 'b', sort: 5 },
    { uuid: 'a', sort: 1 },
    { uuid: 'c', sort: 9 },
  ];
  assert.deepEqual(bySort(items).map((item) => item.uuid), ['a', 'b', 'c']);
  assert.deepEqual(items.map((item) => item.uuid), ['b', 'a', 'c'], 'the input is untouched');

  assert.deepEqual(moveBySort(items, 'c', -1), [
    { uuid: 'a', sort: 0 },
    { uuid: 'c', sort: 1 },
    { uuid: 'b', sort: 2 },
  ]);
  assert.deepEqual(moveBySort(items, 'a', -1).map((item) => [item.uuid, item.sort]), [
    ['a', 0],
    ['b', 1],
    ['c', 2],
  ]);
  assert.deepEqual(moveBySort(items, 'missing', 1).map((item) => item.uuid), ['a', 'b', 'c']);
});

test('only PNG, JPG or SVG up to 2 MB can be uploaded', () => {
  assert.equal(certificateImageProblem({ type: 'image/png', size: 1000 }), null);
  assert.equal(certificateImageProblem({ type: 'image/svg+xml', size: 2 * 1024 * 1024 }), null);
  assert.match(certificateImageProblem({ type: 'image/png', size: 2 * 1024 * 1024 + 1 }) ?? '', /2 MB/);
  assert.match(certificateImageProblem({ type: 'image/gif', size: 10 }) ?? '', /PNG, JPG or SVG/);
  assert.equal(certificateImageProblem({ type: 'image/jpeg', size: 10 }, 'signature'), null);
  assert.match(certificateImageProblem({ type: 'image/svg+xml', size: 10 }, 'signature') ?? '', /PNG or JPG/);
  assert.match(certificateImageProblem({ type: 'image/png', size: 3 * 1024 * 1024 }, 'signature') ?? '', /2 MB/);
});

test('the verify answer is read field by field', () => {
  assert.deepEqual(readCertificateVerification({ success: true, data: verified }), verified);
  assert.equal(readCertificateVerification({ data: { ...verified, valid: 'yes' } }), null);
  assert.equal(readCertificateVerification({ data: { ...verified, number: undefined } }), null);
  assert.equal(readCertificateVerification({ data: null }), null);
  assert.equal(readCertificateVerification('nope'), null);

  const lenient = readCertificateVerification({
    data: { ...verified, partner_name: '', logos: [{ label: 'Lawexa', url: '' }, 'x', { label: 'LSS', url: 'https://u' }] },
  });
  assert.equal(lenient?.partner_name, null);
  assert.deepEqual(lenient?.logos, [{ label: 'LSS', url: 'https://u' }]);
  assert.deepEqual(readCertificateVerification({ data: { ...verified, logos: undefined } })?.logos, []);
});

test('the answer never carries more than the agreed fields, so an email cannot leak through', () => {
  const read = readCertificateVerification({ data: { ...verified, email: 'student@example.test' } });
  assert.equal(read !== null && 'email' in read, false);
});

test('only a 404 says "no such certificate"; other failures say the check failed', () => {
  assert.deepEqual(verificationOutcome(404, null), { kind: 'not_found' });
  assert.deepEqual(verificationOutcome(429, null), { kind: 'unavailable' });
  assert.deepEqual(verificationOutcome(500, { message: 'boom' }), { kind: 'unavailable' });
  assert.deepEqual(verificationOutcome(200, { data: {} }), { kind: 'unavailable' });
  assert.deepEqual(verificationOutcome(200, { data: verified }), { kind: 'found', certificate: verified });
  assert.deepEqual(verificationOutcome(200, { data: { ...verified, valid: false } }), {
    kind: 'found',
    certificate: { ...verified, valid: false },
  });
});

test('lists read the same whether the server sends an array or a page', () => {
  assert.deepEqual(listItems([{ uuid: 'a' }]), [{ uuid: 'a' }]);
  assert.deepEqual(listItems({ items: [{ uuid: 'b' }], meta: {} }), [{ uuid: 'b' }]);
  assert.deepEqual(listItems(null), []);
  assert.deepEqual(listItems({ data: [] }), []);

  assert.deepEqual(
    pageOf({ success: true, data: [1, 2], pagination: { current_page: 2, last_page: 3, total: 27, per_page: 2 } }),
    { items: [1, 2], page: 2, lastPage: 3, total: 27 },
    'the house paginated() body',
  );
  assert.deepEqual(pageOf({ data: { items: [1, 2], meta: { current_page: 2, last_page: 3, total: 27 } } }), {
    items: [1, 2],
    page: 2,
    lastPage: 3,
    total: 27,
  });
  assert.deepEqual(pageOf({ data: [1, 2, 3] }), { items: [1, 2, 3], page: 1, lastPage: 1, total: 3 });
  assert.deepEqual(pageOf(undefined), { items: [], page: 1, lastPage: 1, total: 0 });
});

test('a template saves only with a name, title, wording and six-digit colours', () => {
  const good = {
    name: 'LASU LSS 2026',
    title: 'Certificate of Participation',
    body: 'This certifies that {name} took part in {programme}.',
    colors: { primary: '#1f2a44', accent: '#b08d57', background: '#ffffff' },
  };
  assert.deepEqual(templateFormProblems(good), {});
  const bad = templateFormProblems({ ...good, name: ' ', title: '', body: '', colors: { ...good.colors, accent: '#fff' } });
  assert.deepEqual(Object.keys(bad).sort(), ['body', 'colors.accent', 'name', 'title']);
  assert.match(templateFormProblems({ ...good, body: 'x'.repeat(5001) }).body ?? '', /5,000/);
});

test('a programme needs a name, a design and a date; a blank partner is sent as null', () => {
  const values = { name: ' The Future of Legal Research ', templateUuid: 't-1', partnerName: '  ', eventDate: '2026-11-15', isActive: true };
  assert.deepEqual(programmeFormProblems(values), {});
  assert.deepEqual(programmePayload(values), {
    name: 'The Future of Legal Research',
    template_uuid: 't-1',
    partner_name: null,
    event_date: '2026-11-15',
    is_active: true,
  });
  assert.deepEqual(
    Object.keys(programmeFormProblems({ ...values, name: '', templateUuid: '', eventDate: '15/11/2026' })).sort(),
    ['eventDate', 'name', 'templateUuid'],
  );
});

test('the issue result keeps new, already-had and skipped apart', () => {
  const read = readIssueResult({
    issued: [{ number: 'A' }],
    already_had: [{ number: 'B' }, { number: 'C' }],
    skipped: [{ uuid: 'u1', reason: 'Guest accounts cannot receive certificates.' }, { uuid: 'u2', reason: 'No name on account.' }, 'x', { reason: 'no uuid' }],
  });
  assert.equal(read.issued.length, 1);
  assert.equal(read.already_had.length, 2);
  assert.deepEqual(read.skipped.map((entry) => entry.uuid), ['u1', 'u2']);
  assert.deepEqual(readIssueResult(null), { issued: [], already_had: [], skipped: [] });

  assert.equal(issueSummary(readIssueResult({ issued: [1] })), '1 certificate issued.');
  assert.equal(
    issueSummary(read),
    '1 certificate issued. 2 already had one and keep theirs. 2 skipped: Guest accounts cannot receive certificates; No name on account.',
  );
  assert.equal(
    issueSummary(readIssueResult({ already_had: [1], skipped: [{ uuid: 'a', reason: 'No name on account.' }, { uuid: 'b', reason: 'No name on account.' }] })),
    '0 certificates issued. 1 already had one and keeps it. 2 skipped: No name on account.',
  );
});
