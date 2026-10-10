/**
 * Undo a document scroll the browser performed and did not put back.
 *
 * The v2 document is locked (shell.css, `.v2-document-lock`), so a non-zero
 * offset here cannot be a reader's scroll: they have no way to make one. It
 * comes from script or the platform: the iOS keyboard, a focus or
 * scrollIntoView that walked up to the document, or Safari restoring a saved
 * offset when a home-screen app starts. iOS hit-tests fixed sheets against such
 * an offset, so taps landed one row above the finger (10 October 2026).
 *
 * Three spellings are reset because the scrolling element differs by engine and
 * body is its own scroll container under `overflow: hidden`; each is a cheap
 * no-op at zero.
 */
export function restoreDocumentScroll(): void {
  const scroller = document.scrollingElement;
  if (scroller && scroller.scrollTop !== 0) scroller.scrollTop = 0;
  if (document.body && document.body.scrollTop !== 0) document.body.scrollTop = 0;
  if (window.scrollY !== 0) window.scrollTo(0, 0);
}
