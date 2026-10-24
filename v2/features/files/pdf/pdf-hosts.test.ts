import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPdfFile, listViewable } from '../viewable';

/* Every PDF in the app opens in the reader (the techlead, 24 October 2026):
 * the chat's side panel, and the reader's dialog over every other list. */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('a PDF is known by its mime, or by its name under a generic one', () => {
  assert.equal(isPdfFile({ mime_type: 'application/pdf', original_name: 'x' }), true);
  assert.equal(isPdfFile({ mime_type: 'application/octet-stream', original_name: 'Bundle.PDF' }), true);
  assert.equal(isPdfFile({ original_name: 'TEST DATA scan.pdf' }), true);
  assert.equal(isPdfFile({ mime_type: 'application/msword', original_name: 'brief.pdf' }), false);
  assert.equal(isPdfFile({ mime_type: 'image/png', original_name: 'scan.png' }), false);
});

test('a PDF is not in the picture viewer set: it opens in the reader', () => {
  const set = listViewable(
    [
      { id: 1, mime_type: 'image/jpeg', original_name: 'a.jpg' },
      { id: 2, mime_type: 'application/pdf', original_name: 'b.pdf' },
      { id: 3, mime_type: 'video/mp4', original_name: 'c.mp4' },
    ],
    'File',
  );
  assert.deepEqual(set.map((item) => item.id), [1, 3]);
});

test('the file lists open a PDF in the reader dialog from the same view call', () => {
  const hook = read('v2', 'features', 'files', 'use-file-viewer.ts');
  assert.match(hook, /if \(file\.kind === 'pdf'\) \{\s*openPdf\(/);
  const viewers = read('v2', 'features', 'files', 'FileViewers.tsx');
  assert.match(viewers, /<PdfViewerDialog viewer=\{viewer\.pdf\} \/>/);
  // The four list hosts draw FileViewers, so each gets the dialog.
  for (const parts of [
    ['folders', 'detail', 'FolderScreen.tsx'],
    ['folders', 'list', 'LooseFilesSection.tsx'],
    ['spaces', 'detail', 'content', 'SpaceLooseFiles.tsx'],
    ['spaces', 'detail', 'content', 'SpaceContentPanel.tsx'],
  ]) {
    assert.match(read('v2', 'features', ...parts), /<FileViewers viewer=\{viewer\}/, parts.join('/'));
  }
});

test('a sent chat PDF, a channel message PDF and a channel library PDF open in the reader dialog', () => {
  const sent = read('v2', 'features', 'conversations', 'conversation', 'rows', 'SentAttachments.tsx');
  assert.match(sent, /isPdf\(document\)\s*\?\s*\(\) =>\s*pdf\.open\(\{/);
  assert.match(sent, /onClick=\{onRead \?\? \(openInTab\.ready \? openInTab\.save : openIt\)\}/);
  assert.match(sent, /\{hasPdf \? <PdfViewerDialog viewer=\{pdf\} \/> : null\}/);

  const feed = read('v2', 'features', 'channels', 'feed', 'MessageAttachments.tsx');
  assert.match(feed, /isPdf\s*\?\s*pdf\.open\(\{/);
  assert.match(feed, /\{isPdf \? <PdfViewerDialog viewer=\{pdf\} \/> : null\}/);

  const library = read('v2', 'features', 'channels', 'files', 'FileRow.tsx');
  assert.match(library, /const read = \(\) =>\s*pdf\.open\(\{/);
  assert.match(library, /aria-label=\{`Read \$\{file\.original_name\}`\}/);
  assert.match(library, /\{isPdf \? <PdfViewerDialog viewer=\{pdf\} \/> : null\}/);
});

test('Back closes the reader, and a close by button, Escape or scrim leaves no history step (the techlead, 24 October 2026)', () => {
  const dialog = read('v2', 'features', 'files', 'pdf', 'PdfViewerDialog.tsx');
  // One extra step while a PDF is open; Back takes it and the reader closes.
  assert.match(dialog, /const backGuard = useBackGuard\(viewer\.file !== null, viewer\.close\);/);
  // The overlay's every close takes the step first, then closes.
  assert.match(dialog, /if \(!open\) backGuard\.release\(viewer\.close\);/);
  assert.doesNotMatch(dialog, /viewer\.close\(\)/);
  // The guard walks back only when its own step is on top, and that walk is not the reader's Back.
  const guard = read('v2', 'runtime', 'use-back-guard.ts');
  assert.match(guard, /if \(readHistoryStamp\(GUARD_KEY\) === null\) \{\s*then\(\);\s*return;\s*\}\s*releasingRef\.current = true;/);
  assert.match(guard, /if \(releasingRef\.current \|\| readHistoryStamp\(GUARD_KEY\) !== null\) return;\s*onBackRef\.current\(\);/);
});

test('the dialog is the responsive overlay, with Download and Open in a new tab in its bar', () => {
  const dialog = read('v2', 'features', 'files', 'pdf', 'PdfViewerDialog.tsx');
  assert.match(dialog, /<ResponsiveOverlay\s/);
  assert.match(dialog, /<PdfReader\s/);
  assert.match(dialog, /renderControls=\{\(controls\) => <PdfBar file=\{file\}>\{controls\}<\/PdfBar>\}/);
  assert.match(dialog, /label=\{download\.ready \? 'Save' : 'Download'\}/);
  assert.match(dialog, /label="Open in a new tab"/);
});
