import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* One report of a space's Radar (Radar in Spaces, first part, F5, 26 October
 * 2026). Read through GET /radars/{radar}/scans/{scan}, which answers every
 * member in the owner's full shape (Backend), so what a member may DO comes
 * from the space Radar's can_triage and can_manage, never from that shape. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const report = read('v2', 'features', 'radars', 'report', 'ScanReportScreen.tsx');

test('the report page in a space wraps the same page in the space scope', () => {
  const screen = read('v2', 'features', 'spaces', 'detail', 'radars', 'SpaceRadarReportScreen.tsx');
  assert.match(screen, /<RadarScopeProvider scope=\{\{ kind: 'space', spaceUuid \}\}>\s*<ScanReportScreen radarUuid=\{radarUuid\} scanUuid=\{scanUuid\} \/>/);
  assert.match(
    read('app', 'v2', '(collab)', 'spaces', '[spaceId]', 'radars', '[radarUuid]', 'scans', '[scanUuid]', 'page.tsx'),
    /<SpaceRadarReportScreen\s+key=\{`\$\{spaceId\}:\$\{radarUuid\}:\$\{scanUuid\}`\}\s+spaceUuid=\{spaceId\}\s+radarUuid=\{radarUuid\}\s+scanUuid=\{scanUuid\}\s+\/>/,
  );
});

test("a Viewer reads the report and gets no toolbar, no share and no mark-read", () => {
  assert.match(report, /const canTriage = scope\.kind === 'personal' \|\| spaceRadar\?\.can_triage === true;/);
  assert.match(report, /const canManage = scope\.kind === 'personal' \|\| spaceRadar\?\.can_manage === true;/);
  // Opening an unread report marks it read only for one who may triage (a
  // Viewer's triage is a 403 until the per-member read step).
  assert.match(report, /const shouldMarkRead =\s*canTriage &&/);
  assert.match(report, /\{ownerScan && \(canTriage \|\| canManage\) \? \(/);
  assert.match(report, /\{canTriage \? <ScanTriageToolbar radarUuid=\{radarUuid\} scan=\{ownerScan\} \/> : null\}/);
  assert.match(report, /\{canManage \? <ShareDialog radarUuid=\{radarUuid\} scan=\{ownerScan\} \/> : null\}/);
});

test('the report leads back into the space, not to /radars', () => {
  assert.equal((report.match(/hrefs\.radar\(radarUuid\)/g) ?? []).length, 2);
  assert.doesNotMatch(report, /href=\{`\/radars\/\$\{radarUuid\}`\}/);
  assert.match(report, /<Link href=\{hrefs\.list\}>Back to the space&apos;s Radars<\/Link>/);
});

test('one report, its triage and its share call /radars, with a note to switch later', () => {
  const scope = read('v2', 'features', 'radars', 'scope.ts');
  for (const call of ['getScan', 'triageScan', 'publishScan', 'unpublishScan']) {
    assert.match(scope, new RegExp(`    ${call}: radarsApi\\.${call},`), call);
  }
  assert.match(scope, /If the per-member read step \(B3\) adds one, switch these four\./);
  assert.doesNotMatch(read('lib', 'api', 'radars.ts'), /getScan: async \(spaceUuid: string/);
});
