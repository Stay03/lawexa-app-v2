import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* A space's own page stays open to every member, but without the Team
 * Channels flag the backend refuses every channel route (B0). So on
 * `/spaces/{uuid}` without the flag the app sends no channel request and draws
 * no channel chrome (Spaces F1, 12 October 2026). Pinned by source: .tsx and
 * React, so the wiring is what is tested. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const frame = read('v2', 'features', 'collab', 'shell', 'CollabFrame.tsx');
const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');

test('the frame reads the flag once, from the session', () => {
  assert.match(frame, /const showsChannels = canOpenTeamChannels\(session\);/);
});

test('no channel request runs on a space route without the flag', () => {
  // Every channel read the frame and the lobby make carries the flag.
  assert.match(
    frame,
    /channelsQueries\.bySpace\([\s\S]*?enabled:\s*eligible &&\s*showsChannels &&/,
  );
  assert.match(
    frame,
    /channelsQueries\.mine\(\{ viewerId \}\),[\s\S]{0,200}?enabled: canOpenTeamChannels\(session\),/,
  );
  assert.match(screen, /const showsChannels = canOpenTeamChannels\(session\);/);
  assert.match(
    screen,
    /channelsQueries\.threadsBySpace\([\s\S]*?enabled: eligible && showsChannels && space !== null,/,
  );
  // And there is no other channel read in either file.
  const channelReads = (source: string) =>
    source.match(/channelsQueries\.(bySpace|mine|threadsBySpace)\(/g) ?? [];
  assert.equal(channelReads(frame).length, 2);
  assert.equal(channelReads(screen).length, 1);
});

test('no rail, reserved width, drawer, header toggle or create dialog without the flag', () => {
  assert.match(frame, /const hasRail = !placeRefused && showsChannels;/);
  assert.match(frame, /\{hasRail \? \(\s*<aside/);
  assert.match(frame, /\{hasRail \? \(\s*<SpaceDrawer/);
  assert.doesNotMatch(frame, /\{placeRefused \? null : \(/);
  assert.match(frame, /const headerOpenRail = showsChannels \? openRail : null;/);
  assert.match(frame, /openRail: headerOpenRail,/);
  assert.match(frame, /canManage && showsChannels \? \(\s*<ChannelFormDialog/);
  // Both params are refused without it, so a copied link strips itself.
  assert.match(frame, /useUrlOverlay\('rail', \{ canOpen: showsChannels \}\)/);
  assert.match(frame, /canOpen: !showsChannels\s*\?\s*\{ channel: false \}/);
  const slot = read('v2', 'features', 'collab', 'shell', 'CollabHeaderSlot.tsx');
  assert.match(slot, /if \(context\.openRail === null\) return null;/);
});

test('the lobby: no digest and no "New channel" without the flag, in the page and its silhouette', () => {
  assert.match(screen, /canCreateChannel=\{canManage && showsChannels\}/);
  assert.match(screen, /\{showsChannels \? \(\s*<div className=\{SPACE_LOBBY_GRID\}>\s*<SpaceActivityBlock/);
  assert.match(screen, /<div className=\{SPACE_LOBBY_SOLO\}>\{lobbySide\}<\/div>/);
  assert.match(screen, /<SpaceScreenFrame identity=\{cachedIdentity\} showsChannels=\{showsChannels\} \/>/);
  const states = read('v2', 'features', 'spaces', 'detail', 'states.tsx');
  assert.match(states, /\{showsChannels \? <Skeleton className="h-8 w-32 rounded-md" \/> : null\}/);
  assert.match(states, /\{showsChannels \? \(\s*<div className=\{SPACE_LOBBY_GRID\}>[\s\S]*?<ChannelListSkeleton \/>/);
  const cached = read('v2', 'features', 'spaces', 'detail', 'CachedSpaceFrame.tsx');
  assert.match(cached, /const showsChannels = canOpenTeamChannels\(useV2Session\(\)\);/);
  assert.match(cached, /showsChannels=\{showsChannels\}/);
});
