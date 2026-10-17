#!/usr/bin/env node
/* The safeguard for keeping files across pushes (speed step 6, part 1; Stay, 17 October 2026).
 *
 * Every /_next/static file is served `immutable` for a year under an address that now holds across pushes
 * (next.config.ts, the asset token). That is only safe while a file's NAME changes whenever its CONTENT does.
 * This compares two builds: for every file under `static/` present in both, the bytes must be the same. A
 * name that stayed with changed bytes fails the check: bump LAWEXA_ASSET_TOKEN and push, which gives every
 * file a new address.
 *
 * Each side is either a build's `.next` folder (a local build) or an asset-hashes.json manifest
 * (scripts/write-asset-hashes.mjs; production serves its own at /asset-hashes.json, so a push is checked by
 * fetching it before the push and after the deploy).
 *
 * One expected exception: the build-id manifests (`static/<build id>/_buildManifest.js`, `_ssgManifest.js`,
 * `_clientMiddlewareManifest.json`) keep a fixed name and change every build. They are Pages Router files;
 * this app has no `pages/`. With two `.next` folders they may change only if no chunk of the new build names
 * them, which the check reads itself; with manifests, which hold no file contents, they are reported apart.
 *
 * Usage:  node scripts/check-static-names.mjs <new .next | new.json> <last pushed .next | last.json>
 * Exit:   0 when every shared name has the same bytes, 1 when one does not, 2 on a usage or read error. */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hashStatic } from './write-asset-hashes.mjs';

const [nextArg, previousArg] = process.argv.slice(2);
if (!nextArg || !previousArg) {
  console.error('usage: node scripts/check-static-names.mjs <new .next | new.json> <last pushed .next | last.json>');
  process.exit(2);
}

const BUILD_ID_MANIFESTS = new Set(['_buildManifest.js', '_ssgManifest.js', '_clientMiddlewareManifest.json']);

/** One side: its path → sha256, and (for a folder) where to read a file's contents. */
function side(arg) {
  if (existsSync(arg) && statSync(arg).isDirectory()) {
    if (!existsSync(join(arg, 'static'))) {
      console.error(`no static/ folder in ${arg}`);
      process.exit(2);
    }
    return { hashes: hashStatic(arg), read: (path) => readFileSync(join(arg, 'static', path), 'utf8') };
  }
  try {
    const files = JSON.parse(readFileSync(arg, 'utf8'))?.files;
    if (!files || typeof files !== 'object') throw new Error('no "files" in it');
    return { hashes: files, read: null };
  } catch (error) {
    console.error(`cannot read ${arg} as a .next folder or an asset-hashes manifest: ${error.message}`);
    process.exit(2);
  }
}

const next = side(nextArg);
const previous = side(previousArg);

// Does any chunk of the new build name a build-id manifest? Then a change in one is a real stale-file risk.
// Unknown (manifests hold no contents) counts as "named", so a change is reported, never waved through.
const manifestNamedByChunks = next.read
  ? Object.keys(next.hashes).some((path) => path.startsWith('chunks/') && /_buildManifest|_ssgManifest|_clientMiddlewareManifest/.test(next.read(path)))
  : null;

let shared = 0;
const changed = [];
const allowed = [];
const unknown = [];
for (const [path, hash] of Object.entries(next.hashes)) {
  const before = previous.hashes[path];
  if (before === undefined) continue;
  shared += 1;
  if (hash === before) continue;
  const name = path.split('/').pop() ?? '';
  if (BUILD_ID_MANIFESTS.has(name) && manifestNamedByChunks === false) allowed.push(path);
  else if (BUILD_ID_MANIFESTS.has(name) && manifestNamedByChunks === null) unknown.push(path);
  else changed.push(path);
}

const total = (side) => Object.keys(side.hashes).length;
console.log(`check-static-names: ${total(next)} files in the new build, ${total(previous)} in the last pushed one, ${shared} names in both`);
if (allowed.length) console.log(`  allowed (build-id manifests, named by no chunk): ${allowed.join(', ')}`);
if (unknown.length) console.log(`  build-id manifests changed (expected every build; check a local .next to see whether a chunk names them): ${unknown.join(', ')}`);
if (changed.length) {
  console.error(`FAIL: ${changed.length} file(s) kept their name but changed their content:`);
  for (const path of changed) console.error(`  static/${path}`);
  console.error('A phone that cached the old file would keep it. Bump LAWEXA_ASSET_TOKEN and push (next.config.ts).');
  process.exit(1);
}
console.log(`OK: every one of the ${shared - allowed.length - unknown.length} shared names has the same bytes`);
