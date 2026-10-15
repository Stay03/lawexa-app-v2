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
  assert.match(screen, /const showsChannels = scope\?\.showsChannels \?\? false;/);
  assert.match(
    screen,
    /channelsQueries\.threadsBySpace\([\s\S]*?enabled: eligible && space !== null && showsChannels && tab === 'channels',/,
  );
  // And there is no other channel read in either file.
  const channelReads = (source: string) =>
    source.match(/channelsQueries\.(bySpace|mine|threadsBySpace)\(/g) ?? [];
  assert.equal(channelReads(frame).length, 2);
  assert.equal(channelReads(screen).length, 1);
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

test('the lobby: no digest and no "New channel" without the flag, in the page and its silhouette', () => {
  // The digest lives on the Channels tab, which exists only when channels show.
  assert.match(model, /return showsChannels \? TEAM_TABS : CONTENT_TABS;/);
  assert.match(screen, /const tab = parseSpaceTab\(tabParam, showsChannels\);/);
  assert.match(screen, /\{tab === 'channels' \? \(\s*<>[\s\S]{0,800}?<div className=\{SPACE_LOBBY_GRID\}>\s*<SpaceActivityBlock/);
  // New channel sits at the top of the Channels tab since Stay's 15 October note.
  assert.match(screen, /\{canManage && showsChannels \? \(\s*<div className="mb-4 lg:hidden">/);
  // The silhouettes ask the same predicate, so without the flag they draw no
  // channel block and no "New channel" place.
  assert.match(
    screen,
    /const pendingShowsChannels = spaceShowsChannels\(\s*\{ kind: cachedIdentity\?\.kind \?\? 'team' \},\s*session,\s*\);/,
  );
  assert.match(screen, /tab=\{parseSpaceTab\(tabParam, pendingShowsChannels\)\}/);
  const cached = read('v2', 'features', 'spaces', 'detail', 'CachedSpaceFrame.tsx');
  assert.match(
    cached,
    /const showsChannels = spaceShowsChannels\(\s*\{ kind: identity\?\.kind \?\? 'team' \},\s*session,\s*\);/,
  );
  // Every space opens on Conversations since 15 October 2026.
  assert.match(cached, /tab=\{defaultSpaceTab\(\)\}/);
  const states = read('v2', 'features', 'spaces', 'detail', 'states.tsx');
  // Design round 1: the header's "New channel" (and so its place) is shown
  // below `lg:` only, where no docked rail carries the same action.
  assert.match(states, /\{showsChannels \? <Skeleton className="mb-4 h-8 w-32 rounded-md lg:hidden" \/> : null\}/);
  assert.match(states, /\{tab === 'channels' \? \(\s*<>[\s\S]*?<div className=\{SPACE_LOBBY_GRID\}>[\s\S]*?<ChannelListSkeleton \/>/);
});
