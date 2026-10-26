import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The v2 gold and the text on it (tokens.css). Stay picked white text on a
 * deeper gold for light mode, 26 October 2026; dark mode is unchanged. */
const css = readFileSync(join(process.cwd(), 'v2', 'shell', 'tokens.css'), 'utf8');

const block = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf('}', start));
};

test('light mode: white text on the deeper gold, and the focus ring follows the gold', () => {
  const light = block('html.v2-document-lock');
  assert.match(light, /--primary: oklch\(0\.56 0\.13 85\);/);
  assert.match(light, /--primary-foreground: oklch\(1 0 0\);/);
  assert.match(light, /--ring: oklch\(0\.56 0\.13 85\);/);
});

test('dark mode keeps its gold and its dark text', () => {
  const dark = block('html.v2-document-lock.dark');
  assert.match(dark, /--primary: oklch\(0\.70 0\.14 82\);/);
  assert.match(dark, /--primary-foreground: oklch\(0\.20 0\.06 82\);/);
  assert.match(dark, /--ring: oklch\(0\.70 0\.14 82\);/);
});
