import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { rememberStatutePeek, statutePeekFor } from './statute-peek';
import { statutesQueries } from './queries';

/* Speed step 5, statutes (17 October 2026): a tapped row's name draws at once,
 * and the document's text read starts beside the metadata read instead of
 * after it. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const ROW = {
  slug: 'labour-act',
  title: 'Labour Act',
  shortTitle: 'Act 651',
  countryCode: 'GH',
  countryName: 'Ghana',
  year: 2003,
};

test('the tap keeps the row\'s masthead facts, for that statute only, one entry', () => {
  rememberStatutePeek(ROW);
  assert.deepEqual(statutePeekFor('labour-act'), ROW);
  assert.equal(statutePeekFor('other-act'), null);
  assert.equal(statutePeekFor(undefined), null);
  rememberStatutePeek({ ...ROW, slug: 'next-act', title: 'Next Act' });
  assert.equal(statutePeekFor('labour-act'), null);
  assert.equal(statutePeekFor('next-act')?.title, 'Next Act');
});

test('the row leaves its facts on the tap, and both waits draw them in the masthead\'s type', () => {
  assert.match(read('list', 'StatuteRow.tsx'), /onClick=\{\(\) => rememberStatutePeek\(row\)\}/);
  const fallback = read('reader', 'StatuteFallback.tsx');
  assert.match(fallback, /const peek = useStatutePeek\(slugOf\(usePathname\(\)\)\);/);
  assert.match(fallback, /<StatuteDocumentSkeleton masthead=\{peek \? <PeekMasthead peek=\{peek\} \/> : undefined\} \/>/);
  assert.match(fallback, /<h1 className="doc-title text-foreground">\{peek\.title\}<\/h1>/);
  assert.match(fallback, /import '\.\/statute-masthead\.css';/);
  assert.doesNotMatch(fallback, /from '\.\/Statute(Screen|Document|Header)'/);
  assert.match(read('reader', 'StatuteScreen.tsx'), /if \(query\.isPending\) return <StatuteFallback \/>;/);
  // The masthead's type lives in one file, loaded by the loading screen and the header.
  const masthead = read('reader', 'statute-masthead.css');
  const documentCss = read('reader', 'statute-document.css');
  for (const rule of ['.v2-statute-doc .doc-kicker', '.v2-statute-doc .doc-title', '.v2-statute-doc .doc-citation']) {
    assert.ok(masthead.includes(rule), rule);
    assert.ok(!documentCss.includes(`${rule} {`), `${rule} defined once`);
  }
  assert.match(read('reader', 'StatuteHeader.tsx'), /import '\.\/statute-masthead\.css';/);
});

test('the kicker, the name and the designation do not fade when the statute arrives under them', () => {
  assert.match(read('reader', 'StatuteScreen.tsx'), /arrival === 'peeked'\s*\? 'v2-statute-arrive-peeked'/);
  assert.match(
    read('reader', 'statute-document.css'),
    /\.v2-statute-arrive-peeked > :not\(header\),\s*\.v2-statute-arrive-peeked > header > :not\(\.doc-kicker, \.doc-title, \.doc-citation\)/,
  );
});

/** Counts the statute reads sent through the client, in the order they start. */
async function reads(run: (client: QueryClient) => Promise<void>) {
  const started: string[] = [];
  const client = new QueryClient();
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    started.push(String(config.url).endsWith('/export-akn') ? 'text' : 'metadata');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const data = String(config.url).endsWith('/export-akn') ? '<akomaNtoso/>' : { success: true, data: { id: 1, slug: 'a' } };
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    await run(client);
  } finally {
    apiClient.defaults.adapter = adapter;
    client.clear();
  }
  return started;
}

test('an open from a tapped row: the text read starts with the metadata read, and the document reuses it', async () => {
  const started = await reads(async (client) => {
    // StatuteScreen at mount: the metadata read and, for a row's open, the text read.
    const metadata = client.fetchQuery(statutesQueries.detail('a'));
    const text = client.prefetchQuery(statutesQueries.akn('a'));
    await metadata;
    // StatuteDocument mounts once the metadata has answered: it asks for the text.
    await client.fetchQuery(statutesQueries.akn('a'));
    await text;
  });
  assert.deepEqual(started, ['metadata', 'text']);
});

test('the screen starts the text read only for an open from a row, and only signed in', () => {
  const screen = read('reader', 'StatuteScreen.tsx');
  assert.match(screen, /const \[fromRow\] = useState\(\(\) => peeked\);/);
  assert.match(
    screen,
    /useEffect\(\(\) => \{\s*if \(signedIn && fromRow\) void queryClient\.prefetchQuery\(statutesQueries\.akn\(slug\)\);\s*\}, \[signedIn, fromRow, queryClient, slug\]\);/,
  );
  // The document still owns the read it renders; the early start is the same entry.
  assert.match(read('reader', 'StatuteDocument.tsx'), /const query = useQuery\(statutesQueries\.akn\(slug\)\);/);
});
