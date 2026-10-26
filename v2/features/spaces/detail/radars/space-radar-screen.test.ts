import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PERSONAL_RADAR_SCOPE, radarHrefs } from '@/v2/features/radars/scope';

/* A space's Radar page (Radar in Spaces, first part, 26 October 2026): the
 * personal Radar screen with the space's scope. Its calls go to the space
 * routes, its links stay in the space, and what the reader may do comes from
 * the server's can_manage and can_triage. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const radars = (...parts: string[]) => read('v2', 'features', 'radars', ...parts);

test('a space Radar links inside its space; a personal one inside /radars', () => {
  const space = radarHrefs({ kind: 'space', spaceUuid: 's1' });
  assert.equal(space.list, '/spaces/s1?tab=radars');
  assert.equal(space.radar('r1'), '/spaces/s1/radars/r1');
  assert.equal(space.report('r1', 'c1'), '/spaces/s1/radars/r1/scans/c1');
  const personal = radarHrefs(PERSONAL_RADAR_SCOPE);
  assert.equal(personal.list, '/radars');
  assert.equal(personal.report('r1', 'c1'), '/radars/r1/scans/c1');
});

test('every read and action of a Radar screen calls where the Radar lives', () => {
  const actions = radars('actions.ts');
  for (const call of ['scanNow', 'pause', 'resume', 'archive', 'update']) {
    assert.match(actions, new RegExp(`radarCalls\\(scope\\)\\.${call}\\(uuid`), call);
  }
  assert.doesNotMatch(actions, /radarsApi\./);
  // The space routes refuse channels, so an edit in a space drops them.
  assert.match(actions, /if \(scope\.kind === 'space'\) \{\s*const spacePayload = \{ \.\.\.payload \};\s*delete spacePayload\.channels;/);
  assert.match(radars('naming.ts'), /\.\.\.radarsQueries\.detail\(radarUuid, \{ viewerId, scope \}\),/);
  assert.match(radars('use-radar-scans.ts'), /\.\.\.radarsQueries\.infiniteScans\(radarUuid, \{ \.\.\.params, viewerId, scope \}\),/);
  assert.match(radars('use-triage-scan.ts'), /scope = screenScope \}: TriageScanVariables\) =>/);
});

test('the page wraps the same screen in the space scope', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'radars', 'SpaceRadarScreen.tsx');
  assert.match(screen, /<RadarScopeProvider scope=\{\{ kind: 'space', spaceUuid \}\}>\s*<RadarScreen radarUuid=\{radarUuid\} \/>/);
  assert.match(
    read('app', 'v2', '(collab)', 'spaces', '[spaceId]', 'radars', '[radarUuid]', 'page.tsx'),
    /<SpaceRadarScreen key=\{`\$\{spaceId\}:\$\{radarUuid\}`\} spaceUuid=\{spaceId\} radarUuid=\{radarUuid\} \/>/,
  );
});

test('the buttons follow the server: manage behind can_manage, triage behind can_triage', () => {
  const screen = radars('detail', 'RadarScreen.tsx');
  assert.match(screen, /const canManage = radar\.can_manage \?\? true;/);
  assert.match(screen, /const canTriage = radar\.can_triage \?\? true;/);
  assert.match(screen, /\{radar\.status !== 'archived' && canManage \? \(/);
  assert.match(screen, /canTriage=\{canTriage\}/);
  const row = radars('detail', 'ScanRow.tsx');
  assert.match(row, /\{context === 'workflow' && canTriage \? \(/);
  assert.match(row, /href=\{radarHrefs\(scope\)\.report\(radarUuid, scan\.uuid\)\}/);
  // The skip row's purchase link is the personal Radar's alone.
  assert.match(row, /scan\.status === 'skipped_no_balance' && scope\.kind === 'personal'/);
});

test("the space owner's empty balance is named, and nothing is offered to buy", () => {
  const states = radars('detail', 'states.tsx');
  assert.match(states, /"The space's owner has no AI messages left\. Scans start again once the owner has messages\."/);
  assert.match(states, /\{payer === 'self' \? \(\s*<Button asChild size="sm" variant="outline" className="mt-2">/);
  assert.match(states, /`The space's owner was out of AI messages\$\{when \? ` \$\{when\}` : ''\}\.`/);
  const screen = radars('detail', 'RadarScreen.tsx');
  assert.match(screen, /\{radar\.schedule_state === 'no_balance' \? \(/);
  assert.match(screen, /<RadarNotFoundState inSpace=\{scope\.kind === 'space'\} backHref=\{hrefs\.list\} \/>/);
  assert.match(screen, /onArchived=\{\(\) => router\.push\(hrefs\.list\)\}/);
});
