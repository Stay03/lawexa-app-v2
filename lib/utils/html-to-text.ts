import { htmlToPlainText } from '@/lib/notes/plain-text';

/**
 * Markup from the API reduced to its text, without ever loading it.
 *
 * WHY NOT A DETACHED `<div>`: setting `innerHTML` on an element created with
 * `document.createElement` still fetches every `<img>` in the markup, so an
 * `onerror` attribute in third-party case text ran on the reader's page (found
 * 3 October 2026, techlead 0412d59e). `DOMParser` builds an inert document:
 * nothing in it loads and no handler runs, and `textContent` still decodes
 * every entity. Without a DOM (a server render) the pure string fallback is
 * used.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return htmlToPlainText(html);
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
}
