import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* The build-time safeguard of speed step 6, part 1 (the techlead, 17 October
 * 2026): the server's build compares its own manifest with the live one and
 * fails when a file kept its address but changed, so it is never deployed. It
 * passes when the token changed, and warns and passes when the live manifest
 * cannot be read, so a fix can always ship. What it did is written into the
 * served manifest as `build_check`, so the push-time script can tell whether
 * the check ran on production (scripts/check-live-assets.mjs). */

const SCRIPT = join(process.cwd(), 'scripts', 'check-live-assets.mjs');

type Manifest = { assetToken: string; deploymentId: string; files: Record<string, string>; build_check?: string };
const manifest = (token: string, files: Record<string, string>): Manifest => ({ assetToken: token, deploymentId: 'live', files });
const H = (c: string) => c.repeat(64);

/**
 * Runs the build step in a folder holding `next` as public/asset-hashes.json,
 * against a server answering `live`, and returns the exit status, the output
 * and the `build_check` the step wrote into the manifest.
 */
async function buildCheck(next: Manifest, live: Manifest | 404 | 'down', env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'live-assets-'));
  mkdirSync(join(dir, 'public'));
  writeFileSync(join(dir, 'public', 'asset-hashes.json'), JSON.stringify(next));
  let server: Server | null = null;
  let origin = 'http://127.0.0.1:9';
  if (live !== 'down') {
    server = createServer((_request, response) => {
      if (live === 404) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(live));
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  }
  try {
    const run = await new Promise<{ status: number | null; out: string }>((resolve) => {
      const childEnv: NodeJS.ProcessEnv = { ...process.env, LAWEXA_ASSET_CHECK_ORIGIN: origin };
      // Only the variables a test names: the runner's own Coolify-like ones must not leak in.
      delete childEnv.SOURCE_COMMIT;
      delete childEnv.COOLIFY_GIT_COMMIT_SHA;
      delete childEnv.NEXT_PUBLIC_APP_URL;
      Object.assign(childEnv, env);
      const child = spawn(process.execPath, [SCRIPT, 'build'], { cwd: dir, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (out += chunk.toString()));
      child.on('close', (status: number | null) => resolve({ status, out }));
    });
    const written = JSON.parse(readFileSync(join(dir, 'public', 'asset-hashes.json'), 'utf8')) as Manifest;
    return { ...run, recorded: written.build_check };
  } finally {
    server?.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the same names with the same bytes as live pass the build: "passed"', async () => {
  const result = await buildCheck(manifest('a1', { 'chunks/a.js': H('1'), 'chunks/new.js': H('2') }), manifest('a1', { 'chunks/a.js': H('1') }));
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /OK: every one of the 1 shared names has the same bytes/);
  assert.equal(result.recorded, 'passed');
});

test('a name that kept its address with changed bytes fails the build, and records no pass', async () => {
  const result = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }));
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /static\/chunks\/a\.js/);
  assert.equal(result.recorded, undefined);
});

test('a new token passes, since every address is new: "passed:token-changed"', async () => {
  const result = await buildCheck(manifest('a2', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }));
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /token a1 -> a2, every address is new/);
  assert.equal(result.recorded, 'passed:token-changed');
});

test('an unreadable live manifest warns loudly, lets the build through, and says so: "not_checked:<reason>"', async () => {
  const missing = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), 404);
  assert.equal(missing.status, 0, missing.out);
  assert.match(missing.out, /!!! check-live-assets build: .*NOT CHECKED/);
  assert.equal(missing.recorded, 'not_checked:http-404');

  const down = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), 'down');
  assert.equal(down.status, 0, down.out);
  assert.equal(down.recorded, 'not_checked:unreachable');
});

test('a build that is not the server\'s own is never compared, and says why: "skipped:<reason>"', async () => {
  const local = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }), { LAWEXA_ASSET_CHECK_ORIGIN: '' });
  assert.equal(local.status, 0, local.out);
  assert.equal(local.recorded, 'skipped:not-a-server-build');

  const off = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }), { LAWEXA_ASSET_CHECK_ORIGIN: 'off', SOURCE_COMMIT: 'abc' });
  assert.equal(off.status, 0, off.out);
  assert.equal(off.recorded, 'skipped:off');

  // On the server, but with no app URL to compare against.
  const noUrl = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }), { LAWEXA_ASSET_CHECK_ORIGIN: '', SOURCE_COMMIT: 'abc' });
  assert.equal(noUrl.status, 0, noUrl.out);
  assert.equal(noUrl.recorded, 'skipped:no-app-url');
});

test('the push-time step reports the in-build outcome and fails a deploy the check did not guard', () => {
  const source = readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n');
  assert.match(source, /const inBuildPassed = inBuild === 'passed' \|\| inBuild\.startsWith\('passed:'\);/);
  assert.match(source, /in-build check: \$\{inBuild\}/);
  // Exit 4 when the compare passed but the in-build check did not run (after the first push only).
  assert.match(source, /process\.exit\(result\.status !== 0 \? \(result\.status \?\? 2\) : inBuildPassed \? 0 : 4\);/);
  assert.ok(source.indexOf('if (before.missing)') < source.indexOf('if (!inBuildPassed)'), 'the first push is not failed for it');
});
