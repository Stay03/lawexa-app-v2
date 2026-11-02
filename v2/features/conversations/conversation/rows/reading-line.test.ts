import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isReading, readingAnnouncement, readingLine, readingPollDelay } from './reading-line';

/* The line under a document attached in a chat says how far the server has
 * got with reading it (Stay, thread 4b936d0d; techlead 77b174df; Backend's
 * extraction_status on chat-no-extract). */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('each reading state has its line, and a server without the field shows none', () => {
  assert.deepEqual(readingLine({ extraction_status: 'pending' }), { text: 'Reading…', tone: 'reading', announce: 'Reading the file.' });
  assert.equal(readingLine({ extraction_status: 'done' })?.text, 'Read');
  assert.deepEqual(readingLine({ extraction_status: 'failed' }), { text: 'Couldn’t read this file', tone: 'failed', announce: 'Couldn’t read this file.' });
  assert.equal(readingLine({ extraction_status: 'empty' })?.text, 'No text to read in this file');
  assert.equal(readingLine({ extraction_status: 'skipped' })?.text, 'No text to read in this file');
  assert.equal(readingLine({}), null);
  assert.equal(readingLine(null), null);
  assert.equal(readingLine({ extraction_status: null }), null);
});

test('a scan has no text of its own, so its pages decide: reading, read, or nothing to read', () => {
  // Pages still being read: "Reading…", and asked about again.
  assert.deepEqual(readingLine({ extraction_status: 'empty', ocr_status: 'pending' }), { text: 'Reading…', tone: 'reading', announce: 'Reading the file.' });
  assert.equal(isReading({ extraction_status: 'empty', ocr_status: 'pending' }), true);
  // Pages read (some may be past the plan): "Read".
  assert.equal(readingLine({ extraction_status: 'empty', ocr_status: 'done' })?.text, 'Read');
  assert.equal(readingLine({ extraction_status: 'empty', ocr_status: 'partial' })?.text, 'Read');
  assert.equal(isReading({ extraction_status: 'empty', ocr_status: 'done' }), false);
  // The scan failed, or there is no scan: nothing to read.
  assert.equal(readingLine({ extraction_status: 'empty', ocr_status: 'failed' })?.text, 'No text to read in this file');
  assert.equal(readingLine({ extraction_status: 'empty', ocr_status: null })?.text, 'No text to read in this file');
  assert.equal(readingLine({ extraction_status: 'skipped', ocr_status: 'pending' })?.text, 'Reading…');
});

test('a later server’s page counts slot into the reading line', () => {
  assert.equal(readingLine({ extraction_status: 'pending', pages_read: 120, page_count: 1600 })?.text, 'Reading… 120 of 1,600 pages');
  assert.equal(readingLine({ extraction_status: 'pending', pages_read: 0, page_count: 1 })?.text, 'Reading… 0 of 1 page');
  // Never more read than the file has, and no count without both numbers.
  assert.equal(readingLine({ extraction_status: 'pending', pages_read: 1700, page_count: 1600 })?.text, 'Reading… 1,600 of 1,600 pages');
  assert.equal(readingLine({ extraction_status: 'pending', pages_read: 40 })?.text, 'Reading…');
  assert.equal(readingLine({ extraction_status: 'pending', pages_read: 40, page_count: 0 })?.text, 'Reading…');
});

test('the file is asked about again only while it is being read, with a growing wait', () => {
  assert.equal(isReading({ extraction_status: 'pending' }), true);
  assert.equal(isReading({ extraction_status: 'done' }), false);
  assert.equal(isReading(null), false);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(readingPollDelay), [2000, 3000, 4500, 6750, 10125, 15000, 15000, 15000]);
});

test('a screen reader hears the start, and the end only when this view saw the reading', () => {
  const reading = readingLine({ extraction_status: 'pending', pages_read: 120, page_count: 1600 });
  assert.equal(readingAnnouncement(reading, 1), 'Reading the file.');
  assert.equal(readingAnnouncement(readingLine({ extraction_status: 'pending', pages_read: 400, page_count: 1600 }), 5), 'Reading the file.');
  // An old message whose file was read long ago: nothing when the chat opens.
  assert.equal(readingAnnouncement(readingLine({ extraction_status: 'done' }), 1), '');
  // A file read while the person watched: the end is announced.
  assert.equal(readingAnnouncement(readingLine({ extraction_status: 'done' }), 3), 'The file is read.');
  assert.equal(readingAnnouncement(null, 3), '');
});

test('each sent document shows its line, asked only near the screen and from the file’s own state', () => {
  const sent = read('v2', 'features', 'conversations', 'conversation', 'rows', 'SentAttachments.tsx');
  assert.match(sent, /<DocumentReadingLine fileId=\{document\.file_id\} enabled=\{near\} \/>/);
  assert.match(sent, /\.\.\.filesQueries\.detail\(fileId\),\s*enabled,/);
  assert.match(sent, /isReading\(query\.state\.data\?\.data\) \? readingPollDelay\(query\.state\.dataUpdateCount\) : false,/);
  assert.match(sent, /<span role="status" aria-live="polite" className="sr-only">\s*\{readingAnnouncement\(line, answers\)\}/);
});
