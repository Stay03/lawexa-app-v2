import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scheduleHold, skeletonVisible, SKELETON_HOLD_MS } from './skeleton-hold';
import { isRouteSkeletonShown, markRouteSkeleton } from './route-skeleton-state';

const here = dirname(fileURLToPath(import.meta.url));
const repo = (...parts: string[]) => join(here, '..', '..', '..', '..', ...parts);
const read = (...parts: string[]) => readFileSync(repo(...parts), 'utf8');

test('the skeleton waits 200 ms: not at 199 ms, at 200 ms', () => {
  assert.equal(SKELETON_HOLD_MS, 200);
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let done = 0;
    scheduleHold(SKELETON_HOLD_MS, () => done++);
    mock.timers.tick(199);
    assert.equal(done, 0, 'still held at 199 ms');
    mock.timers.tick(1);
    assert.equal(done, 1, 'shown at 200 ms');
  } finally {
    mock.timers.reset();
  }
});

test('a copy that arrives inside the hold means the skeleton never shows', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let done = 0;
    const cancel = scheduleHold(SKELETON_HOLD_MS, () => done++);
    mock.timers.tick(100); // the device copy painted after 100 ms: the wait ends
    cancel();
    mock.timers.tick(1000);
    assert.equal(done, 0);
  } finally {
    mock.timers.reset();
  }
});

test('the skeleton shows only while waiting and once the hold for THIS conversation ran out', () => {
  assert.equal(skeletonVisible(true, 'c1', 'c1'), true);
  assert.equal(skeletonVisible(true, null, 'c1'), false, 'hold still running');
  assert.equal(skeletonVisible(false, 'c1', 'c1'), false, 'content is there');
  assert.equal(skeletonVisible(true, 'c1', 'c2'), false, 'another conversation starts its own hold');
});

test('the route skeleton mark counts mounts, and a release twice does not undercount', () => {
  assert.equal(isRouteSkeletonShown(), false);
  const a = markRouteSkeleton();
  const b = markRouteSkeleton();
  assert.equal(isRouteSkeletonShown(), true);
  a();
  a();
  assert.equal(isRouteSkeletonShown(), true, 'b is still mounted');
  b();
  assert.equal(isRouteSkeletonShown(), false);
});

test('when the route skeleton is up, the screen shows its own at once (no gap between the two)', () => {
  const hold = read('v2', 'features', 'conversations', 'conversation', 'skeleton-hold.ts');
  assert.match(hold, /useState<string \| null>\(\(\) => \(isRouteSkeletonShown\(\) \? scope : null\)\)/);
  const loading = read('app', 'v2', 'c', '[conversationId]', 'loading.tsx');
  assert.match(loading, /<RouteSkeletonMark \/>/);
});

test('the screen draws nothing while the hold runs, then the skeleton, for transcript and composer alike', () => {
  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  assert.match(controller, /const showHistorySkeleton = useSkeletonHold\(isLoadingHistory, conversationId\);/);
  const screen = read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx');
  assert.match(screen, /const holdingSkeleton = isLoadingHistory && !showHistorySkeleton;/);
  assert.match(screen, /isLoadingHistory=\{showHistorySkeleton\}/);
  assert.match(screen, /\{holdingSkeleton \? null : !controller\.isOwnerResolved \|\| isLoadingHistory \? \(/);
});

test('the conversation page stays in the router cache as long as its transcript stays in memory', () => {
  const page = read('app', 'v2', 'c', '[conversationId]', 'page.tsx');
  assert.match(page, /export const unstable_dynamicStaleTime = 1800;/);
  // GC_TIMES.list is 30 minutes: the two windows match.
  assert.match(read('v2', 'runtime', 'query.ts'), /list: 30 \* 60 \* 1000,/);
  // The payload carries no data: the page awaits only its params and passes only the id.
  assert.match(page, /const \{ conversationId \} = await params;\s*\n\s*return <ConversationScreen conversationId=\{conversationId\} \/>;/);
  // No layout of its own that could put data in the payload.
  assert.equal(existsSync(repo('app', 'v2', 'c', 'layout.tsx')), false);
  assert.equal(existsSync(repo('app', 'v2', 'c', '[conversationId]', 'layout.tsx')), false);
});
