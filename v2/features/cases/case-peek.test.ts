import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { casePeekFor, rememberCasePeek } from './case-peek';
import type { CaseRowModel } from './case-row-model';

/* Speed step 4 (17 October 2026): a first open draws the tapped row's name at
 * once, before any request answers. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');

const ROW: CaseRowModel = {
  id: 9,
  slug: 'ada-v-obi',
  title: 'Ada v Obi',
  rawTitle: 'ADA V. OBI',
  citation: '(2020) LPELR-1',
  court: 'Court of Appeal',
  countryCode: 'NG',
  countryName: 'Nigeria',
  judgmentDate: '2020-03-04',
  holding: 'A holding.',
  tags: [],
  isBookmarked: false,
};

test('the tap keeps the row\'s own facts, for that case only', () => {
  rememberCasePeek(ROW);
  assert.deepEqual(casePeekFor('ada-v-obi'), {
    slug: 'ada-v-obi',
    title: 'Ada v Obi',
    rawTitle: 'ADA V. OBI',
    court: 'Court of Appeal',
    countryCode: 'NG',
    countryName: 'Nigeria',
    judgmentDate: '2020-03-04',
  });
  // Another case, or no case, draws the plain skeleton.
  assert.equal(casePeekFor('other-case'), null);
  assert.equal(casePeekFor(undefined), null);
  // One entry: the next tap replaces it.
  rememberCasePeek({ ...ROW, slug: 'next-case', title: 'Next v Case' });
  assert.equal(casePeekFor('ada-v-obi'), null);
  assert.equal(casePeekFor('next-case')?.title, 'Next v Case');
});

test('the row leaves its facts on the tap, and both waits draw them', () => {
  const row = read('list', 'CaseRow.tsx');
  assert.match(row, /onClick=\{\(\) => \{\s*rememberCasePeek\(row\);\s*intent\.onClick\(\);\s*\}\}/);
  const fallback = read('detail', 'CaseFallback.tsx');
  assert.match(fallback, /const peek = useCasePeek\(slugOf\(usePathname\(\)\)\);/);
  assert.match(fallback, /<CaseDocumentSkeleton masthead=\{peek \? <PeekMasthead peek=\{peek\} \/> : undefined\} \/>/);
  // The masthead's own classes and type, so the case arriving moves nothing.
  assert.match(fallback, /<p className="doc-kicker flex flex-wrap items-center gap-x-2 gap-y-1">/);
  assert.match(fallback, /<h1 className="doc-title text-foreground" title=\{peek\.rawTitle\}>/);
  assert.match(fallback, /import '\.\/case-masthead\.css';/);
  // Still no screen behind the loading boundary.
  assert.doesNotMatch(fallback, /from '\.\/Case(Screen|Document|Ask|ChatCore|ChatPanel)'/);
  // The screen's own wait is the same shape.
  const screen = read('detail', 'CaseScreen.tsx');
  assert.match(screen, /if \(query\.isPending\) return <CaseFallback \/>;/);
});

test('the kicker and the name do not fade when the case arrives under them', () => {
  const screen = read('detail', 'CaseScreen.tsx');
  assert.match(screen, /arrival === 'peeked'\s*\? 'v2-case-arrive-peeked'/);
  const css = read('detail', 'case-document.css');
  assert.match(css, /\.v2-case-arrive-peeked :where\(article > :not\(header\), article > header > :not\(\.doc-kicker, \.doc-title\)\)/);
  // The masthead's type lives in its own file, loaded by both.
  assert.match(read('detail', 'CaseDocument.tsx'), /import '\.\/case-masthead\.css';/);
  const masthead = read('detail', 'case-masthead.css');
  for (const rule of ['.v2-case-doc .doc-kicker', '.v2-case-doc .doc-title', '.v2-case-doc .doc-citation']) {
    assert.ok(masthead.includes(rule), rule);
    assert.ok(!css.includes(`${rule} {`), `${rule} is defined once`);
  }
});
