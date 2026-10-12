import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatFileSize } from '@/lib/utils/format-bytes';
import { formatFileSize as adminFormatFileSize } from '@/lib/validations/admin-cases';
import { importGraph } from '@/scripts/test/import-graph';

/* The chat route does not download the form libraries (speed step 1,
 * 12 October 2026). Two paths used to bring zod in: the sent-attachment row's
 * size label, imported from a validation module, and the lawyer card's
 * "Connect with" form, which every answer renderer imports. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const FORM_PACKAGES = new Set(['zod', 'react-hook-form', '@hookform/resolvers/zod']);

test('nothing the chat route imports statically reaches zod or the form library', () => {
  const graph = importGraph('app/v2/c/[conversationId]/page.tsx', 'app/v2/c/[conversationId]/loading.tsx');
  assert.deepEqual(
    graph.packages.filter(({ specifier }) => FORM_PACKAGES.has(specifier)),
    [],
  );
});

test('the sent-attachment row takes its size label from the zod-free formatter', () => {
  const source = read('v2', 'features', 'conversations', 'conversation', 'rows', 'SentAttachments.tsx');
  assert.doesNotMatch(source, /lib\/validations/);
  assert.match(source, /import \{ formatFileSize \} from '@\/lib\/utils\/format-bytes';/);
});

test('the size label reads as it did, and the old export is the same function', () => {
  assert.equal(formatFileSize(0), '0 Bytes');
  assert.equal(formatFileSize(512), '512 Bytes');
  assert.equal(formatFileSize(1500), '1.46 KB');
  assert.equal(formatFileSize(5 * 1024 * 1024), '5 MB');
  assert.equal(adminFormatFileSize, formatFileSize);
});

test('the lawyer card loads its connection form only when it is opened', () => {
  const card = read('v2', 'features', 'conversations', 'conversation', 'cards', 'LawyerCard.tsx');
  assert.doesNotMatch(card, /import \{ ConnectionRequestDialog \}/);
  assert.match(card, /const loadConnectionRequestDialog = \(\) => import\('\.\/ConnectionRequestDialog'\);/);
  assert.match(card, /\{dialogMounted \? \(/);
  const parser = read('lib', 'utils', 'parse-content-xml.ts');
  assert.match(parser, /import type \{ LawyerInfo \} from '@\/components\/chat\/lawyer-card';/);
});
