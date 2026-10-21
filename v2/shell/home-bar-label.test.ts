import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { homeBarLabel, homeTabForPath } from './home-tabs';

/* Tester, 20 October 2026 (finding 16): the computer bar said "Home" on the
 * Work and Study tabs too. */

test('each home tab names itself in the bar', () => {
  assert.equal(homeBarLabel('chat'), 'Home');
  assert.equal(homeBarLabel('work'), 'Work');
  assert.equal(homeBarLabel('study'), 'Study');
  assert.equal(homeBarLabel(homeTabForPath('/study')!), 'Study');
});

test('the bar reads the label from the tab, not a fixed "Home"', () => {
  const header = readFileSync(join(process.cwd(), 'v2', 'shell', 'V2Header.tsx'), 'utf8');
  assert.match(header, /const leftLabel = homeTab \? homeBarLabel\(homeTab\) : isCase \? 'Case' : null;/);
  assert.doesNotMatch(header, /isHome \? 'Home'/);
});
