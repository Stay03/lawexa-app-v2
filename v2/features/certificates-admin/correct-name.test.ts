import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PRINTED_NAME_MAX,
  correctedNameProblem,
  printedNameErrorOf,
  withCorrectedCertificate,
  type PageOf,
} from '@/lib/certificates/model';

/* "Correct name" on an issued certificate (Stay, 16 November 2026, thread cc930a51; Backend b6a83af4). The admin
 * list lives outside v2, so the rules are pinned here, where the suite runs. TEST DATA. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
type Row = { uuid?: string; number: string; printed_name: string };
const page = (items: Row[]): PageOf<Row> => ({ items, page: 1, lastPage: 1, total: items.length });

test('a name is checked as the server checks it, in the server’s words', () => {
  assert.equal(correctedNameProblem('TEST DATA Rasheed Qozeem Adebayo'), null);
  assert.equal(correctedNameProblem('   '), 'Type the name as it should appear on the certificate.');
  assert.equal(correctedNameProblem(''), 'Type the name as it should appear on the certificate.');
  assert.equal(correctedNameProblem('x'.repeat(PRINTED_NAME_MAX)), null);
  assert.equal(correctedNameProblem('x'.repeat(PRINTED_NAME_MAX + 1)), 'The name can be at most 120 characters.');
  assert.equal(correctedNameProblem(`  ${'x'.repeat(PRINTED_NAME_MAX)}  `), null, 'spaces round the name are not counted');
});

test('a 422 shows the name field’s sentence; anything else falls back to the message', () => {
  assert.equal(printedNameErrorOf({ printed_name: ['The name can be at most 120 characters.'] }), 'The name can be at most 120 characters.');
  assert.equal(printedNameErrorOf({ other: ['x'] }), null);
  assert.equal(printedNameErrorOf(null), null);
});

test('the corrected certificate replaces its row in place; other rows and pages are untouched', () => {
  const before = page([
    { uuid: 'a', number: 'LX-2026-000086-F6DMV', printed_name: 'TEST DATA Rasheed Qozeem' },
    { uuid: 'b', number: 'LX-2026-000087-AAAAA', printed_name: 'TEST DATA Kemi Ojo' },
  ]);
  const corrected = { uuid: 'a', number: 'LX-2026-000086-F6DMV', printed_name: 'TEST DATA Rasheed Qozeem Adebayo' };
  const after = withCorrectedCertificate(before, corrected);
  assert.deepEqual(after?.items.map((row) => row.printed_name), ['TEST DATA Rasheed Qozeem Adebayo', 'TEST DATA Kemi Ojo']);
  assert.equal(after?.items[0].number, 'LX-2026-000086-F6DMV', 'the number stays');
  const otherPage = page([{ uuid: 'c', number: 'LX-2026-000099-CCCCC', printed_name: 'TEST DATA Bisi' }]);
  assert.equal(withCorrectedCertificate(otherPage, corrected), otherPage, 'a page without the row is the same object');
  assert.equal(withCorrectedCertificate(undefined, corrected), undefined);
});

test('the wiring: one PUT, a button on each row with a uuid, the dialog says what stays and that no email goes out', () => {
  const api = read('lib', 'api', 'certificates.ts');
  assert.match(api, /apiClient\.put<ApiResponse<IssuedCertificate>>\(\s*`\/admin\/certificates\/\$\{enc\(certificateUuid\)\}\/printed-name`,\s*\{ printed_name: printedName\.trim\(\) \},/);
  const hook = read('lib', 'hooks', 'useAdminCertificates.ts');
  assert.match(hook, /queryKey: \[\.\.\.certificateKeys\.programme\(programmeUuid\), 'certificates'\][\s\S]{0,120}withCorrectedCertificate\(page, certificate\)/);
  // Any failure but a 422 may have saved part of the change: the list is fetched again.
  assert.match(hook, /onError: \(failure\) => \{\s*if \(extractApiError\(failure\)\.status === 422\) return;\s*return queryClient\.invalidateQueries\(\{ queryKey: \[\.\.\.certificateKeys\.programme\(programmeUuid\), 'certificates'\] \}\);/);
  const list = read('components', 'admin', 'certificates', 'ProgrammeCertificates.tsx');
  assert.match(list, /\{certificate\.uuid \? \(\s*<Button[\s\S]{0,600}?Correct name\s*<\/Button>/);
  // The spoken name starts with the visible text, so voice control finds it (WCAG 2.5.3).
  assert.match(list, /aria-label=\{`Correct name on certificate \$\{certificate\.number\}`\}/);
  const dialog = read('components', 'admin', 'certificates', 'CorrectCertificateNameDialog.tsx');
  assert.match(dialog, /The PDF is drawn again\s+with the new name\. The number and verify link stay the same, and no email goes out\./);
  assert.match(dialog, /setError\(printedNameErrorOf\(apiError\.errors\) \?\? apiError\.message\);/);
  assert.match(dialog, /<p id=\{errorId\} role="alert" className="text-sm text-destructive">/);
});
