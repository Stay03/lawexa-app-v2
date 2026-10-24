import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Tester, live, 23 October 2026: on a computer the Contents popover grew to
 * the whole outline (3,421 px in a 900 px window on the Constitution) and did
 * not scroll, so the last six Parts were out of reach. */

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'contents', 'StatuteContents.tsx'), 'utf8');

test('the computer popover is capped to the room below the button, and its list scrolls', () => {
  const popover = source.match(/const POPOVER =\s*'([^']+)'/)?.[1] ?? '';
  assert.match(popover, /(^| )max-h-\(--radix-popover-content-available-height\)( |$)/);
  assert.match(popover, /(^| )flex-col( |$)/);
  assert.match(popover, /(^| )overflow-hidden( |$)/);
  assert.match(source, /className=\{POPOVER\}/);
  // The list takes what is left under the header and scrolls on its own.
  assert.match(source, /aria-label="Contents"\s+className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain/);
});
