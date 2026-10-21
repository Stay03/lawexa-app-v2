import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/* A <p> may hold only text-level content. A block inside it, a <div> or a
 * Skeleton (which renders a <div>), is closed out of the <p> by the browser's
 * HTML parser, so the page the browser builds no longer matches the server's
 * HTML and React throws #418 when it hydrates. The folder page's skeleton did
 * this on every load (21 October 2026). The runner cannot render .tsx, so this
 * reads the source: no <p> whose first child is a <div> or a Skeleton. */

const root = join(process.cwd(), 'v2');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

test('no <p> in v2 opens straight into a <div> or a Skeleton', () => {
  const offenders = tsxFiles(root).filter((file) =>
    /<p(?:\s[^>]*)?>\s*(?:\{[^{}]*\?\s*\(\s*)?<(?:div|Skeleton)\b/.test(readFileSync(file, 'utf8')),
  );
  assert.deepEqual(offenders.map((file) => relative(process.cwd(), file)), []);
});

test("the folder page's loading heading is a <div> around its bar", () => {
  const states = readFileSync(join(root, 'features', 'folders', 'detail', 'states.tsx'), 'utf8');
  assert.match(states, /<div className=\{FOLDER_HEADING_TYPE\}>\s*<Skeleton className="inline-block h-\[0\.9em\]/);
});
