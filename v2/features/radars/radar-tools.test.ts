import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { radarToolChangesRadars } from './radar-tools';

/* The Radars pill's box (Stay, 26 October 2026): a send starts the space chat,
 * where Lawexa makes or changes the space's Radars with its tools, and the
 * Radar lists re-ask when such a tool finishes. */

const read = (...parts: string[]) =>
  readFileSync(new URL(`../../../${parts.join('/')}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (...parts: string[]) =>
  read(...parts).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the tools that make or change a Radar, and not the ones that read', () => {
  for (const name of ['create_radar', 'update_radar', 'pause_radar', 'resume_radar', 'delete_radar', 'scan_radar_now']) {
    assert.equal(radarToolChangesRadars(name), true, name);
  }
  for (const name of ['list_radars', 'list_radar_scans', 'view_radar_scan', 'search_files', '_handover']) {
    assert.equal(radarToolChangesRadars(name), false, name);
  }
});

test('a finished Radar tool re-asks the Radar page’s lists and every space’s Radars pill', () => {
  const controller = code('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  assert.match(
    controller,
    /onToolComplete: \(event\) => \{\s*if \(!radarToolChangesRadars\(event\.tool_call\.name\)\) return;\s*void queryClient\.invalidateQueries\(\{ queryKey: radarsQueries\.all \}\);\s*void queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.allRadars\(\) \}\);/,
  );
  const queries = code('v2', 'features', 'spaces', 'queries.ts');
  assert.match(queries, /radarsOf: \(spaceUuid: string\) => \[\.\.\.spacesQueries\.allRadars\(\), spaceUuid\] as const,/);
});

test('the Radars pill’s box asks what to watch', () => {
  const dock = code('v2', 'features', 'spaces', 'detail', 'content', 'SpaceChatDock.tsx');
  assert.match(dock, /export const SPACE_RADAR_COMPOSER_PLACEHOLDER = 'Tell Lawexa what this Space should watch';/);
  assert.match(dock, /placeholder=\{placeholder\}/);
});
