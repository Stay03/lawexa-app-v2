import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/* The Android statute chat's Close (Stay, 20 October 2026, 01:35 UTC): the
 * sidebar wrapper's `has-data-[variant=inset]:bg-sidebar` made Chrome recheck
 * the whole page on every DOM change under it, about 30% of the style time on
 * the ACJA. No sidebar is the inset variant, so the class went. */

const root = process.cwd();
const source = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

test('the sidebar wrapper carries no :has() class', () => {
  const sidebar = source('components', 'ui', 'sidebar.tsx');
  assert.match(sidebar, /className=\{cn\("group\/sidebar-wrapper flex min-h-svh w-full", className\)\}/);
  assert.doesNotMatch(sidebar, /"group\/sidebar-wrapper [^"]*has-/);
});

test('no sidebar anywhere is the inset variant, which needed that class', () => {
  const offenders: string[] = [];
  for (const dir of ['app', 'components', 'v2']) {
    for (const file of readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })) {
      if (!/\.tsx$/.test(file) || file.endsWith(join('ui', 'sidebar.tsx'))) continue;
      if (/variant=(\{\s*)?["']inset["']/.test(source(dir, file))) offenders.push(join(dir, file));
    }
  }
  assert.deepEqual(offenders, []);
});
