import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { serviceWorkerBodyFor, SELF_DESTRUCT_SOURCE, SW_TOKEN_PLACEHOLDER, type WorkerGate } from './serve';

/* Speed step 6, part 1 (Stay, 17 October 2026, "Yes build"): the files'
 * `?dpl=` is an asset token that holds across pushes, not the commit, so a
 * phone keeps the files that did not change. Two safeguards: one setting
 * makes every phone fetch fresh (the token, which also renames the worker's
 * cache), and a check fails a build whose file kept its name but changed. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const inside: WorkerGate = { uiCookie: 'v2', perfValue: undefined, v2Enabled: true, swSetting: undefined };

test('the asset tag is a token that holds across pushes, and one setting changes it', () => {
  const config = read('next.config.ts');
  assert.match(config, /const ASSET_TOKEN_DEFAULT = "1";/);
  assert.match(config, /immutableAssetToken: resolveAssetToken\(phase\),/);
  assert.match(config, /process\.env\.LAWEXA_ASSET_TOKEN\?\.trim\(\)\.replace\(\/\[\^A-Za-z0-9_-\]\/g, ""\)/);
  // `next start` reads the build's token back, as it does the deployment id.
  assert.match(config, /const token = files\?\.config\?\.experimental\?\.immutableAssetToken;/);
  // The commit still drives skew protection.
  assert.match(config, /\.\.\.\(buildId \? \{ deploymentId: buildId \} : \{\}\),/);
});

test('the worker cache is named for the token, so a new token replaces it', () => {
  const worker = `const CACHE = 'lawexa-static-v1-${SW_TOKEN_PLACEHOLDER}';`;
  assert.equal(serviceWorkerBodyFor(inside, worker, 'a1'), "const CACHE = 'lawexa-static-v1-a1';");
  assert.equal(serviceWorkerBodyFor(inside, worker, 'a2'), "const CACHE = 'lawexa-static-v1-a2';");
  // Nothing but letters, digits, _ and - reaches the worker's source.
  assert.equal(serviceWorkerBodyFor(inside, worker, "a1';x()"), "const CACHE = 'lawexa-static-v1-a1x';");
  // The removing worker is the same whatever the token.
  assert.equal(serviceWorkerBodyFor({ ...inside, uiCookie: undefined }, worker, 'a1'), SELF_DESTRUCT_SOURCE);
  // The route hands it the build's token.
  assert.match(read('app', 'sw.js', 'route.ts'), /process\.env\.NEXT_IMMUTABLE_ASSET_TOKEN \?\? '',/);
  // Activate deletes every other lawexa- cache: the old token's goes.
  assert.match(
    read('v2', 'runtime', 'sw', 'lawexa-sw.js'),
    /\.filter\(\(name\) => name\.startsWith\('lawexa-'\) && name !== CACHE && name !== META\)/,
  );
});
