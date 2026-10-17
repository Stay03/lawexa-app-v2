#!/usr/bin/env node
/* The push-time check for kept app files (speed step 6, part 1; the techlead, 17 October 2026).
 *
 * Production serves /asset-hashes.json: every /_next/static path it serves with the sha256 of its bytes
 * (scripts/write-asset-hashes.mjs runs in the build). Around a push:
 *
 *   1. BEFORE the push:   node scripts/check-live-assets.mjs save before.json
 *        One GET of the live manifest, saved. A live build from before the manifest existed answers 404:
 *        that is recorded, and the after step says there is nothing to compare (the first deploy starts the
 *        record).
 *   2. Push as usual.
 *   3. AFTER the push:    node scripts/check-live-assets.mjs after before.json <pushed sha>
 *        Waits until the live page's data-dpl-id is the pushed commit (one GET every 30 s, up to 20 min),
 *        fetches the new manifest (one GET) and compares it with the saved one (check-static-names.mjs).
 *        FAIL means a file kept its address but changed: bump LAWEXA_ASSET_TOKEN and push again at once.
 *
 * It never pushes and never writes anything to production: GETs only, a desktop Chrome user agent, at most
 * one request at a time. ORIGIN overrides https://lawexa.com (for a local server).
 * Exit: 0 pass (or nothing to compare yet), 1 fail, 2 usage or fetch error, 3 the deploy never showed. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGIN = (process.env.ORIGIN ?? 'https://lawexa.com').replace(/\/$/, '');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
// A dynamic route: its HTML carries data-dpl-id (which-deploy.sh explains why a prerender would not).
const PAGE = process.env.DEPLOY_PAGE ?? '/cases/efcc-v-peter';
const POLL_MS = 30_000;
const WAIT_MS = 20 * 60_000;
const [mode, file, sha] = process.argv.slice(2);

async function get(path) {
  return fetch(`${ORIGIN}${path}`, { headers: { 'User-Agent': UA, Accept: '*/*' }, cache: 'no-store' });
}

async function manifest() {
  const response = await get(`/asset-hashes.json?t=${Date.now()}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET /asset-hashes.json answered ${response.status}`);
  return response.json();
}

async function liveCommit() {
  const response = await get(PAGE);
  const html = await response.text();
  return html.match(/data-dpl-id="([0-9a-f]{40})"/)?.[1] ?? null;
}

/**
 * `build` (the last step of package.json "build"): the new build's public/asset-hashes.json against the
 * manifest of the build that is live right now, before the platform swaps them. A same name with changed
 * bytes FAILS THE BUILD, so the platform never deploys it.
 *
 * Runs only on the server's own builds: on when Coolify's commit variable is set (SOURCE_COMMIT or
 * COOLIFY_GIT_COMMIT_SHA), against the app's own URL (NEXT_PUBLIC_APP_URL), so a staging build checks
 * against staging. LAWEXA_ASSET_CHECK_ORIGIN names another origin, or `off`. A local `npm run build` bakes
 * in local settings, so its bytes differ from production's by design: it is never compared.
 *
 * Passes when the token changed (every address is new: the way out of a real mismatch is to bump
 * LAWEXA_ASSET_TOKEN in the same push), and WARNS AND PASSES when the live manifest cannot be read (a first
 * deploy, or a site that is down and needs this very fix), so a fix can always ship. The after-deploy
 * compare stays the second net.
 *
 * THE OUTCOME IS SERVED. Nobody here reads the server's build log, so the step writes what it did into the
 * manifest itself, as `build_check`: "passed", "passed:token-changed", "skipped:<reason>" or
 * "not_checked:<reason>" (a failure never deploys, so it is never served). The after step prints it and
 * exits non-zero when it is not a pass, so a check that silently did not run on production shows at push time.
 */
const MANIFEST = join('public', 'asset-hashes.json');

function record(outcome) {
  const current = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  writeFileSync(MANIFEST, `${JSON.stringify({ ...current, build_check: outcome })}\n`);
}

async function buildCheck() {
  const setting = process.env.LAWEXA_ASSET_CHECK_ORIGIN?.trim();
  const onServer = Boolean(process.env.SOURCE_COMMIT || process.env.COOLIFY_GIT_COMMIT_SHA);
  const origin = setting === 'off' ? null : setting || (onServer ? process.env.NEXT_PUBLIC_APP_URL?.trim() : null);
  if (!origin) {
    const reason = setting === 'off' ? 'off' : onServer ? 'no-app-url' : 'not-a-server-build';
    console.log(`check-live-assets build: skipped (${reason})`);
    record(`skipped:${reason}`);
    return;
  }
  const next = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  let live;
  let unread = '';
  try {
    const response = await fetch(`${origin.replace(/\/$/, '')}/asset-hashes.json?t=${Date.now()}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    live = response.ok ? await response.json() : null;
    if (!live) unread = `http-${response.status}`;
  } catch (error) {
    unread = error.name === 'TimeoutError' ? 'timeout' : 'unreachable';
  }
  if (!live) {
    console.warn(`\n!!! check-live-assets build: could not read ${origin}/asset-hashes.json (${unread}); NOT CHECKED. Run the after-deploy compare.\n`);
    record(`not_checked:${unread}`);
    return;
  }
  if (live.assetToken !== next.assetToken) {
    console.log(`check-live-assets build: token ${live.assetToken} -> ${next.assetToken}, every address is new; nothing can be stale`);
    record('passed:token-changed');
    return;
  }
  const liveFile = join(tmpdir(), `asset-hashes-live-${Date.now()}.json`);
  writeFileSync(liveFile, JSON.stringify(live));
  console.log(`check-live-assets build: against ${origin} (live ${live.deploymentId})`);
  const result = spawnSync(process.execPath, [join(import.meta.dirname, 'check-static-names.mjs'), MANIFEST, liveFile], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(1);
  record('passed');
}

try {
  if (mode === 'save' && file) {
    const live = await manifest();
    writeFileSync(file, JSON.stringify(live ?? { missing: true }));
    console.log(live
      ? `saved the live manifest: ${Object.keys(live.files ?? {}).length} files, commit ${live.deploymentId}, token ${live.assetToken} -> ${file}`
      : `the live build has no /asset-hashes.json yet (404), recorded in ${file}; the after step will have nothing to compare`);
  } else if (mode === 'build') {
    await buildCheck();
  } else if (mode === 'after' && file && /^[0-9a-f]{7,40}$/.test(sha ?? '')) {
    const before = JSON.parse(readFileSync(file, 'utf8'));
    const deadline = Date.now() + WAIT_MS;
    let commit = await liveCommit();
    while (!commit?.startsWith(sha) && Date.now() < deadline) {
      console.log(`live is ${commit ?? 'unknown'}, waiting for ${sha}...`);
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      commit = await liveCommit();
    }
    if (!commit?.startsWith(sha)) {
      console.error(`the deploy of ${sha} did not show within 20 min (live is ${commit ?? 'unknown'})`);
      process.exit(3);
    }
    const after = await manifest();
    if (!after) {
      console.error(`live is ${commit} but serves no /asset-hashes.json: the build did not run scripts/write-asset-hashes.mjs (is the platform running "npm run build"?)`);
      process.exit(2);
    }
    const inBuild = typeof after.build_check === 'string' ? after.build_check : 'missing';
    const inBuildPassed = inBuild === 'passed' || inBuild.startsWith('passed:');
    console.log(`live is ${commit}, token ${after.assetToken}, ${Object.keys(after.files ?? {}).length} files, in-build check: ${inBuild}`);
    if (before.missing) {
      console.log('nothing to compare: the build before this one had no manifest. This deploy starts the record; the next push is checked.');
      process.exit(0);
    }
    if (!inBuildPassed) console.error(`the in-build check did not pass on the server (${inBuild}): it did not guard this deploy.`);
    if (before.assetToken !== after.assetToken) {
      console.log(`the token changed (${before.assetToken} -> ${after.assetToken}): every address is new, so nothing can be stale.`);
      process.exit(inBuildPassed ? 0 : 4);
    }
    const afterFile = join(tmpdir(), `asset-hashes-after-${Date.now()}.json`);
    writeFileSync(afterFile, JSON.stringify(after));
    const result = spawnSync(process.execPath, [join(import.meta.dirname, 'check-static-names.mjs'), afterFile, file], { stdio: 'inherit' });
    // The compare's own failure first; then a deploy the in-build check did not guard.
    process.exit(result.status !== 0 ? (result.status ?? 2) : inBuildPassed ? 0 : 4);
  } else {
    console.error('usage: node scripts/check-live-assets.mjs save <before.json>\n       node scripts/check-live-assets.mjs after <before.json> <pushed sha>');
    process.exit(2);
  }
} catch (error) {
  console.error(`check-live-assets: ${error.message}`);
  process.exit(2);
}
