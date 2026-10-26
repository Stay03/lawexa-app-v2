import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* A first visit follows the device's light or dark setting (Stay, 26 October
 * 2026: "Device"); a reader's own pick still wins, which next-themes does by
 * storing it. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the theme starts from the device, and the device may be followed', () => {
  const provider = read('providers', 'ThemeProvider.tsx');
  assert.match(provider, /defaultTheme="system"\s+enableSystem/);
  assert.doesNotMatch(provider, /defaultTheme="dark"/);
});

test('the bar colour in v2 follows the device on first paint and the theme on screen after it', () => {
  const layout = read('app', 'v2', 'layout.tsx');
  assert.match(layout, /\{ media: '\(prefers-color-scheme: light\)', color: '#ffffff' \}/);
  assert.match(layout, /\{ media: '\(prefers-color-scheme: dark\)', color: '#0a0a0a' \}/);
});
