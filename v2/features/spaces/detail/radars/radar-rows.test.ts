import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { SpaceItem, SpaceRadarListItem, SpaceRadarReport } from '@/types/collab';
import { parseSpaceTab } from '../../model';
import {
  newSpaceRadarHref,
  radarRowModel,
  radarStateWord,
  reportRowModel,
  spaceRadarHref,
  spaceRadarReportHref,
  UNTITLED_REPORT,
} from './radar-rows';

/* Radar in Spaces, first part (Stay's go, 26 October 2026): a space's Radars
 * pill and its report rows in the feed. TEST DATA throughout. */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const NOW = Date.parse('2026-10-26T12:00:00Z');

const REPORT: SpaceRadarReport = {
  uuid: 'scan-1',
  title: 'TEST DATA Tenancy ruling',
  has_findings: true,
  priority: false,
  read_at: null,
  workflow_status: 'active',
  completed_at: '2026-10-26T10:00:00Z',
  excerpt: 'TEST DATA The Court of Appeal held that a landlord must give notice.',
  radar: { uuid: 'radar-1', name: 'TEST DATA Tenancy watch', status: 'active' },
  url: '/spaces/space-1/radars/radar-1/scans/scan-1',
};

const RADAR = {
  uuid: 'radar-1',
  name: 'TEST DATA Tenancy watch',
  description: null,
  instructions: null,
  schedule_cron: '0 8 * * *',
  timezone: 'Africa/Lagos',
  status: 'active',
  last_scan_at: '2026-10-25T08:00:00Z',
  next_scan_at: '2026-10-27T08:00:00Z',
  unread_reports_count: 2,
  created_at: '2026-10-20T08:00:00Z',
  updated_at: '2026-10-25T08:00:00Z',
  jurisdictions: [],
  topics: ['TEST DATA tenancy'],
  keywords: [],
  sources: [],
  entities: [],
  channels: [],
  conversation_uuid: 'conversation-1',
  space: { uuid: 'space-1', name: 'TEST DATA Gray Partners' },
  creator: { uuid: 'user-1', name: 'TEST DATA Ada', avatar_url: null },
  can_manage: false,
  can_triage: true,
  schedule_state: 'active',
  latest_report: REPORT,
} satisfies SpaceRadarListItem;

test('a Radar and its reports open inside the space, built from the uuids', () => {
  assert.equal(spaceRadarHref('space-1', 'radar-1'), '/spaces/space-1/radars/radar-1');
  assert.equal(spaceRadarReportHref('space-1', 'radar-1', 'scan-1'), '/spaces/space-1/radars/radar-1/scans/scan-1');
  assert.equal(newSpaceRadarHref('space-1'), '/spaces/space-1/radars/new');
  // The row's own `url` is never followed: a changed server path cannot send
  // a reader outside the app's routes.
  const row = reportRowModel({ ...REPORT, url: 'https://elsewhere.test/x' }, 'space-1', NOW);
  assert.equal(row.href, '/spaces/space-1/radars/radar-1/scans/scan-1');
});

test("a report row reads its title, its Radar and first line, and this reader's unread", () => {
  const row = reportRowModel(REPORT, 'space-1', NOW);
  assert.equal(row.title, 'TEST DATA Tenancy ruling');
  assert.equal(row.meta, 'TEST DATA Tenancy watch · TEST DATA The Court of Appeal held that a landlord must give notice.');
  assert.equal(row.unread, true);
  assert.equal(row.time, '2h');
  // Read by this reader: no longer unread, whatever others did.
  assert.equal(reportRowModel({ ...REPORT, read_at: '2026-10-26T11:00:00Z' }, 'space-1', NOW).unread, false);
  // No title, no first line.
  const bare = reportRowModel({ ...REPORT, title: '  ', excerpt: null }, 'space-1', NOW);
  assert.equal(bare.title, UNTITLED_REPORT);
  assert.equal(bare.meta, 'TEST DATA Tenancy watch');
  // Before the clock is read, no time.
  assert.equal(reportRowModel(REPORT, 'space-1', 0).time, '');
});

test("a Radar row reads its schedule and maker, this reader's unread, and its newest report's time", () => {
  const row = radarRowModel(RADAR, 'space-1', NOW);
  assert.equal(row.title, 'TEST DATA Tenancy watch');
  assert.equal(row.state, null);
  assert.match(row.meta, / · TEST DATA Ada$/);
  assert.equal(row.unread, 2);
  assert.equal(row.href, '/spaces/space-1/radars/radar-1');
  assert.equal(row.time, '2h');
  // No report yet: the last scan's time.
  assert.equal(radarRowModel({ ...RADAR, latest_report: null }, 'space-1', NOW).time, '1d');
  // No maker named: the schedule alone.
  assert.doesNotMatch(radarRowModel({ ...RADAR, creator: null }, 'space-1', NOW).meta, / · /);
});

test('a Radar that is not running says why in a word or two', () => {
  assert.equal(radarStateWord({ status: 'active', schedule_state: 'active' }), null);
  assert.equal(radarStateWord({ status: 'active' }), null);
  assert.equal(radarStateWord({ status: 'paused', schedule_state: 'paused' }), 'Paused');
  assert.equal(radarStateWord({ status: 'active', schedule_state: 'no_balance' }), 'Stopped');
  assert.equal(radarStateWord({ status: 'active', schedule_state: 'failed' }), 'Last scan failed');
  assert.equal(radarStateWord({ status: 'archived', schedule_state: 'paused' }), 'Archived');
});

test('?tab=radars opens the Radars pill', () => {
  assert.equal(parseSpaceTab('radars'), 'radars');
});

test('a report row in the feed is a Radar row that links inside the space, and the feed waits on the Radars pill', () => {
  const entry: SpaceItem = { type: 'radar_report', sort_at: REPORT.completed_at, item: REPORT };
  assert.equal(entry.type, 'radar_report');
  const rows = read('../content/feed-rows.tsx');
  assert.match(rows, /case 'radar_report': \{\s*const row = reportRowModel\(entry\.item, menus\.spaceUuid, now\);/);
  assert.match(rows, /render=\{roomLink\(row\.href\)\}/);
  const panel = read('../content/SpaceContentPanel.tsx');
  assert.match(panel, /enabled: enabled && tab !== 'people' && tab !== 'radars',/);
  assert.match(panel, /tab === 'radars' \? \(\s*<SpaceRadarsPanel spaceUuid=\{space\.uuid\} canAdd=\{access\.canAdd\} \/>/);
  // New Radar is for whoever may add; nothing is dropped onto Radars.
  assert.match(panel, /tab === 'radars' \? \(\s*access\.canAdd \? <NewRadarButton spaceUuid=\{space\.uuid\} \/> : null/);
  assert.match(panel, /access\.canAdd && tab !== 'people' && tab !== 'radars' \? \(\s*<FileDropZone/);
});
