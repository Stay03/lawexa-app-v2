import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isReadingPages, SCAN_POLL_MS, scanLines } from './scan-reading';

/* A scanned PDF's pages are read into text when it is uploaded (Stay's yes,
 * thread 1c93152c; Backend's contract in 384c, dc79c07d). The PDF reader says
 * how far the reading is, what lies past the plan, and what could not be read. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('a file with no scanned pages says nothing', () => {
  const none = { reading: null, pastPlan: null, plansLink: false, unread: null, announce: '' };
  assert.deepEqual(scanLines(null), none);
  assert.deepEqual(scanLines({ ocr_status: null, scanned_pages: null }), none);
  assert.deepEqual(scanLines({ ocr_status: 'done', scanned_pages: 12, ocr_pages_read: 12, ocr_pages_cap: 100 }), {
    ...none, announce: 'The scanned pages are read.',
  });
  assert.equal(isReadingPages({ ocr_status: 'done' }), false);
});

test('while the pages are read, the reader counts up to what the plan reads', () => {
  assert.equal(scanLines({ ocr_status: 'pending', scanned_pages: 120, ocr_pages_read: 40, ocr_pages_cap: 250 }).reading, 'Reading pages… 40 of 120');
  // Past the plan: the count stops at the plan's cap, and the rest is named.
  const big = scanLines({ ocr_status: 'pending', scanned_pages: 1200, ocr_pages_read: 0, ocr_pages_cap: 1000, ocr_cap_from: 'own_plan' });
  assert.equal(big.reading, 'Reading pages… 0 of 1,000');
  assert.equal(big.pastPlan, '200 pages of this scan are past your plan');
  assert.equal(big.plansLink, true);
  // A screen reader hears the start, not each count.
  assert.equal(big.announce, 'Reading the scanned pages.');
  assert.equal(scanLines({ ocr_status: 'pending', scanned_pages: 1200, ocr_pages_read: 400, ocr_pages_cap: 1000 }).announce, big.announce);
  // No limit, and not yet looked at.
  assert.equal(scanLines({ ocr_status: 'pending', scanned_pages: 30, ocr_pages_read: 3, ocr_pages_cap: null }).reading, 'Reading pages… 3 of 30');
  assert.equal(scanLines({ ocr_status: 'pending', scanned_pages: null }).reading, 'Reading pages…');
  assert.equal(isReadingPages({ ocr_status: 'pending' }), true);
  assert.equal(SCAN_POLL_MS, 4000);
});

test('a finished scan says what lies past the plan, or what could not be read', () => {
  assert.deepEqual(scanLines({ ocr_status: 'partial', scanned_pages: 101, ocr_pages_read: 100, ocr_pages_cap: 100, ocr_cap_from: 'own_plan' }), {
    reading: null, pastPlan: '1 page of this scan is past your plan', plansLink: true, unread: null,
    announce: '1 page of this scan is past your plan',
  });
  // Partial with nothing past the plan: some pages could not be read.
  assert.equal(scanLines({ ocr_status: 'partial', scanned_pages: 40, ocr_pages_read: 37, ocr_pages_cap: 100 }).unread, 'Some pages couldn’t be read.');
  assert.equal(scanLines({ ocr_status: 'failed', scanned_pages: 40, ocr_pages_read: 0, ocr_pages_cap: 100 }).unread, 'Some pages couldn’t be read.');
});

test('a Space or channel file is read to the Space holder’s plan, and no member is sent to the plans for it', () => {
  const space = scanLines({ ocr_status: 'partial', scanned_pages: 300, ocr_pages_read: 250, ocr_pages_cap: 250, ocr_cap_from: 'space_plan' });
  assert.equal(space.pastPlan, '50 pages of this scan are past this Space’s plan');
  assert.equal(space.plansLink, false);
  // A server that does not say whose plan: plain words, no link.
  const unknown = scanLines({ ocr_status: 'partial', scanned_pages: 300, ocr_pages_read: 250, ocr_pages_cap: 250 });
  assert.equal(unknown.pastPlan, '50 pages of this scan are past the plan’s limit');
  assert.equal(unknown.plansLink, false);
});

test('both PDF hosts show the status, asked again while the pages are read, with the way to the plans', () => {
  const status = read('v2', 'features', 'files', 'ScanReadingStatus.tsx');
  assert.match(status, /refetchInterval: \(query\) => \(isReadingPages\(query\.state\.data\?\.data\) \? SCAN_POLL_MS : false\),/);
  assert.match(status, /\.\.\.filesQueries\.detail\(fileId\),/);
  // Asked again each time the reader opens: a kept answer may predate the reading or an upgrade.
  assert.match(status, /refetchOnMount: 'always',/);
  // The live region stays mounted and holds only the start and end; the plans link only for the reader's own plan.
  assert.match(status, /<span role="status" aria-live="polite" className="sr-only">\s*\{lines\.announce\}\s*<\/span>/);
  assert.match(status, /\{lines\.plansLink \? \(/);
  assert.match(read('v2', 'features', 'files', 'pdf', 'PdfViewerDialog.tsx'), /<ScanReadingStatus fileId=\{file\.id\} className="basis-full px-1 pb-0\.5" \/>/);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'files', 'FilePanel.tsx'), /<ScanReadingStatus fileId=\{file\.id\} className="mb-3" \/>\s*<PdfReader/);
});
