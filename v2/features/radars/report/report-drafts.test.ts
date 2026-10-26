import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { reportDraftAt, reportParts } from './report-drafts';
import { AFFECTED_GONE, affectedRows } from './affected-items';

/* Radar in Spaces, second part (plan 5.4 and 5.5): a report's drafts are
 * cards where they sit, numbered among every draft of the Radar's chat
 * (`draft_offset` + place), and its affected files, notes and chats are a list
 * that opens each one, or says it has left the space. */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
/** The source without its comments, so a check reads code, never a docblock. */
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const REPORT = [
  'TEST DATA: the notice changes the filing date.',
  '',
  '<draft title="TEST DATA Letter to the client">',
  '# Letter',
  'Dear client, the date moved.',
  '</draft>',
  '',
  'Two more steps follow.',
  '',
  '<draft title="TEST DATA Board note" font="Georgia">',
  'The board should note it.',
  '</draft>',
].join('\n');

test('a report splits into its text and its drafts, numbered from the offset', () => {
  const parts = reportParts(REPORT, 3);
  assert.deepEqual(
    parts.map((part) => (part.kind === 'text' ? 'text' : `draft ${part.ordinal} ${part.draft.title}`)),
    ['text', 'draft 3 TEST DATA Letter to the client', 'text', 'draft 4 TEST DATA Board note'],
  );
  const board = parts[3];
  assert.equal(board.kind === 'draft' && board.draft.font, 'Georgia');
});

test('a report without drafts is one text part', () => {
  assert.deepEqual(reportParts('TEST DATA: nothing to draft.', 0), [{ kind: 'text', text: 'TEST DATA: nothing to draft.' }]);
});

test('a draft is found by its number in the Radar chat, and only in this report', () => {
  assert.equal(reportDraftAt(REPORT, 3, 3)?.title, 'TEST DATA Letter to the client');
  assert.equal(reportDraftAt(REPORT, 3, 4)?.title, 'TEST DATA Board note');
  // An earlier report's draft, and one past this report's last.
  assert.equal(reportDraftAt(REPORT, 3, 2), null);
  assert.equal(reportDraftAt(REPORT, 3, 5), null);
});

test('affected items read with their kind and reason, and open their page', () => {
  const rows = affectedRows([
    { type: 'file', id: 7, name: 'TEST DATA lease.pdf', reason: 'Clause 4 cites the old date.', url: 'https://lawexa.test/spaces/s-1?tab=files&file=7', exists: true },
    { type: 'note', id: 'n-1', name: '  ', reason: '', url: '/notes/test-data-note', exists: true },
    { type: 'conversation', id: 'c-1', name: 'TEST DATA filing chat', reason: 'Asked about the date.', url: '/c/c-1', exists: false },
  ]);
  assert.deepEqual(
    rows.map(({ name, detail, href, gone }) => ({ name, detail, href, gone })),
    [
      { name: 'TEST DATA lease.pdf', detail: 'File · Clause 4 cites the old date.', href: '/spaces/s-1?tab=files&file=7', gone: false },
      { name: 'Untitled note', detail: 'Note', href: '/notes/test-data-note', gone: false },
      { name: 'TEST DATA filing chat', detail: `Chat · ${AFFECTED_GONE} · Asked about the date.`, href: null, gone: true },
    ],
  );
});

test('an affected item opens its page inside the app, and only an item page', () => {
  const [onAnotherHost, notAnItemPage, protocolRelative, broken] = affectedRows([
    { type: 'note', id: 1, name: 'a', reason: '', url: 'https://elsewhere.test/notes/a', exists: true },
    { type: 'file', id: 2, name: 'b', reason: '', url: 'https://elsewhere.test/login', exists: true },
    { type: 'file', id: 3, name: 'c', reason: '', url: '//elsewhere.test/admin', exists: true },
    { type: 'file', id: 4, name: 'd', reason: '', url: 'http://[bad', exists: true },
  ]);
  // The path alone, opened in the app, whatever host the API wrote.
  assert.equal(onAnotherHost.href, '/notes/a');
  assert.equal(notAnItemPage.href, null);
  assert.equal(protocolRelative.href, null);
  assert.equal(broken.href, null);
  assert.deepEqual(affectedRows(undefined), []);
});

test('the report draws its drafts as cards and opens them beside it, with the affected list before the sources', () => {
  const screen = code('./ScanReportScreen.tsx');
  assert.match(screen, /reportParts\(narrative, draftOffset \?\? 0\)/);
  assert.match(screen, /<DraftCard key=\{`draft-\$\{part\.ordinal\}`\} draft=\{part\.draft\} ordinal=\{part\.ordinal\} live=\{false\} \/>/);
  // The panel needs the Radar's chat (the report's read, else the Radar's) and
  // the offset; without them a draft reads in place.
  assert.match(screen, /ownerScan\?\.conversation_uuid \?\? radarQuery\.data\?\.data\.conversation_uuid \?\? null/);
  assert.match(screen, /draftChatUuid !== null && typeof draftOffset === 'number'/);
  assert.match(screen, /if \(!draftChat\) return page;/);
  assert.match(screen, /<SidePanelValueProvider url=\{sideUrl\} offsets=\{NO_OFFSETS\} space=\{draftSpace\} frame="card">/);
  assert.match(screen, /<AffectedItems items=\{ownerScan\?\.affected_items\} \/>\s*<ReportSources sources=\{view\.sources\} \/>/);
  // The editor loads when a draft opens, never with the report.
  assert.match(screen, /dynamic\(\(\) => import\('\.\/ReportDraftPanel'\)/);

  const panel = code('./ReportDraftPanel.tsx');
  assert.match(panel, /reportDraftAt\(narrative, draftOffset, target\.ordinal\)/);
  assert.match(panel, /<DraftEditor\s+key=\{target\.ordinal\}\s+conversationId=\{conversationUuid\}\s+ordinal=\{target\.ordinal\}/);
  assert.match(panel, /xl:sticky xl:top-0 xl:h-\[var\(--v2-report-draft-h,100dvh\)\]/);
});
