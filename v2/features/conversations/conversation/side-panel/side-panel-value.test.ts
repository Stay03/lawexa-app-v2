import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { SIDE_PANEL_PARAM, sidePanelSsrValue } from './side-panel-value';

/* A `?side=` link opened by reload or shared (24 November 2026): the server drew
 * no panel while the browser's first render read the URL and drew one, and React
 * threw the server's HTML away (its hydration error). The page now passes its
 * own `?side=` to the server render. TEST DATA throughout. */

test("a page's ?side= is read for the server render: its first value, or none", () => {
  assert.equal(sidePanelSsrValue('agent:16f8eb11-7399-4a5f-a903-ad570de6d744'), 'agent:16f8eb11-7399-4a5f-a903-ad570de6d744');
  assert.equal(sidePanelSsrValue(['draft:2', 'draft:3']), 'draft:2');
  assert.equal(sidePanelSsrValue(''), null);
  assert.equal(sidePanelSsrValue([]), null);
  assert.equal(sidePanelSsrValue(undefined), null);
});

test('on the server, the side panel param reads the value the page passed, as the browser will read the URL', () => {
  // No window here: this is the server render.
  assert.equal(typeof window, 'undefined');
  function Probe({ ssrValue }: { ssrValue: string | null }) {
    const overlay = useUrlOverlay(SIDE_PANEL_PARAM, { ssrValue });
    return createElement('p', null, overlay.value ?? 'closed');
  }
  assert.equal(renderToString(createElement(Probe, { ssrValue: 'agent:16f8eb11-7399-4a5f-a903-ad570de6d744' })), '<p>agent:16f8eb11-7399-4a5f-a903-ad570de6d744</p>');
  assert.equal(renderToString(createElement(Probe, { ssrValue: null })), '<p>closed</p>');
});

test('every page that hosts a side panel passes its own ?side= to the server render', () => {
  const read = (...path: string[]) => readFileSync(join(process.cwd(), ...path), 'utf8');
  const pages: Array<[string[], RegExp]> = [
    [['app', 'v2', 'c', '[conversationId]', 'page.tsx'], /initialSide=\{sidePanelSsrValue\(side\)\}/],
    [['app', 'v2', 'cases', '[slug]', 'page.tsx'], /initialSide=\{sidePanelSsrValue\(search\.side\)\}/],
    [['app', 'v2', 'radars', '[radarUuid]', 'scans', '[scanUuid]', 'page.tsx'], /initialSide=\{sidePanelSsrValue\(side\)\}/],
    [['app', 'v2', '(collab)', 'spaces', '[spaceId]', 'radars', '[radarUuid]', 'scans', '[scanUuid]', 'page.tsx'], /initialSide=\{sidePanelSsrValue\(side\)\}/],
  ];
  for (const [path, pattern] of pages) assert.match(read(...path), pattern, path.join('/'));
  // And each owner of the param hands it to useSidePanelUrl.
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'side-panel', 'SidePanelContext.tsx'), /const url = useSidePanelUrl\(initialSide\);/);
  assert.match(read('v2', 'features', 'cases', 'detail', 'CaseScreen.tsx'), /const draftUrl = useSidePanelUrl\(initialSide\);/);
  assert.match(read('v2', 'features', 'radars', 'report', 'ScanReportScreen.tsx'), /const sideUrl = useSidePanelUrl\(initialSide\);/);
});
