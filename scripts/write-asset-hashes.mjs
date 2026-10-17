#!/usr/bin/env node
/* After `next build` (package.json "build"): writes public/asset-hashes.json, every /_next/static path with
 * the sha256 of its bytes, so the app serves a description of exactly the files it serves (speed step 6,
 * part 1; the techlead, 17 October 2026). Coolify runs this same build script, so the manifest is the
 * production build's own.
 *
 * At push time: fetch the live https://lawexa.com/asset-hashes.json before the push and again after the
 * deploy (one request each), then `node scripts/check-static-names.mjs <before.json> <after.json>`. A path in
 * both with a different hash means a phone may hold a stale file under an address it keeps for a year: bump
 * LAWEXA_ASSET_TOKEN and push again (next.config.ts).
 *
 * Holds paths, hashes, the asset token and the commit only: the browser loads those paths anyway, and the
 * commit is in every page's data-dpl-id. Public files are served `max-age=0, must-revalidate`, so a fetch of
 * it is never stale.
 *
 * Usage: node scripts/write-asset-hashes.mjs [.next dir, default .next] [out file, default public/asset-hashes.json] */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every file under `<nextDir>/static`, by its path relative to `static/` with forward slashes, to its sha256. */
export function hashStatic(nextDir) {
  const root = join(nextDir, 'static');
  const files = {};
  const walk = (folder) => {
    for (const name of readdirSync(folder).sort()) {
      const full = join(folder, name);
      if (statSync(full).isDirectory()) walk(full);
      else files[relative(root, full).split(sep).join('/')] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(root);
  return files;
}

/** The build's asset token and commit, from what `next build` wrote, or null when absent. */
export function buildIdentity(nextDir) {
  try {
    const config = JSON.parse(readFileSync(join(nextDir, 'required-server-files.json'), 'utf8'))?.config ?? {};
    return { assetToken: config.experimental?.immutableAssetToken ?? null, deploymentId: config.deploymentId ?? null };
  } catch {
    return { assetToken: null, deploymentId: null };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nextDir = process.argv[2] ?? '.next';
  const out = process.argv[3] ?? join('public', 'asset-hashes.json');
  if (!existsSync(join(nextDir, 'static'))) {
    console.error(`write-asset-hashes: no static/ folder in ${nextDir}`);
    process.exit(2);
  }
  const files = hashStatic(nextDir);
  writeFileSync(out, `${JSON.stringify({ ...buildIdentity(nextDir), files }, null, 0)}\n`);
  console.log(`write-asset-hashes: ${Object.keys(files).length} files -> ${out}`);
}
