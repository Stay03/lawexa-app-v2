#!/usr/bin/env node
/* The safeguard for keeping files across pushes (speed step 6, part 1; Stay, 17 October 2026).
 *
 * Every /_next/static file is served `immutable` for a year under an address that now holds across pushes
 * (next.config.ts, the asset token). That is only safe while a file's NAME changes whenever its CONTENT does.
 * This compares a new build with the last pushed one: for every file under `static/` present in both, the
 * bytes must be the same. A name that stayed with changed bytes fails the check, and the push must not go
 * until the cause is known (or the token is bumped, which gives every file a new address).
 *
 * One expected exception: the build-id manifests (`static/<build id>/_buildManifest.js`, `_ssgManifest.js`,
 * `_clientMiddlewareManifest.json`) keep a fixed name and change every build. They are Pages Router files;
 * this app has no `pages/`. They are allowed to change ONLY if no chunk in the new build names them, which the
 * check reads itself instead of assuming.
 *
 * Usage:  node scripts/check-static-names.mjs <new build's .next> <last pushed build's .next>
 * Exit:   0 when every shared name has the same bytes, 1 when one does not, 2 on a usage or read error. */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const [nextDir, previousDir] = process.argv.slice(2);
if (!nextDir || !previousDir) {
  console.error('usage: node scripts/check-static-names.mjs <new .next> <last pushed .next>');
  process.exit(2);
}
for (const dir of [nextDir, previousDir]) {
  if (!existsSync(join(dir, 'static'))) {
    console.error(`no static/ folder in ${dir}`);
    process.exit(2);
  }
}

const BUILD_ID_MANIFESTS = new Set(['_buildManifest.js', '_ssgManifest.js', '_clientMiddlewareManifest.json']);

/** Every file under `<dir>/static`, by its path relative to `static/`, with forward slashes. */
function filesUnder(dir) {
  const root = join(dir, 'static');
  const out = new Map();
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      const full = join(folder, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.set(relative(root, full).split(sep).join('/'), full);
    }
  };
  walk(root);
  return out;
}

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

const next = filesUnder(nextDir);
const previous = filesUnder(previousDir);

// Does any chunk of the new build name a build-id manifest? Then a change in it is a real stale-file risk.
const manifestNamedByChunks = [...next.entries()].some(
  ([path, file]) => path.startsWith('chunks/') && /_buildManifest|_ssgManifest|_clientMiddlewareManifest/.test(readFileSync(file, 'utf8')),
);

let shared = 0;
const changed = [];
const allowed = [];
for (const [path, file] of next) {
  const before = previous.get(path);
  if (!before) continue;
  shared += 1;
  if (sha(file) === sha(before)) continue;
  const name = path.split('/').pop() ?? '';
  if (BUILD_ID_MANIFESTS.has(name) && !manifestNamedByChunks) allowed.push(path);
  else changed.push(path);
}

console.log(`check-static-names: ${next.size} files in the new build, ${previous.size} in the last pushed one, ${shared} names in both`);
if (allowed.length) console.log(`  allowed (build-id manifests, named by no chunk): ${allowed.join(', ')}`);
if (changed.length) {
  console.error(`FAIL: ${changed.length} file(s) kept their name but changed their content:`);
  for (const path of changed) console.error(`  static/${path}`);
  console.error('Do not push: a phone that cached the old file would keep it. Find the cause, or bump LAWEXA_ASSET_TOKEN.');
  process.exit(1);
}
console.log(`OK: every one of the ${shared - allowed.length} shared names has the same bytes`);
