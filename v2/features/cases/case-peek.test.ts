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
  fullCitation: '(2020) LPELR-1; (2020) 4 NWLR (Pt. 1700) 1',
  topic: 'Tenancy',
  isVerified: true,
  bookmarksCount: 3,
  hasFullReport: true,
  outcome: 'appeal_dismissed',
  suitNo: 'CA/L/12/2019',
};

test('the tap keeps the row\'s own facts, for that case only', () => {
  rememberCasePeek(ROW);
  assert.deepEqual(casePeekFor('ada-v-obi'), {
    id: 9,
    slug: 'ada-v-obi',
    title: 'Ada v Obi',
    rawTitle: 'ADA V. OBI',
    court: 'Court of Appeal',
    countryCode: 'NG',
    countryName: 'Nigeria',
    judgmentDate: '2020-03-04',
    fullCitation: '(2020) LPELR-1; (2020) 4 NWLR (Pt. 1700) 1',
    topic: 'Tenancy',
    isVerified: true,
    isBookmarked: false,
    bookmarksCount: 3,
    hasFullReport: true,
    outcome: 'appeal_dismissed',
    suitNo: 'CA/L/12/2019',
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
  // The route's boundary reads the slug from the address; the tap's frame passes its own.
  assert.match(fallback, /return <CaseFallbackFor slug=\{slugOf\(usePathname\(\)\)\} \/>;/);
  assert.match(fallback, /const peek = useCasePeek\(slug\);/);
  assert.match(fallback, /<CaseDocumentSkeleton header=\{peek \? <PeekHeader peek=\{peek\} \/> : undefined\} \/>/);
  // The page's own heading block, from the row's facts, so the case arriving moves nothing
  // (Stay, 20 October 2026: "The loading is jumpy").
  assert.match(fallback, /<CaseHeader\s*facts=\{\{/);
  assert.match(fallback, /citation: peek\.fullCitation,/);
  assert.match(fallback, /topic: peek\.topic,/);
  assert.match(fallback, /isVerified: peek\.isVerified,/);
  assert.match(fallback, /suitNo: peek\.suitNo,/);
  assert.match(fallback, /outcome: peek\.outcome,/);
  assert.match(fallback, /<CaseActionsShape\s*fullReport=\{peek\.hasFullReport\}\s*isBookmarked=\{peek\.isBookmarked\}\s*bookmarksCount=\{peek\.bookmarksCount\}/);
  assert.match(read('detail', 'CaseDocument.tsx'), /<CaseHeader\s*facts=\{\{/);
  assert.match(fallback, /import '\.\/case-masthead\.css';/);
  // The still actions row has the real one's pills and words, and none of its weight.
  const shape = read('detail', 'CaseActionsShape.tsx');
  for (const word of ['Full judgment', "'Saved' : 'Save'", 'Add to folder', 'Share', 'Feedback']) assert.ok(shape.includes(word), word);
  assert.doesNotMatch(shape, /FolderPicker|FeedbackButton|AddToFolderButton/);
  // Still no screen behind the loading boundary.
  assert.doesNotMatch(fallback, /from '\.\/Case(Screen|Document|Ask|ChatCore|ChatPanel)'/);
  // The screen's own wait is the same shape.
  const screen = read('detail', 'CaseScreen.tsx');
  assert.match(screen, /if \(query\.isPending\) return <CaseFallback \/>;/);
});

test('the heading block and the ask box do not fade when the case arrives under them', () => {
  const screen = read('detail', 'CaseScreen.tsx');
  assert.match(screen, /arrival === 'peeked'\s*\? 'v2-case-arrive-peeked'/);
  assert.match(screen, /arrive=\{arrival === 'fade'\}/);
  const css = read('detail', 'case-document.css');
  assert.match(css, /\.v2-case-arrive-peeked :where\(article > :not\(header\)\)/);
  // The masthead's type lives in its own file, loaded by both.
  assert.match(read('detail', 'CaseDocument.tsx'), /import '\.\/case-masthead\.css';/);
  const masthead = read('detail', 'case-masthead.css');
  for (const rule of ['.v2-case-doc .doc-kicker', '.v2-case-doc .doc-title', '.v2-case-doc .doc-citation']) {
    assert.ok(masthead.includes(rule), rule);
    assert.ok(!css.includes(`${rule} {`), `${rule} is defined once`);
  }
});
