import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* A space's own page stays open to every member, but without the Team
 * Channels flag the backend refuses every channel route (B0). So on
 * `/spaces/{uuid}` without the flag the app sends no channel request and draws
 * no channel chrome (Spaces F1, 12 October 2026). Since Spaces F2 the same
 * answer also needs a TEAM space (`spaceShowsChannels`: kind × flag), so these
 * pins follow the merged code and keep F1's guarantees. Pinned by source:
 * .tsx and React, so the wiring is what is tested. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const frame = read('v2', 'features', 'collab', 'shell', 'CollabFrame.tsx');
const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
const model = read('v2', 'features', 'spaces', 'model.ts');

test('every channel answer carries the flag: kind × flag on a space, the flag on a channel', () => {
  // The model's one predicate needs the flag, whatever the kind.
  assert.match(
    model,
    /return spaceKind\(space\) === 'team' && canOpenTeamChannels\(session\);/,
  );
  // The KNOWN answer (requests) and the drawn rail both go through it, and a
  // channel route reads the flag itself.
  assert.match(
    frame,
    /const showsChannels = isSpaceRoute\s*\?\s*space !== null\s*\?\s*spaceShowsChannels\(space, session\)\s*:\s*cachedSpace !== null && spaceShowsChannels\(cachedSpace, session\)\s*:\s*canOpenTeamChannels\(session\);/,
  );
  assert.match(
    frame,
    /const railShown = isSpaceRoute\s*\?\s*space !== null\s*\?\s*spaceShowsChannels\(space, session\)\s*:\s*spaceShowsChannels\(\{ kind: cachedSpace\?\.kind \?\? 'team' \}, session\)\s*:\s*canOpenTeamChannels\(session\);/,
  );
});

test('no channel request runs on a space route without the flag', () => {
  // Every channel read the frame and the lobby make waits for the known answer.
  assert.match(
    frame,
    /channelsQueries\.bySpace\([\s\S]*?enabled:\s*eligible &&\s*showsChannels &&/,
  );
  assert.match(
    frame,
    /channelsQueries\.mine\(\{ viewerId \}\),[\s\S]{0,400}?enabled: eligible && showsChannels,/,
  );
  // No request reads the drawn-rail guess.
  assert.doesNotMatch(frame, /enabled:[^;]*railShown/);
  // And there is no other channel read in either file: the space home has no
  // channel lobby since design B4 (17 October 2026), so it reads none.
  const channelReads = (source: string) =>
    source.match(/channelsQueries\.(bySpace|mine|threadsBySpace)\(/g) ?? [];
  assert.equal(channelReads(frame).length, 2);
  assert.equal(channelReads(screen).length, 0);
});

test('no rail, reserved width, drawer, header toggle or create dialog without the flag', () => {
  assert.match(frame, /const hasRail = !placeRefused && railShown;/);
  assert.match(frame, /\{hasRail \? \(\s*<aside/);
  assert.match(frame, /\{hasRail \? \(\s*<SpaceDrawer/);
  assert.doesNotMatch(frame, /\{placeRefused \? null : \(/);
  assert.match(frame, /const headerOpenRail = railShown \? openRail : null;/);
  assert.match(frame, /openRail: headerOpenRail,/);
  assert.match(frame, /canManage && showsChannels \? \(\s*<ChannelFormDialog/);
  // Both params are refused from the first frame without the flag, so a
  // copied link strips itself.
  assert.match(frame, /const teamChannelsOpen = canOpenTeamChannels\(session\);/);
  assert.match(frame, /canOpen: !teamChannelsOpen \? false : kindSettled \? showsChannels : undefined,/);
  assert.match(frame, /canOpen: !teamChannelsOpen\s*\?\s*\{ channel: false \}/);
  const slot = read('v2', 'features', 'collab', 'shell', 'CollabHeaderSlot.tsx');
  assert.match(slot, /if \(context\.openRail === null\) return null;/);
});

test('the space home has no channel lobby, in the page or its silhouette (design B4)', () => {
  // No Channels pill: the rail keeps the channels for whoever has them.
  assert.doesNotMatch(model, /'channels'/);
  assert.doesNotMatch(screen, /SpaceActivityBlock|SPACE_LOBBY_GRID|New channel|showsChannels/);
  // A `?tab=channels` link from before opens All.
  assert.match(screen, /const tab = parseSpaceTab\(tabParam\);/);
  const cached = read('v2', 'features', 'spaces', 'detail', 'CachedSpaceFrame.tsx');
  assert.doesNotMatch(cached, /spaceShowsChannels/);
  assert.match(cached, /tab=\{defaultSpaceTab\(\)\}/);
  const states = read('v2', 'features', 'spaces', 'detail', 'states.tsx');
  const frameStart = states.indexOf('export function SpaceScreenFrame');
  const frameBody = states.slice(frameStart, states.indexOf('/* ── Designed refusals', frameStart));
  assert.doesNotMatch(frameBody, /ChannelListSkeleton|SPACE_LOBBY_GRID|showsChannels/);
});
