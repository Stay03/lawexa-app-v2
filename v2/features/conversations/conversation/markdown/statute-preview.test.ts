import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PREVIEW_STALE_MS, openingWords, previewPath, sectionPreview } from './statute-preview';

/* Arthur, 19 October 2026: a badge for another statute's section showed only
 * "Section 334" (and in a normal chat, where no statute page is open, every
 * badge did). The pane now reads the section when it opens. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the pane asks for the link’s section, the section alone for a subsection', () => {
  assert.equal(previewPath({ provision: 'section-334' }), 'section-334');
  assert.equal(previewPath({ provision: 'section-54-2' }), 'section-54');
  assert.equal(previewPath({ provision: 'section-12a' }), 'section-12a');
  // The whole statute, or a segment that is not a section: nothing to fetch.
  assert.equal(previewPath({ provision: null }), null);
  assert.equal(previewPath({ provision: 'schedule-2' }), null);
});

test('the opening words are plain text, cut at a word', () => {
  assert.equal(openingWords('<p>The duties of a&nbsp;secretary include:</p>'), 'The duties of a secretary include:');
  assert.equal(openingWords(null), null);
  assert.equal(openingWords('   '), null);
  const long = 'A secretary shall not use confidential information obtained from the company '.repeat(6);
  const cut = openingWords(long) ?? '';
  assert.ok(cut.length <= 281, String(cut.length));
  assert.ok(cut.endsWith('…'));
  assert.ok(!/\s…$/.test(cut));
});

test('the pane names the statute, the section’s heading and its opening', () => {
  const node = { title: 'Fiduciary interests of a secretary', content: 'A secretary shall not use for his own benefit…', intro: null };
  const data = {
    node,
    total_count: 1,
    statute: { slug: 'companies-and-allied-matters-act-2020', title: 'Companies and Allied Matters Act, 2020', short_title: 'CAMA 2020' },
  } as never;
  assert.deepEqual(sectionPreview(data), {
    name: 'CAMA 2020',
    heading: 'Fiduciary interests of a secretary',
    text: 'A secretary shall not use for his own benefit…',
  });
  // A section with subsections opens with its own lead-in.
  const withIntro = { ...(data as object), node: { title: null, content: null, intro: 'The duties of a secretary include:' } } as never;
  assert.deepEqual(sectionPreview(withIntro), { name: 'CAMA 2020', heading: null, text: 'The duties of a secretary include:' });
  // A section whose words sit in its subsections (Evidence Act s.84, live 20
  // October 2026): no intro, no content, and the server's excerpt carries them.
  const s84 = {
    node: { title: 'Admissibility of statement in documents produced by computers', content: null, intro: null },
    total_count: 1,
    statute: { slug: 'evidence-act-2011-as-amended', title: 'Evidence Act, 2011 (as amended)', short_title: null },
    excerpt: 'In any proceeding a statement contained in a document produced by a computer shall be admissible as evidence',
  } as never;
  assert.equal(
    sectionPreview(s84).text,
    'In any proceeding a statement contained in a document produced by a computer shall be admissible as evidence',
  );
  // The excerpt wins over the section's own words; a blank one does not.
  assert.equal(sectionPreview({ ...(data as object), excerpt: 'From the server.' } as never).text, 'From the server.');
  assert.equal(sectionPreview({ ...(data as object), excerpt: '  ' } as never).text, 'A secretary shall not use for his own benefit…');
  // An older server without the statute block: the link's words stay the name.
  const bare = { node, total_count: 1 } as never;
  assert.equal(sectionPreview(bare).name, null);
});

test('the read happens only for another statute, once per pane, kept an hour, as a prefetch', () => {
  assert.equal(PREVIEW_STALE_MS, 60 * 60 * 1000);
  const link = read('v2', 'features', 'conversations', 'conversation', 'markdown', 'StatuteMentionLink.tsx');
  assert.match(link, /const path = onPage \? null : previewPath\(target\);/);
  assert.match(link, /queryKey: \['statute-section-preview', target\.slug, path\],/);
  assert.match(link, /enabled: path !== null,/);
  assert.match(link, /staleTime: PREVIEW_STALE_MS,/);
  // Failure leaves today's pane: the link's words, the number, Open statute.
  assert.match(link, /const name = pageHost \? pageHost\.statuteTitle \|\| linkText : remote\?\.name \|\| linkText;/);
  const api = read('lib', 'api', 'statutes.ts');
  assert.match(api, /previewSection: async \(slug: string, path: string\)/);
  assert.match(api, /\{ headers: \{ 'X-Lawexa-Prefetch': '1' \} \},/);
});
