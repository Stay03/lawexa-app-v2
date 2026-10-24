import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFJS_ASSET_BASE, PDFJS_VERSION, pdfAssetOptions } from './load-pdfjs';

/* pdf.js's data files in public/ (the techlead, 24 October 2026): the wasm
 * image decoders, the standard fonts and the CMaps, under a folder named for
 * the pinned version. */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else out.push(relative(dir, path).replace(/\\/g, '/'));
  }
  return out.map((path) => path).sort();
}

test('the served folder is named for the version package.json pins, and the installed package is it', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies['pdfjs-dist'], PDFJS_VERSION);
  const installed = JSON.parse(read('node_modules', 'pdfjs-dist', 'package.json')) as { version: string };
  assert.equal(installed.version, PDFJS_VERSION);
  assert.equal(PDFJS_ASSET_BASE, `/pdfjs/${PDFJS_VERSION}/`);
});

test('the copied wasm, fonts and cmaps are the package files, byte for byte', () => {
  for (const folder of ['wasm', 'standard_fonts', 'cmaps']) {
    const served = join(root, 'public', 'pdfjs', PDFJS_VERSION, folder);
    const source = join(root, 'node_modules', 'pdfjs-dist', folder);
    const names = filesUnder(served);
    assert.deepEqual(names, filesUnder(source), folder);
    assert.ok(names.length > 0, folder);
    for (const name of names) {
      assert.ok(readFileSync(join(served, name)).equals(readFileSync(join(source, name))), `${folder}/${name}`);
    }
  }
  // The decoders scanned PDFs need, by the names pdf.js asks for.
  const wasm = filesUnder(join(root, 'public', 'pdfjs', PDFJS_VERSION, 'wasm'));
  for (const name of ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm', 'jbig2_nowasm_fallback.js', 'openjpeg_nowasm_fallback.js']) {
    assert.ok(wasm.includes(name), name);
  }
});

test('getDocument is told where the files are, as absolute URLs with their trailing slash', () => {
  assert.deepEqual(pdfAssetOptions('https://lawexa.com'), {
    wasmUrl: `https://lawexa.com/pdfjs/${PDFJS_VERSION}/wasm/`,
    standardFontDataUrl: `https://lawexa.com/pdfjs/${PDFJS_VERSION}/standard_fonts/`,
    cMapUrl: `https://lawexa.com/pdfjs/${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
  });
  const reader = read('v2', 'features', 'files', 'pdf', 'PdfReader.tsx');
  assert.match(reader, /pdfjs\.getDocument\(\{\s*url,\s*withCredentials: false,\s*\.\.\.pdfAssetOptions\(window\.location\.origin\),\s*\}\)/);
});
