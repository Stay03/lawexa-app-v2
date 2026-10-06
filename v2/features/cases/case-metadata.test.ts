import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caseMetadataFrom, fetchCaseForMetadata } from '@/lib/api/server';

/** The public route's answer for Nwadike v Ibekwe, cut to the fields that
 *  matter here (GET /api/public/cases/nwadike-v-ibekwe, 6 Oct 2026). */
const nwadike = {
  success: true,
  data: {
    title: 'Nwadike v Ibekwe',
    display_title: 'Nwadike v Ibekwe',
    citation: '(1987) 4 NWLR (Pt. 67) 718; (1987) LELR-11530 (NG-SC)',
    court: { name: 'Supreme Court of Nigeria', slug: 'supreme-court-of-nigeria' },
    country: { name: 'Nigeria', code: 'NG', abbreviation: 'NG' },
    judgment_date: '1987-12-04',
    principles: '<p>A ground of appeal that raises a question of fact or mixed law and fact cannot be heard without leave.</p>',
    excerpt: 'The plaintiffs, Cletus Ibekwe and two others, sued the defendant.',
    meta: { title: 'Ibekwe v Anaclc | (1987) 4 NWLR (Pt. 67) 718', description: 'SEO text' },
  },
};

test('the public answer maps to the metadata the page and the card read', () => {
  assert.deepEqual(caseMetadataFrom(nwadike), {
    title: 'Nwadike v Ibekwe',
    displayTitle: 'Nwadike v Ibekwe',
    citation: '(1987) 4 NWLR (Pt. 67) 718; (1987) LELR-11530 (NG-SC)',
    court: 'Supreme Court of Nigeria',
    country: 'Nigeria',
    judgmentDate: '1987-12-04',
    summary: 'A ground of appeal that raises a question of fact or mixed law and fact cannot be heard without leave.',
  });
});

test('the route\'s meta block is not used, so a wrong SEO title never reaches the page', () => {
  const metadata = caseMetadataFrom(nwadike);
  assert.equal(metadata?.displayTitle, 'Nwadike v Ibekwe');
  assert.equal(JSON.stringify(metadata).includes('Anaclc'), false);
});

test('with no holding the summary is the opening of the judgment', () => {
  const metadata = caseMetadataFrom({ ...nwadike, data: { ...nwadike.data, principles: null } });
  assert.equal(metadata?.summary, 'The plaintiffs, Cletus Ibekwe and two others, sued the defendant.');
});

test('anything that is not a readable case gives null', () => {
  assert.equal(caseMetadataFrom(null), null);
  assert.equal(caseMetadataFrom({ success: false }), null);
  assert.equal(caseMetadataFrom({ success: true, data: null }), null);
});

test('it reads the public route, with no session, and a refused answer gives null', async () => {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const original = globalThis.fetch;
  let status = 200;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(nwadike), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const metadata = await fetchCaseForMetadata('nwadike-v-ibekwe');
    assert.equal(metadata?.displayTitle, 'Nwadike v Ibekwe');
    assert.match(calls[0].url, /\/api\/public\/cases\/nwadike-v-ibekwe$/);
    assert.equal(calls[0].headers.has('authorization'), false);

    status = 429;
    assert.equal(await fetchCaseForMetadata('nwadike-v-ibekwe'), null);
  } finally {
    globalThis.fetch = original;
  }
});
