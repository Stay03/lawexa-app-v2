import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, hydrate } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { CASE_PREFETCH_HEADER } from '@/lib/api/cases';
import type { CaseDetailResponse } from '@/types/case';
import { caseDetailState } from './case-prefetch-state';
import { countOpen } from './case-view';
import { casesQueries, searchTermOf } from './queries';

/* One view per case open (the techlead's counts, 17 October 2026): a phone tap
 * is one counted read and no view call; a desktop hover then click is one
 * prefetch read and one view call; a direct load is one counted read. */

const here = dirname(fileURLToPath(import.meta.url));
const ANSWER = (slug: string) => ({ success: true, data: { id: 9, slug } }) as unknown as CaseDetailResponse;

type Call = { kind: 'read' | 'prefetch' | 'view'; url: string };

/** Every case read and view call sent through the client. */
async function calls(run: (client: QueryClient) => Promise<void>) {
  const sent: Call[] = [];
  const client = new QueryClient();
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    const url = `${config.url}${config.params?.q ? `?q=${config.params.q}` : ''}`;
    if (config.method === 'post') sent.push({ kind: 'view', url });
    else sent.push({ kind: (config.headers as Record<string, unknown>)[CASE_PREFETCH_HEADER] === '1' ? 'prefetch' : 'read', url });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const slug = String(config.url).split('/')[2];
    return { data: config.method === 'post' ? '' : ANSWER(slug), status: config.method === 'post' ? 204 : 200, statusText: 'OK', headers: {}, config };
  };
  try {
    await run(client);
    // Let a view call sent without awaiting land.
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    apiClient.defaults.adapter = adapter;
    client.clear();
  }
  return sent;
}

/** What `CaseScreen` does once it has the case: count the open. */
const pageDraws = async (client: QueryClient, slug: string, search?: string) => {
  await client.fetchQuery(casesQueries.detail(slug, search));
  countOpen(slug, searchTermOf(search));
};

test('a phone tap: one counted read, no view call', async () => {
  const sent = await calls(async (client) => {
    await pageDraws(client, 'phone-case');
  });
  assert.deepEqual(sent, [{ kind: 'read', url: '/cases/phone-case' }]);
});

test('a desktop hover then click: one prefetch read and one view call, once', async () => {
  const sent = await calls(async (client) => {
    await client.prefetchQuery(casesQueries.prefetchDetail('desk-case', ''));
    await pageDraws(client, 'desk-case');
    // The page draws the same answer again (the loading boundary, then the
    // page; a re-render): no second view.
    await pageDraws(client, 'desk-case');
  });
  assert.deepEqual(sent, [
    { kind: 'prefetch', url: '/cases/desk-case' },
    { kind: 'view', url: '/cases/desk-case/view' },
  ]);
});

test('a hover from a search carries the search on the view, as the read would', async () => {
  const sent = await calls(async (client) => {
    await client.prefetchQuery(casesQueries.prefetchDetail('search-case', ' fair hearing '));
    await pageDraws(client, 'search-case', 'fair hearing');
  });
  assert.deepEqual(sent, [
    { kind: 'prefetch', url: '/cases/search-case?q=fair hearing' },
    { kind: 'view', url: '/cases/search-case/view?q=fair hearing' },
  ]);
});

test('a direct load: the server\'s counted read is in the page; no read and no view call here', async () => {
  const slug = 'direct-case';
  const state = await caseDetailState(casesQueries.detail(slug).queryKey, () => Promise.resolve(ANSWER(slug)));
  const sent = await calls(async (client) => {
    hydrate(client, state);
    await pageDraws(client, slug);
  });
  assert.deepEqual(sent, []);
});

test('a hover read that a counted read replaced sends no view: the read counted it', async () => {
  const sent = await calls(async (client) => {
    await client.prefetchQuery(casesQueries.prefetchDetail('both-case'));
    // The page's own counted read of the same entry (a stale answer refetched).
    await client.fetchQuery({ ...casesQueries.detail('both-case'), staleTime: 0 });
    countOpen('both-case', undefined);
  });
  assert.deepEqual(sent.map((call) => call.kind), ['prefetch', 'read']);
});

test('the case screen counts the open once it has the case, and the view call is a POST with the search as ?q=', () => {
  const screen = readFileSync(join(here, 'detail', 'CaseScreen.tsx'), 'utf8');
  assert.match(screen, /useEffect\(\(\) => \{\s*if \(drawn\) countOpen\(slug, searchTermOf\(searchQuery\)\);\s*\}, \[drawn, slug, searchQuery\]\);/);
  const api = readFileSync(join(here, '..', '..', '..', 'lib', 'api', 'cases.ts'), 'utf8');
  assert.match(api, /apiClient\.post\(`\/cases\/\$\{slug\}\/view`, undefined, \{\s*params: searchQuery \? \{ q: searchQuery \} : undefined,\s*\}\)/);
});

test('a direct load without the server key: the page makes one counted read and no view call', async () => {
  // No LAWEXA_SSR_KEY: prefetchCaseDetailState returns nothing, so the page
  // mounts with no answer and reads the case itself, an ordinary read.
  const sent = await calls(async (client) => {
    await pageDraws(client, 'nokey-case');
  });
  assert.deepEqual(sent, [{ kind: 'read', url: '/cases/nokey-case' }]);
});

test('a direct load with the server key: the server reads as the reader, with no prefetch header', () => {
  // So the API counts that read as the open's one view, under the reader's
  // own account (its bearer token), with the reader's address and browser
  // forwarded under the shared key (backend a0020709).
  const server = readFileSync(join(here, 'server.ts'), 'utf8');
  const read = server.slice(server.indexOf('export async function prefetchCaseDetailState'));
  assert.match(read, /apiFetch<CaseDetailResponse>\(`\/cases\/\$\{encodeURIComponent\(slug\)\}\?\$\{query\.toString\(\)\}`/);
  assert.match(read, /'X-Lawexa-SSR-Key': key,\s*'X-Lawexa-Client-IP': ip,/);
  assert.doesNotMatch(read, /X-Lawexa-Prefetch|CASE_PREFETCH_HEADER|prefetch: true/);
  const apiServer = readFileSync(join(here, '..', '..', 'runtime', 'api-server.ts'), 'utf8');
  assert.match(apiServer, /const token = await getSessionToken\(\);/);
  assert.match(apiServer, /headers\.set\('Authorization', `Bearer \$\{token\}`\);/);
});
