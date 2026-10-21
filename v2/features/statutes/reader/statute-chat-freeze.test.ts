import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Fixes A and B for the ACJL freeze (techlead's scope, 18 October 2026).
 * The statute page's text stops mounting while the phone chat covers it
 * (Arthur, 18 October 2026: on the ACJL the whole iPhone screen froze and the
 * app had to be force-closed). The chat makes the page under it inert, and
 * WebKit slows down with every batch inserted into an inert subtree; with the
 * mount paused nothing is inserted until the chat closes. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8').replace(/\r\n/g, '\n');

test('the batch loop waits while the page is under the phone chat, and resumes after', () => {
  const document = read('StatuteDocument.tsx');
  assert.match(document, /pauseMount = false,/);
  assert.match(
    document,
    /useEffect\(\(\) => \{\s*if \(pauseMount \|\| blocks\.length === 0 \|\| mountedCount >= blocks\.length\) return;/,
  );
  // Re-armed when the pause lifts: the flag is in the loop's dependencies.
  assert.match(document, /\}, \[pauseMount, mountedCount, blocks\.length\]\);/);
});

test('under the phone chat the statute text leaves the screen reader and Tab, stays painted, and stops mounting', () => {
  const screen = read('StatuteScreen.tsx');
  // WebKit repaints a long statute that is inert or hidden very slowly when the
  // open chat changes the root's colour: 45 to 50 s on the ACJL.
  assert.doesNotMatch(screen, /\binert=/);
  assert.doesNotMatch(screen, /'invisible'/);
  assert.match(
    screen,
    /<article\s+aria-label=\{detail\.title\}\s+aria-hidden=\{pageUnderChat \|\| undefined\}\s+onFocusCapture=\{pageUnderChat \? returnFocusToChat : undefined\}/,
  );
  // Focus that lands in it goes back to the chat, the modal dialog in the same column.
  assert.match(screen, /event\.currentTarget\.parentElement\s*\?\.querySelector<HTMLElement>\('\[aria-modal="true"\]'\)\s*\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(screen, /pauseMount=\{pageUnderChat\}/);
});

/* The ACJL's parse is one 1.13 s task (Chromium, CPU 4x). Run in the render
 * that received the text, it landed on the tap that opened the chat. */
test('the text is parsed in its own idle task, after the chat has opened', () => {
  const document = read('StatuteDocument.tsx');
  // Text already cached at mount parses at once; new text waits for the idle task.
  assert.match(document, /const \[parsedXml, setParsedXml\] = useState<string \| null>\(\(\) => xml\);/);
  assert.match(
    document,
    /return afterIdle\(\(\) => setParsedXml\(xml\), pauseMount \? CHAT_OPEN_MS : 0\);\s*\}, \[xml, parsedXml, pauseMount\]\);/,
  );
  assert.match(document, /useMemo\(\(\) => \(parsedXml !== null \? parseAkn\(parsedXml\) : null\), \[parsedXml\]\)/);
  assert.doesNotMatch(document, /parseAkn\(xml\)/);
  // Until it has run, the reader sees the text's skeleton, never "can't be displayed".
  assert.match(document, /if \(query\.isPending \|\| parsing\) \{\s*return <DocumentBodySkeleton \/>;/);
});

test("the chat's code is fetched while the statute page is idle, before any tap", () => {
  const screen = read('StatuteScreen.tsx');
  assert.match(screen, /useIdlePreloadCaseChat\(hasAccount\);/);
  const core = readFileSync(join(here, '..', '..', 'cases', 'detail', 'CaseChatCore.tsx'), 'utf8');
  assert.match(core, /if \(!preloadAllowed\(connection\)\) return;/);
  assert.match(core, /window\.requestIdleCallback\(preloadCaseChat, \{ timeout: IDLE_PRELOAD_TIMEOUT_MS \}\)/);
  assert.match(core, /window\.setTimeout\(preloadCaseChat, PRELOAD_FALLBACK_MS\)/);
});
