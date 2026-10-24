import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';
import type { ConversationData, ConversationListItem } from '@/types/chat';
import { makeOptimisticConversation } from '../cache';
import { conversationsQueries } from '../queries';
import { earlyRuling, seedEarlyRuling } from './early-ruling';
import {
  clearRouteComposer,
  publishRouteComposer,
  stageRouteReply,
  subscribeRouteReplies,
  type RouteComposerSurface,
} from './route-composer';

/* Message box B (Stay, 17 October 2026, "the cleaner one"; Option 1): a chat's
 * one message box lives in the shell's dock, outside the route's frames, so it
 * is one element from the tap's first frame to the chat. */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');
const readHere = (name: string) => readFileSync(join(here, name), 'utf8').replace(/\r\n/g, '\n');

const listRow = (id: string, userId: number, canSend?: boolean): ConversationListItem =>
  ({
    ...makeOptimisticConversation(id, 'A lease question'),
    user_id: userId,
    ...(canSend !== undefined && { can_send: canSend }),
  }) as ConversationListItem;

/* ── The ruling before the screen ─────────────────────────────────────────── */

test('the box knows whose chat it is from the cached record first, then from a list row', () => {
  const client = new QueryClient();
  // Nothing cached: a cold open, the skeleton.
  assert.equal(earlyRuling(client, 'c-1', 7), null);
  // A row of the reader's recents.
  client.setQueryData(conversationsQueries.infiniteRecents({ viewerId: 7 }).queryKey, {
    pages: [{ success: true, data: [listRow('c-1', 7, true)], pagination: { current_page: 1, last_page: 1, total: 1, per_page: 20 } }],
    pageParams: [1],
  } as never);
  assert.deepEqual(earlyRuling(client, 'c-1', 7), {
    ownerId: 7,
    canSend: true,
    viewOnlyReason: 'shared',
    spaceUuid: null,
    isConfidential: false,
  });
  // The record, once cached, wins: a Viewer in the chat's space may not send.
  client.setQueryData(conversationsQueries.detail({ conversationId: 'c-1', viewerId: 7 }).queryKey, {
    id: 'c-1',
    user_id: 3,
    can_send: false,
    my_space_role: 'viewer',
    space: { uuid: 's-1', name: 'Chambers' },
  } as unknown as ConversationData);
  assert.deepEqual(earlyRuling(client, 'c-1', 7), {
    ownerId: 3,
    canSend: false,
    viewOnlyReason: 'viewer',
    spaceUuid: 's-1',
    isConfidential: false,
  });
  client.clear();
});

test('a row without can_send falls back to ownership, and the create flow’s placeholder says nothing', () => {
  const client = new QueryClient();
  client.setQueryData(conversationsQueries.infiniteRecents({ viewerId: 7 }).queryKey, {
    pages: [
      {
        success: true,
        data: [listRow('mine', 7), listRow('theirs', 9), makeOptimisticConversation('fresh', 'Just asked')],
        pagination: { current_page: 1, last_page: 1, total: 3, per_page: 20 },
      },
    ],
    pageParams: [1],
  } as never);
  assert.equal(earlyRuling(client, 'mine', 7)?.canSend, true);
  assert.equal(earlyRuling(client, 'theirs', 7)?.canSend, false);
  assert.equal(earlyRuling(client, 'fresh', 7), null);
  client.clear();
});

test('a chat the reader just started is theirs from the move’s first frame (the create seed)', () => {
  const client = new QueryClient();
  // Its only list row is the create flow's placeholder (owner 0), which says nothing.
  assert.equal(earlyRuling(client, 'new-1', 7), null);
  seedEarlyRuling('new-1', { ownerId: 7, canSend: true, viewOnlyReason: 'shared', spaceUuid: 's-1', isConfidential: false });
  assert.deepEqual(earlyRuling(client, 'new-1', 7), {
    ownerId: 7,
    canSend: true,
    viewOnlyReason: 'shared',
    spaceUuid: 's-1',
    isConfidential: false,
  });
  // The home and space boxes seed it, except for a hard (confidential) load.
  const home = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(home, /if \(!result\.hardNavigate && userId !== null\) \{\s*seedEarlyRuling\(result\.conversationId, \{/);
  client.clear();
});

/* ── The store the screen publishes to ────────────────────────────────────── */

const surfaceFor = (conversationId: string): RouteComposerSurface => ({
  conversationId,
  terminal: false,
  holdingSkeleton: false,
  isOwnerResolved: true,
  canSend: true,
  viewOnlyReason: 'shared',
  holdSend: false,
  showMeta: true,
  jurisdiction: { mode: 'auto' },
  setJurisdiction: () => {},
  isConfidential: false,
  isRedacted: false,
  isStreaming: false,
  isCancelling: false,
  sendHeldBy: null,
  canStop: true,
  submit: async () => undefined,
  stop: () => {},
  mentionOptions: null,
  quoteToneOf: null,
  spaceUuid: null,
});

test('a leaving screen’s late clear never blanks the next chat’s surface', () => {
  publishRouteComposer(surfaceFor('a'));
  publishRouteComposer(surfaceFor('b'));
  // Chat A's screen unmounts after B's has published.
  clearRouteComposer('a');
  const store = readHere('route-composer.ts');
  assert.match(store, /if \(surface === null \|\| surface\.conversationId !== conversationId\) return;/);
  clearRouteComposer('b');
});

test('a Reply reaches the box of its own chat only', () => {
  const heard: string[] = [];
  const stop = subscribeRouteReplies('c1', (target) => heard.push(String(target.id)));
  stageRouteReply('c1', { id: 1 } as never);
  stageRouteReply('c2', { id: 2 } as never);
  stop();
  stageRouteReply('c1', { id: 3 } as never);
  assert.deepEqual(heard, ['1']);
});

/* ── Where the box lives and which chat it serves ─────────────────────────── */

test('the box is the shell’s, beside the route content, for a chat route or a tap moving to one', () => {
  const layout = read('app', 'v2', 'layout.tsx');
  assert.match(layout, /dock=\{\s*<>\s*<DockHost \/>\s*<ChatDock \/>\s*<\/>\s*\}/);
  const dock = readHere('ChatDock.tsx');
  // The tap's destination while the move is under way, else the route.
  assert.match(dock, /const pending = useMoveFirstPending\(\);/);
  assert.match(dock, /pending\.kind === 'conversation'\s*\?\s*conversationIdOf\(new URL\(pending\.href, 'http:\/\/x'\)\.pathname\)\s*:\s*null/);
  assert.match(dock, /: conversationIdOf\(withoutV2Prefix\(pathname\)\);/);
  // Nothing anywhere else, so no other page gains a row.
  assert.match(dock, /if \(conversationId === null\) return null;/);
  // One box per chat: a move to another chat starts that chat's own box.
  assert.match(dock, /<ChatDockBox key=\{conversationId\} conversationId=\{conversationId\} \/>/);
  const moveFirst = read('v2', 'shell', 'move-first.tsx');
  assert.match(moveFirst, /<MoveFirstPendingContext\.Provider value=\{pendingMove\}>/);
});

test('the box floats over the content row, above the tap’s frame and under the phone bar', () => {
  const css = read('v2', 'shell', 'shell.css');
  assert.match(
    css,
    /\.v2-shell__dock:has\(\[data-v2-chat-dock\]\) \{\s*grid-row: 2;\s*align-self: end;\s*z-index: 41;\s*pointer-events: none;\s*\}/,
  );
  // Every row names the one column: an item that names only its row is
  // auto-placed, and on a taken row that opens a NEW column, which split the
  // box and the transcript in two (check films, 17 October 2026).
  assert.match(
    css,
    /\.v2-shell__header,\s*\.v2-shell__content,\s*\.v2-shell__dock \{\s*min-width: 0;[\s\S]*?grid-column: 1;\s*\}/,
  );
  // Above the move-first frame (fixed, z-40) and under the phone's open bar.
  assert.match(read('v2', 'shell', 'move-first.tsx'), /"v2-move-first fixed z-40 /);
  assert.match(css, /\.v2-shell__header \{\s*align-self: start;\s*z-index: 42;/);
  // Never fixed: the keyboard inset that shrinks the shell lifts it.
  assert.doesNotMatch(readHere('ChatDock.tsx'), /className="[^"]*\bfixed\b/);
  // The pill takes touches; the gaps pass them to the transcript.
  // (The wrapper also says what the box draws from, data-source and the two
  // flags, for the journey checks.)
  assert.match(
    readHere('ChatDock.tsx'),
    /<div\s+data-v2-chat-dock=""[\s\S]{0,600}?className="pointer-events-none"\s*>\s*<div ref=\{dockRef\} className="pointer-events-auto v2-safe-bottom mx-auto w-full max-w-xs sm:max-w-md">/,
  );
  assert.match(readHere('ChatDock.tsx'), /data-source=\{surface \? 'screen' : early \? 'early' : 'cold'\}/);
});

test('the screen draws no box of its own on its route, and the frames draw none either', () => {
  const screen = readHere('ConversationScreen.tsx');
  assert.doesNotMatch(screen, /<ConversationComposer|<ComposerSkeleton|<ViewOnlyPill/);
  assert.match(screen, /if \(externalComposer\) return;\s*publishRouteComposer\(\{/);
  assert.match(screen, /return \(\) => clearRouteComposer\(conversationId\);/);
  const skeletons = readHere('skeletons.tsx');
  const frame = skeletons.slice(skeletons.indexOf('export function ConversationFrame'));
  assert.doesNotMatch(frame, /<ComposerSkeleton/);
});

test('the jurisdiction chosen before the screen is up is the one the screen opens with', () => {
  const dock = readHere('ChatDock.tsx');
  assert.match(dock, /setLocalJurisdiction\(next\);\s*writeJurisdictionSlot\(conversationId, next\);/);
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /setJurisdictionState\(readJurisdictionSlot\(conversationId\)\);/);
  assert.match(controller, /writeJurisdictionSlot\(conversationId, next\);/);
});

test('the case page’s side chat takes typing while its thread wires up; only Send waits (Stay, 17 October 2026)', () => {
  const core = read('v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx');
  assert.match(core, /const conversationPending = conversationId !== null && surface === null;/);
  assert.match(core, /holdSend=\{conversationPending\}/);
  assert.doesNotMatch(core, /disabled=\{conversationPending\}/);
});

test('below xl the draft sheet sits over the docked box and the bar, on iOS too', () => {
  const css = read('v2', 'shell', 'shell.css');
  // The content region is lifted over the dock (41) and the see-through bar (42) while a side panel is open.
  assert.match(css, /@media \(max-width: 79\.999rem\) \{\s*html\[data-v2-side-panel\] \.v2-shell__content \{\s*z-index: 43;\s*\}\s*\}/);
  assert.match(css, /\.v2-shell__dock:has\(\[data-v2-chat-dock\]\) \{\s*grid-row: 2;\s*align-self: end;\s*z-index: 41;/);
  assert.match(css, /\.v2-shell__header \{\s*align-self: start;\s*z-index: 42;/);
});
