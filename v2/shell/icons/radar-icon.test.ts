import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The Radar icon (Stay, 27 October 2026: option 14, Remix "radar-line"). One
 * local icon, used everywhere the Radar feature shows one in the new design. */

const root = process.cwd();
const files = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [join(dir, entry.name)] : [],
  );

test('no v2 screen draws Lucide\'s old Radar: every one takes the local icon', () => {
  const lucideRadar = /import\s*\{[^}]*(?:^|[\s,{])Radar(?:\s+as\s+\w+)?\s*[,}][^}]*\}?\s*from\s*'lucide-react'/m;
  const offenders = files('v2').filter((file) => lucideRadar.test(readFileSync(join(root, file), 'utf8')));
  assert.deepEqual(offenders, []);
  const users = files('v2').filter((file) => /from '@\/v2\/shell\/icons\/radar-icon'/.test(readFileSync(join(root, file), 'utf8')));
  assert.ok(users.some((file) => file.replace(/\\/g, '/').endsWith('v2/shell/nav.config.ts')));
  assert.ok(users.length >= 10, `${users.length} users`);
});

test('the icon is the Remix shape as a Lucide icon, filled with the text colour, licence noted', () => {
  const icon = readFileSync(join(root, 'v2', 'shell', 'icons', 'radar-icon.ts'), 'utf8');
  assert.match(icon, /export const Radar = createLucideIcon\('radar-line', \[/);
  assert.match(icon, /fill: 'currentColor',\s*stroke: 'none',/);
  assert.match(icon, /Remix Icon is Apache 2\.0/);
});
