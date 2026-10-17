import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/* The safeguard of speed step 6, part 1: a build in which a /_next/static file
 * kept its name but changed its bytes must fail before it is pushed, since
 * phones keep that address for a year (scripts/check-static-names.mjs). */

const SCRIPT = join(process.cwd(), 'scripts', 'check-static-names.mjs');

/** A fake `.next` with these files under `static/`. */
function build(root: string, name: string, files: Record<string, string>): string {
  const dir = join(root, name);
  for (const [path, body] of Object.entries(files)) {
    const file = join(dir, 'static', path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  return dir;
}

function check(files: { next: Record<string, string>; previous: Record<string, string> }) {
  const root = mkdtempSync(join(tmpdir(), 'static-names-'));
  try {
    const result = spawnSync(process.execPath, [SCRIPT, build(root, 'next', files.next), build(root, 'previous', files.previous)], {
      encoding: 'utf8',
    });
    return { status: result.status, out: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('same names with the same bytes pass, and new or removed names do not matter', () => {
  const result = check({
    next: { 'chunks/a1.js': 'one', 'chunks/b2.js': 'two', 'chunks/new3.js': 'new' },
    previous: { 'chunks/a1.js': 'one', 'chunks/b2.js': 'two', 'chunks/gone4.js': 'old' },
  });
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /OK: every one of the 2 shared names has the same bytes/);
});

test('a name that stayed with changed bytes fails and is named', () => {
  const result = check({
    next: { 'chunks/a1.js': 'one, changed', 'media/font.woff2': 'f' },
    previous: { 'chunks/a1.js': 'one', 'media/font.woff2': 'f' },
  });
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /FAIL: 1 file\(s\) kept their name but changed their content/);
  assert.match(result.out, /static\/chunks\/a1\.js/);
});

test('the build-id manifests may change only while no chunk names them', () => {
  const quiet = check({
    next: { 'build-x/_buildManifest.js': 'v2', 'chunks/a1.js': 'one' },
    previous: { 'build-x/_buildManifest.js': 'v1', 'chunks/a1.js': 'one' },
  });
  assert.equal(quiet.status, 0, quiet.out);
  assert.match(quiet.out, /allowed \(build-id manifests, named by no chunk\): build-x\/_buildManifest\.js/);

  const named = check({
    next: { 'build-x/_buildManifest.js': 'v2', 'chunks/a1.js': 'load("_buildManifest.js")' },
    previous: { 'build-x/_buildManifest.js': 'v1', 'chunks/a1.js': 'load("_buildManifest.js")' },
  });
  assert.equal(named.status, 1, named.out);
});

test('the build writes a manifest of every static file and its hash, and two manifests compare the same way', () => {
  // The build script runs the writer after next build, so Coolify serves its own build's manifest.
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts.build, 'next build && node scripts/write-asset-hashes.mjs && node scripts/check-live-assets.mjs build');

  const root = mkdtempSync(join(tmpdir(), 'asset-hashes-'));
  try {
    const writer = join(process.cwd(), 'scripts', 'write-asset-hashes.mjs');
    const write = (name: string, files: Record<string, string>) => {
      const dir = build(root, name, files);
      writeFileSync(join(dir, 'required-server-files.json'), JSON.stringify({ config: { deploymentId: 'abc', experimental: { immutableAssetToken: 'a1' } } }));
      const out = join(root, `${name}.json`);
      const result = spawnSync(process.execPath, [writer, dir, out], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return out;
    };
    const before = write('before', { 'chunks/a1.js': 'one', 'css/b2.css': 'two' });
    const manifest = JSON.parse(readFileSync(before, 'utf8')) as { assetToken: string; deploymentId: string; files: Record<string, string> };
    assert.equal(manifest.assetToken, 'a1');
    assert.equal(manifest.deploymentId, 'abc');
    assert.deepEqual(Object.keys(manifest.files), ['chunks/a1.js', 'css/b2.css']);
    assert.match(manifest.files['chunks/a1.js'], /^[0-9a-f]{64}$/);

    const same = write('same', { 'chunks/a1.js': 'one', 'css/b2.css': 'two', 'chunks/c3.js': 'new' });
    const pass = spawnSync(process.execPath, [SCRIPT, same, before], { encoding: 'utf8' });
    assert.equal(pass.status, 0, `${pass.stdout}${pass.stderr}`);

    const drifted = write('drifted', { 'chunks/a1.js': 'one, changed', 'css/b2.css': 'two' });
    const fail = spawnSync(process.execPath, [SCRIPT, drifted, before], { encoding: 'utf8' });
    assert.equal(fail.status, 1);
    assert.match(fail.stderr, /static\/chunks\/a1\.js/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a missing build folder is a usage error, not a pass', () => {
  const result = spawnSync(process.execPath, [SCRIPT, join(tmpdir(), 'no-such-next'), join(tmpdir(), 'no-such-prev')], { encoding: 'utf8' });
  assert.equal(result.status, 2);
});
