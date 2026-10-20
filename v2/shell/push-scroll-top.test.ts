import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { scrollOnPathChange } from './push-scroll';

/* Stay, 20 October 2026, 19:52Z: after scrolling the case list to its second
 * page, a tapped case opened mid-page. Next skips its push scroll on every v2
 * loading screen (it measures a hidden, absolutely placed label against the
 * window, not the shell scroller), so the shell scroller kept the list's
 * offset. Every page opened by a push now starts at its top; Back and Forward
 * keep their place. */

test('a push to a new path starts at the top; Back, Forward and the first render keep their place', () => {
  assert.equal(scrollOnPathChange({ firstRender: false, traversal: false }), 'top');
  assert.equal(scrollOnPathChange({ firstRender: false, traversal: true }), 'keep');
  assert.equal(scrollOnPathChange({ firstRender: true, traversal: false }), 'keep');
});

const source = readFileSync(join(process.cwd(), 'v2', 'shell', 'scroll-memory.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('the reset runs as the page commits, on a path change only, on the shell scroller only', () => {
  // A layout effect (before Next's own check, which runs in the page below),
  // keyed on the path alone: `?chat=`, a search box or a tab keep their place.
  assert.match(source, /useLayoutEffect\(\(\) => \{[\s\S]*?scrollOnPathChange\(\{ firstRender, traversal \}\)[\s\S]*?\}, \[pathname\]\);/);
  const effect = source.slice(source.indexOf('useLayoutEffect(() => {'), source.indexOf('}, [pathname]);'));
  assert.match(effect, /document\.getElementById\(V2_SHELL_CONTENT_ID\)/);
  // Never a collab pane: its feed owns its own scroll.
  assert.doesNotMatch(effect, /V2_SCROLLER_ATTR/);
});

test('Back, Forward and reload mark the path change they bring; a click, which comes before every push, clears it', () => {
  assert.match(source, /const onPopState = \(\) => \{\s*traversing = true;/);
  assert.match(source, /if \(event\.navigationType === 'traverse' \|\| event\.navigationType === 'reload'\) traversing = true;/);
  assert.match(source, /const onAnyClick = \(\) => \{\s*traversing = false;/);
  // The effect consumes the mark, so it holds for one path change only.
  assert.match(source, /const traversal = traversing;\s*traversing = false;/);
});
