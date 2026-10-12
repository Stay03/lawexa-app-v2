import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  preloadAllowed,
  preloadConversationScreen,
  resetConversationScreenPreload,
} from './preload-conversation-screen';

// Guard for speed step 2 (b): the list and the home load the chat screen's
// code while the page sits idle, once per page life, and not for a reader who
// asked for less data.
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const preload = read('v2', 'features', 'conversations', 'preload-conversation-screen.ts');

test('the screen code is loaded once, however often the preload runs', async () => {
  resetConversationScreenPreload();
  let loads = 0;
  const load = async () => {
    loads += 1;
  };
  preloadConversationScreen(load);
  preloadConversationScreen(load);
  preloadConversationScreen(load);
  await Promise.resolve();
  assert.equal(loads, 1);
});

test('a failed load may be tried again', async () => {
  resetConversationScreenPreload();
  let loads = 0;
  const failing = async () => {
    loads += 1;
    throw new Error('offline');
  };
  preloadConversationScreen(failing);
  await new Promise((resolve) => setTimeout(resolve, 0));
  preloadConversationScreen(failing);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(loads, 2);
});

test('Save-Data and a 2G link skip the preload; no hints, or a faster link, allow it', () => {
  assert.equal(preloadAllowed({ saveData: true }), false);
  assert.equal(preloadAllowed({ saveData: true, effectiveType: '4g' }), false);
  assert.equal(preloadAllowed({ effectiveType: '2g' }), false);
  assert.equal(preloadAllowed({ effectiveType: 'slow-2g' }), false);
  assert.equal(preloadAllowed({ effectiveType: '3g' }), true);
  assert.equal(preloadAllowed({ saveData: false, effectiveType: '4g' }), true);
  assert.equal(preloadAllowed(undefined), true);
  // The hook asks before it schedules anything.
  assert.match(preload, /if \(!preloadAllowed\(connection\)\) return;\s*if \(typeof window\.requestIdleCallback === 'function'\)/);
});

test('it waits for an idle moment, or a timer where there is no idle callback', () => {
  assert.match(preload, /window\.requestIdleCallback\(\(\) => preloadConversationScreen\(\), \{/);
  assert.match(preload, /return \(\) => window\.cancelIdleCallback\(id\);/);
  assert.match(preload, /window\.setTimeout\(\(\) => preloadConversationScreen\(\), PRELOAD_FALLBACK_MS\);/);
});

test('the preload loads the module the chat route renders', () => {
  assert.match(preload, /const loadScreen: Loader = \(\) => import\('\.\/conversation\/ConversationScreen'\);/);
  const page = read('app', 'v2', 'c', '[conversationId]', 'page.tsx');
  assert.match(page, /import \{ ConversationScreen \} from '@\/v2\/features\/conversations\/conversation\/ConversationScreen';/);
});

test('the conversation list and the home mount it for a signed-in reader', () => {
  const list = read('v2', 'features', 'conversations', 'list', 'ConversationsList.tsx');
  assert.match(list, /usePreloadConversationScreen\(signedIn\);/);
  const home = read('app', 'v2', 'home.tsx');
  assert.match(home, /const \{ name, signedIn, role, userId \} = useV2Session\(\);[\s\S]*?usePreloadConversationScreen\(signedIn\);/);
});
