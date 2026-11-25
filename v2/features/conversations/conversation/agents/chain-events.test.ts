import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient } from '@tanstack/react-query';

import type { HeldMessagesAnsweredEvent } from '@/types/agent-chain';
import { landAgentChainChanged, landHeldMessagesAnswered, onHeldMessagesAnswered } from './chain-events';

/* The chain's pushed events: what each one reads again, and who hears the held answer. TEST DATA. */

function spy() {
  const client = new QueryClient();
  const keys: unknown[][] = [];
  client.invalidateQueries = (async (filters?: { queryKey?: unknown[] }) => {
    if (filters?.queryKey) keys.push(filters.queryKey);
  }) as QueryClient['invalidateQueries'];
  return { client, keys };
}

test('a changed chain reads the chain, the agents and the jobs of that chat again', () => {
  const { client, keys } = spy();
  landAgentChainChanged(client, { conversation_id: 'chat-1' });
  assert.deepEqual(keys.map((k) => k[0]), ['agent-chain', 'agent-conversations', ...keys.slice(2).map((k) => k[0])]);
  assert.ok(keys.every((k) => JSON.stringify(k).includes('chat-1')));
  assert.equal(keys.length, 3);
});

test('a held answer tells the open chat which turn to attach to, then reads the chain and transcript again', () => {
  const { client, keys } = spy();
  const heard: HeldMessagesAnsweredEvent[] = [];
  const stop = onHeldMessagesAnswered((event) => heard.push(event));
  const event = { conversation_id: 'chat-1', message_ids: [41, 42], execution_id: 'exec-answer' };
  landHeldMessagesAnswered(client, event);
  assert.deepEqual(heard, [event]);
  assert.equal(keys.length, 4);
  stop();
  landHeldMessagesAnswered(client, event);
  assert.equal(heard.length, 1, 'a closed chat no longer hears it');
});

test('an event with no chat, or no turn to attach to, does nothing', () => {
  const { client, keys } = spy();
  const heard: unknown[] = [];
  const stop = onHeldMessagesAnswered((event) => heard.push(event));
  landAgentChainChanged(client, { conversation_id: '' });
  landHeldMessagesAnswered(client, { conversation_id: 'chat-1', message_ids: [1], execution_id: '' });
  assert.equal(keys.length, 0);
  assert.equal(heard.length, 0);
  stop();
});

test('the spine listens for both events on the user channel and catches the chain up after a gap', () => {
  const spine = readFileSync(join(process.cwd(), 'v2', 'runtime', 'realtime', 'spine.tsx'), 'utf8');
  assert.match(spine, /channel\.listen\(EVT_AGENT_CHAIN_CHANGED, \(payload: AgentChainChangedEvent\) => \{\s*landAgentChainChanged\(queryClient, payload\);/);
  assert.match(spine, /channel\.listen\(EVT_HELD_MESSAGES_ANSWERED, \(payload: HeldMessagesAnsweredEvent\) => \{\s*landHeldMessagesAnswered\(queryClient, payload\);/);
  const gapKeys = spine.slice(spine.indexOf('const COLLAB_GAP_KEYS'), spine.indexOf('];', spine.indexOf('const COLLAB_GAP_KEYS')));
  assert.match(gapKeys, /agentChainQueries\.all\(\),/);
});

test('nothing about the agents sits above the message box: Stop and the queued count are on Lawexa’s line in the deck', () => {
  // Round 9, version 1 (Stay, 25 November 2026, 22:48Z): the box stays open for held messages (option C), so the
  // agents' Stop lives on Lawexa's line over the deck, in the transcript, and neither dock carries an agents line.
  const here = (...parts: string[]) => readFileSync(join(process.cwd(), 'v2', ...parts), 'utf8');
  assert.doesNotMatch(here('features', 'conversations', 'conversation', 'ChatDock.tsx'), /AgentsWorking/);
  assert.doesNotMatch(here('features', 'cases', 'detail', 'CaseChatCore.tsx'), /AgentsWorking/);
  const deck = here('features', 'conversations', 'conversation', 'agents', 'AgentRoster.tsx');
  assert.match(deck, /const \{ stop, stopping, problem \} = useStopChain\(conversationId, heldIds\);/);
  assert.match(deck, /\{problem \?\? deckLine\(rows, heldIds\.length\)\}/);
  assert.match(deck, /\{open && canSend \? \(/);
});
