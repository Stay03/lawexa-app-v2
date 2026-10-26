import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { reportHoldings } from './radar-rows';

/* Radar in Spaces, second part: the feed row says what a report holds for the
 * space (plan 5.4), and every member has a "Radar notices for this Space"
 * switch in the space's About sheet (plan 6.1, Backend's B4 contract). */

const read = (...parts: string[]) =>
  readFileSync(new URL(`../../../../../${parts.join('/')}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (...parts: string[]) =>
  read(...parts).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('a report row names its affected items and drafts, and nothing when it has none', () => {
  assert.equal(reportHoldings({ affected_items_count: 2, drafts_count: 1 }), '2 affected · 1 draft');
  assert.equal(reportHoldings({ affected_items_count: 0, drafts_count: 3 }), '3 drafts');
  assert.equal(reportHoldings({ affected_items_count: 0, drafts_count: 0 }), null);
  assert.equal(reportHoldings({}), null);
});

test('the switch calls the member’s own route and moves at once', () => {
  const api = code('lib', 'api', 'collab.ts');
  assert.match(api, /apiClient\.put<ApiResponse<\{ radar_notices: boolean \}>>\(\s*`\/spaces\/\$\{uuid\}\/radar-notices`,\s*\{ enabled \}\s*\)/);
  const mutations = code('v2', 'features', 'spaces', 'mutations.ts');
  assert.match(mutations, /export function useSetRadarNotices\(spaceUuid: string\)/);
  assert.match(mutations, /optimisticMutation<unknown, boolean, SpaceResponse>/);
  assert.match(mutations, /my_radar_notices: enabled/);
});

test('every member sees the switch in the About sheet, bound to their own setting', () => {
  const sheet = code('v2', 'features', 'spaces', 'detail', 'SpaceAboutSheet.tsx');
  assert.match(sheet, /\{space\.my_radar_notices !== undefined \? \(\s*<RadarNoticesRow spaceUuid=\{space\.uuid\} enabled=\{space\.my_radar_notices\} \/>/);
  assert.match(sheet, /Radar notices for this Space/);
  assert.match(sheet, /<Switch\s+id=\{id\}\s+checked=\{enabled\}\s+onCheckedChange=\{\(next\) => mutate\(next\)\}/);
});

test('a space Radar report notice has its own title', () => {
  const presentation = read('v2', 'features', 'notifications', 'presentation.ts');
  assert.match(presentation, /space_radar_report: 'A Radar report is ready in your Space',/);
});
