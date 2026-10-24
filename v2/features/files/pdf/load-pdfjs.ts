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
