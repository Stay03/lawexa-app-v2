import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filePanelBody } from '@/v2/features/conversations/conversation/files/chat-files';
import {
  MAX_CANVAS_PIXELS,
  ZOOM_STEPS,
  canZoomIn,
  canZoomOut,
  canvasRatio,
  pageCountLabel,
  pageScale,
  pdfFailure,
  zoomIn,
  zoomLabel,
  zoomOut,
} from './pdf-model';

/* The in-app PDF reader, piece b (Stay, 24 October 2026, pdf.js 5.7.284). */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('pdf.js is never imported statically: one dynamic import, in the loader', () => {
  const sources = execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((path) => path && !path.endsWith('pdf-reader.test.ts'));
  const offenders: string[] = [];
  const dynamic: string[] = [];
  for (const path of sources) {
    const text = read(path);
    if (!text.includes('pdfjs-dist')) continue;
    for (const line of text.split('\n')) {
      // A type import is erased; anything else that loads the package at the
      // top of a module puts it in that module's chunk.
      if (/^\s*import\s+(?!type\b)[^;]*['"]pdfjs-dist/.test(line) || /^\s*import\s+['"]pdfjs-dist/.test(line)) {
        offenders.push(`${path}: ${line.trim()}`);
      }
      if (/^\s*export\s+[^;]*from\s+['"]pdfjs-dist/.test(line) || /require\(\s*['"]pdfjs-dist/.test(line)) {
        offenders.push(`${path}: ${line.trim()}`);
      }
      if (/\bimport\(\s*['"]pdfjs-dist/.test(line)) dynamic.push(path);
    }
  }
  assert.deepEqual(offenders, []);
  assert.deepEqual(dynamic, ['v2/features/files/pdf/load-pdfjs.ts']);
  const loader = read('v2', 'features', 'files', 'pdf', 'load-pdfjs.ts');
  assert.match(loader, /import\('pdfjs-dist\/legacy\/build\/pdf\.mjs'\)/);
});

test('the worker is the package file, handed to pdf.js as a bundler-made URL, once', () => {
  const loader = read('v2', 'features', 'files', 'pdf', 'load-pdfjs.ts');
  assert.match(
    loader,
    /pdfjs\.GlobalWorkerOptions\.workerSrc = new URL\(\n\s+'pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs',\n\s+import\.meta\.url,\n\s+\)\.toString\(\);/,
  );
  assert.match(loader, /if \(!pdfjs\.GlobalWorkerOptions\.workerSrc\)/);
  // The files it names exist in the installed package, and the version is pinned.
  assert.ok(existsSync(join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs')));
  assert.ok(existsSync(join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs')));
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies['pdfjs-dist'], '5.7.284');
});

test('the chat file panel picks the reader for a PDF', () => {
  assert.equal(filePanelBody({ mime_type: 'application/pdf', original_name: 'TEST DATA Chapter 2.pdf', size: 1_258_291 }), 'pdf');
  assert.equal(filePanelBody({ mime_type: 'application/octet-stream', original_name: 'scan.PDF' }), 'pdf');
  const panel = read('v2', 'features', 'conversations', 'conversation', 'files', 'FilePanel.tsx');
  assert.match(panel, /case 'pdf':\n\s+return \(\n\s+<div[^>]*>\n\s+<PdfReader\n\s+fileId=\{file\.id\}/);
  assert.match(panel, /renderControls=\{\(controls\) => <SidePanelActions>\{controls\}<\/SidePanelActions>\}/);
});

test('zoom steps through multiples of fit width, and Fit is 1', () => {
  assert.equal(zoomIn(1), 1.25);
  assert.equal(zoomOut(1), 0.75);
  assert.equal(zoomIn(3), 3);
  assert.equal(zoomOut(0.5), 0.5);
  assert.equal(canZoomIn(ZOOM_STEPS[ZOOM_STEPS.length - 1]), false);
  assert.equal(canZoomOut(ZOOM_STEPS[0]), false);
  assert.equal(zoomLabel(1), 'Fit');
  assert.equal(zoomLabel(1.5), '150%');
  // A 595-point A4 page in a 600px column fits at 600/595; zoom multiplies it.
  assert.equal(pageScale(600, 595, 1), 600 / 595);
  assert.equal(pageScale(600, 595, 2), (600 / 595) * 2);
  assert.equal(pageScale(0, 595, 1), 1);
});

test('a canvas never passes the iPhone limit, and keeps at most twice the screen density', () => {
  assert.equal(canvasRatio(600, 850, 3), 2);
  assert.equal(canvasRatio(600, 850, 1), 1);
  const ratio = canvasRatio(1800, 2550, 2);
  assert.ok(1800 * ratio * 2550 * ratio <= MAX_CANVAS_PIXELS + 1);
  assert.equal(pageCountLabel(1), '1 page');
  assert.equal(pageCountLabel(12), '12 pages');
});

test('a locked, broken, missing or expired PDF says so in a clear sentence', () => {
  assert.equal(pdfFailure({ name: 'PasswordException' }).kind, 'password');
  assert.match(pdfFailure({ name: 'PasswordException' }).message, /locked with a password/);
  assert.equal(pdfFailure({ name: 'InvalidPDFException' }).kind, 'broken');
  assert.equal(pdfFailure({ name: 'ResponseException', status: 404 }).kind, 'gone');
  assert.equal(pdfFailure({ name: 'ResponseException', status: 403 }).kind, 'relink');
  assert.equal(pdfFailure({ name: 'ResponseException', status: 400 }).kind, 'relink');
  assert.deepEqual(pdfFailure(new TypeError('Failed to fetch')), {
    kind: 'failed',
    message: 'The PDF did not load. Try again, or download it.',
    retry: true,
  });
});
