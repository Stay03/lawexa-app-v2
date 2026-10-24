/**
 * load-pdfjs — pdf.js, loaded only when a PDF is opened (the in-app PDF
 * reader, piece b; Stay, 24 October 2026).
 *
 * LAZY BY CONSTRUCTION. The library is a dynamic `import()` here and nowhere
 * else, so the bundler puts it in its own chunk, fetched the first time a
 * reader asks for it; no page that never opens a PDF downloads it. Nothing in
 * the app imports `pdfjs-dist` statically (a test pins it), and type imports
 * are erased.
 *
 * THE LEGACY BUILD. pdf.js 5's modern build calls `Map.prototype.
 * getOrInsertComputed` and `Math.sumPrecise` directly, which iOS 17 and 18
 * Safari do not have; the legacy build carries polyfills for them and is the
 * one the library names for older browsers.
 *
 * THE WORKER is the package's own file, given to pdf.js as a URL the bundler
 * makes: `new URL('pdfjs-dist/…', import.meta.url)` is the asset form webpack
 * and Turbopack both resolve and copy into the build's static files. pdf.js
 * then starts it as a module worker itself.
 */

import type * as PdfJs from 'pdfjs-dist/legacy/build/pdf.mjs';

export type PdfJsModule = typeof PdfJs;

/**
 * THE PACKAGE'S DATA FILES, served from `public/pdfjs/<version>/` (the
 * techlead, 24 October 2026): the wasm image decoders (JBIG2 and JPEG 2000,
 * which scanned PDFs use), the 14 standard fonts a PDF may name without
 * embedding, and the CMaps that Chinese, Japanese and Korean text needs.
 * Copied byte for byte from pdfjs-dist; the folder carries the version, so a
 * cached file of one version is never read by another. pdf.js fetches each
 * file only when a PDF needs it.
 *
 * `PDFJS_VERSION` is the version pinned in package.json (a test checks it,
 * the installed package and the copied files), so an upgrade of the package
 * without a new folder fails the tests rather than the reader.
 */
export const PDFJS_VERSION = '5.7.284';

export const PDFJS_ASSET_BASE = `/pdfjs/${PDFJS_VERSION}/`;

/** The data-file options for `getDocument`, as absolute URLs: the worker
 *  resolves them from its own address, which is not the page's. */
export function pdfAssetOptions(origin: string) {
  const base = new URL(PDFJS_ASSET_BASE, origin).href;
  return {
    wasmUrl: `${base}wasm/`,
    standardFontDataUrl: `${base}standard_fonts/`,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
  };
}

let loading: Promise<PdfJsModule> | null = null;

export function loadPdfJs(): Promise<PdfJsModule> {
  if (loading) return loading;
  const started = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
    }
    return pdfjs;
  });
  // A failed chunk load (a dropped line, a deploy in between) can be asked
  // for again: the next reader starts a fresh import.
  started.catch(() => {
    if (loading === started) loading = null;
  });
  loading = started;
  return started;
}
