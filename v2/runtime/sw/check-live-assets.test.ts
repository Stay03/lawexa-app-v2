import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* The build-time safeguard of speed step 6, part 1 (the techlead, 17 October
 * 2026): the server's build compares its own manifest with the live one and
 * fails when a file kept its address but changed, so it is never deployed. It
 * passes when the token changed, and warns and passes when the live manifest
 * cannot be read, so a fix can always ship (scripts/check-live-assets.mjs). */

const SCRIPT = join(process.cwd(), 'scripts', 'check-live-assets.mjs');

type Manifest = { assetToken: string; deploymentId: string; files: Record<string, string> };
const manifest = (token: string, files: Record<string, string>): Manifest => ({ assetToken: token, deploymentId: 'live', files });
const H = (c: string) => c.repeat(64);

/** Runs the build step in a folder holding `next` as public/asset-hashes.json, against a server answering `live`. */
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
    return await new Promise<{ status: number | null; out: string }>((resolve) => {
      const childEnv: NodeJS.ProcessEnv = { ...process.env, LAWEXA_ASSET_CHECK_ORIGIN: origin, ...env };
      // Only the variables a test names: the runner's own Coolify-like ones must not leak in.
      delete childEnv.SOURCE_COMMIT;
      delete childEnv.COOLIFY_GIT_COMMIT_SHA;
      Object.assign(childEnv, env);
      const child = spawn(process.execPath, [SCRIPT, 'build'], { cwd: dir, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (out += chunk.toString()));
      child.on('close', (status: number | null) => resolve({ status, out }));
    });
  } finally {
    server?.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the same names with the same bytes as live pass the build', async () => {
  const result = await buildCheck(manifest('a1', { 'chunks/a.js': H('1'), 'chunks/new.js': H('2') }), manifest('a1', { 'chunks/a.js': H('1') }));
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /OK: every one of the 1 shared names has the same bytes/);
});

test('a name that kept its address with changed bytes fails the build', async () => {
  const result = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }));
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /static\/chunks\/a\.js/);
});

test('a new token passes, since every address is new: the way out of a real mismatch', async () => {
  const result = await buildCheck(manifest('a2', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }));
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /token a1 -> a2, every address is new/);
});

test('an unreadable live manifest warns loudly and lets the build through', async () => {
  for (const live of [404, 'down'] as const) {
    const result = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), live);
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /!!! check-live-assets build: .*NOT CHECKED/);
  }
});

test('a build that is not the server\'s own is never compared', async () => {
  const result = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }), { LAWEXA_ASSET_CHECK_ORIGIN: '' });
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /skipped \(not a server build/);
  const off = await buildCheck(manifest('a1', { 'chunks/a.js': H('9') }), manifest('a1', { 'chunks/a.js': H('1') }), { LAWEXA_ASSET_CHECK_ORIGIN: 'off', SOURCE_COMMIT: 'abc' });
  assert.equal(off.status, 0, off.out);
});
