import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* One report of a space's Radar (Radar in Spaces, F5 and Backend's B3, 26
 * October 2026). Every member reads it in the owner's full shape, so what a
 * member may DO comes from can_triage and can_manage (the report's own, else
 * the space Radar's), never from that shape. Reading, marking read and
 * downloading are every member's: read state is per member. */
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

test("a Viewer reads, marks read and downloads the report, with no triage toolbar and no share", () => {
  assert.match(report, /scope\.kind === 'personal' \|\| \(reportFlags\?\.can_triage \?\? spaceRadar\?\.can_triage\) === true;/);
  assert.match(report, /scope\.kind === 'personal' \|\| \(reportFlags\?\.can_manage \?\? spaceRadar\?\.can_manage\) === true;/);
  assert.match(report, /const canDownload = scope\.kind === 'space';/);
  // Read state is per member (B3): opening an unread report marks it read for anyone.
  assert.match(report, /const shouldMarkRead =\s*ownerScan !== null &&/);
  assert.doesNotMatch(report, /const shouldMarkRead =\s*canTriage/);
  assert.match(report, /\{ownerScan && \(canTriage \|\| canManage \|\| canDownload\) \? \(/);
  assert.match(report, /\{canTriage \? <ScanTriageToolbar radarUuid=\{radarUuid\} scan=\{ownerScan\} \/> : null\}/);
  assert.match(report, /\{canDownload \? <ReportDownloads radarUuid=\{radarUuid\} scanUuid=\{scanUuid\} \/> : null\}/);
  assert.match(report, /\{canManage \? <ShareDialog radarUuid=\{radarUuid\} scan=\{ownerScan\} \/> : null\}/);
});

test('a report downloads as Word or PDF, and a refused download says why beside the buttons', async () => {
  const { downloadFailure } = await import('@/v2/features/radars/report/use-report-download');
  assert.equal(downloadFailure(429), 'Too many downloads in a minute. Try again shortly.');
  assert.equal(downloadFailure(404), 'This report is no longer available to download.');
  assert.equal(downloadFailure(500), "The file didn't download. Try again.");
  const buttons = read('v2', 'features', 'radars', 'report', 'ReportDownloads.tsx');
  assert.match(buttons, /\{ format: 'docx', label: 'Download Word', short: 'Word' \}/);
  assert.match(buttons, /\{ format: 'pdf', label: 'Download PDF', short: 'PDF' \}/);
  assert.match(buttons, /<p role="alert" className="text-xs text-destructive">/);
});

test('the report leads back into the space, not to /radars', () => {
  assert.equal((report.match(/hrefs\.radar\(radarUuid\)/g) ?? []).length, 2);
  assert.doesNotMatch(report, /href=\{`\/radars\/\$\{radarUuid\}`\}/);
  assert.match(report, /<Link href=\{hrefs\.list\}>Back to the space&apos;s Radars<\/Link>/);
});

test('one report and its triage use the space routes; the share stays on /radars', () => {
  const scope = read('v2', 'features', 'radars', 'scope.ts');
  assert.match(scope, /getScan: \(radarUuid, scanUuid\) => spaceRadarsApi\.getScan\(spaceUuid, radarUuid, scanUuid\),/);
  assert.match(scope, /triageScan: \(radarUuid, scanUuid, payload\) => spaceRadarsApi\.triageScan\(spaceUuid, radarUuid, scanUuid, payload\),/);
  assert.match(scope, /    publishScan: radarsApi\.publishScan,/);
  assert.match(scope, /    unpublishScan: radarsApi\.unpublishScan,/);
});

test("a long source title truncates inside its row, on a phone too", () => {
  const sources = read('v2', 'features', 'radars', 'report', 'ReportSources.tsx');
  assert.match(sources, /'v2-interactive flex min-h-11 min-w-0 flex-1 items-start gap-2\.5 rounded-lg px-2 py-2\.5/);
  assert.match(sources, /<span className="flex min-h-11 min-w-0 flex-1 items-start gap-2\.5 px-2 py-2\.5">\{body\}<\/span>/);
  assert.match(sources, /<span className="block truncate text-sm text-foreground">\{title\}<\/span>/);
});
