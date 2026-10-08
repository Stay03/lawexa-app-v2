import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard for the full-screen reader's motion (FencedBlock.tsx). Animation
// cannot run under node:test; the frame logs before and after are in the
// commit. This pins the rule they measured.
const here = dirname(fileURLToPath(import.meta.url));
const block = readFileSync(join(here, 'FencedBlock.tsx'), 'utf8');

/** The reader surface's class strings, from its className cn(...) call. */
function surfaceClasses(): string[] {
  const at = block.indexOf('<DialogSurface');
  const cnAt = block.indexOf('className={cn(', at);
  const end = block.indexOf(')}', cnAt);
  return [...block.slice(cnAt, end).matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

test('on a phone the reader slides in opaque: every fade is behind sm: or motion-reduce:', () => {
  const tokens = surfaceClasses().join(' ').split(/\s+/);
  const fades = tokens.filter((t) => /fade-(in|out)/.test(t));
  assert.ok(fades.length > 0, 'the desktop and reduced-motion fades are missing');
  for (const t of fades) assert.match(t, /^(sm|motion-reduce):/, t);
  assert.ok(tokens.includes('data-open:slide-in-from-bottom-[100%]'));
  assert.ok(tokens.includes('data-closed:slide-out-to-bottom-[100%]'));
});

test('the document still fills the reader one render after it opens', () => {
  assert.match(block, /const readerFilled = useDeferredValue\(maximized\);/);
  assert.match(block, /\{readerFilled \? \(\s*<DocumentBody/);
});
