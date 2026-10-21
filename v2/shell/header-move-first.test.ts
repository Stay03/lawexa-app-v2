import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pushedScreenFor } from './pushed-route';
import { hasOpenBar } from './top-level-route';

/* Stay, 20 October 2026, 23:57Z: "the lawexa logo at the top is slow to go off
 * when switching pages". On a phone, a tapped case's frame showed at once, but
 * the bar kept the list's menu button and Lawexa mark for about 1 s on live
 * (the server round trip), then swapped to the back arrow. The bar now draws
 * for the tap's destination while the frame shows. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const moveFirst = read('move-first.tsx');
const header = read('V2Header.tsx');
const frame = read('ShellFrame.tsx');

test('the shown path is the tap destination while the frame shows, else the pathname', () => {
  const hook = moveFirst.slice(moveFirst.indexOf('export function useShownPathname'));
  assert.match(hook, /const pending = useContext\(MoveFirstPendingContext\);/);
  assert.match(hook, /return pending \? new URL\(pending\.href, 'http:\/\/x'\)\.pathname : pathname;/);
});

test('the bar decides every slot from the shown path, never the raw pathname', () => {
  assert.match(header, /const pathname = useShownPathname\(\);/);
  assert.doesNotMatch(header, /usePathname\(/);
  // The see-through ground follows the same path; the chat flag stays on the committed one.
  assert.match(frame, /data-v2-open-bar=\{hasOpenBar\(shown\) \? '' : undefined\}/);
  assert.match(frame, /data-v2-chat=\{isChatRoute\(pathname\)/);
});

test('a case is a pushed screen, so its bar has the back arrow and no Lawexa mark', () => {
  // What the bar now shows from the tap's first frame on /cases/{slug}.
  assert.notEqual(pushedScreenFor('/cases/adeyemi-v-state'), null);
  assert.equal(pushedScreenFor('/cases'), null);
  // The list and the case share the open bar, so the ground does not change mid-move.
  assert.equal(hasOpenBar('/cases'), hasOpenBar('/cases/adeyemi-v-state'));
});
