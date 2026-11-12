import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { addableAgents, calleeLabel, idsWith, idsWithout } from './agent-can-call-model';

/* "Can call" on an agent's page (sub-agents contract, section 5.1, Stay's
 * example: Lite can call Issue Spotter, Expert and Lite). TEST DATA only. */

const LITE = { id: 228, name: 'Lite', slug: 'lite', is_active: true };
const EXPERT = { id: 229, name: 'Expert', slug: 'expert', is_active: true };
const SPOTTER = { id: 231, name: 'Issue Spotter', slug: 'issue-spotter', is_active: true };
const OLD = { id: 240, name: 'Old Drafter', slug: 'old-drafter', is_active: false };

test('the agent itself reads as the "lawexa" it gives; others by name', () => {
  assert.equal(calleeLabel(LITE, LITE.id), 'Lite (itself, as "lawexa")');
  assert.equal(calleeLabel(SPOTTER, LITE.id), 'Issue Spotter');
});

test('only active agents not yet listed can be added, the agent itself first', () => {
  assert.deepEqual(
    addableAgents([SPOTTER, OLD, EXPERT, LITE], [], LITE.id).map((agent) => agent.name),
    ['Lite', 'Expert', 'Issue Spotter'],
  );
  assert.deepEqual(addableAgents([SPOTTER, EXPERT, LITE], [SPOTTER, LITE], LITE.id).map((agent) => agent.name), ['Expert']);
  assert.deepEqual(addableAgents([SPOTTER, LITE], [SPOTTER, LITE], LITE.id), []);
});

test('each change sends the whole list, as the server replaces it', () => {
  assert.deepEqual(idsWith([SPOTTER, EXPERT], LITE.id), [231, 229, 228]);
  assert.deepEqual(idsWith([SPOTTER], SPOTTER.id), [231]);
  assert.deepEqual(idsWithout([SPOTTER, EXPERT, LITE], EXPERT.id), [231, 228]);
  // Removing the last one sends an empty list, which clears it.
  assert.deepEqual(idsWithout([SPOTTER], SPOTTER.id), []);
});

test('the card saves through the agent update with can_call_agent_ids, and sits on the agent page', () => {
  const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
  const card = read('components', 'admin', 'ai', 'AiAgentCanCallCard.tsx');
  assert.match(card, /update\.mutate\(\s*\{ id: agent\.id, data: \{ can_call_agent_ids: ids \} \}/);
  assert.match(card, /useAdminAiAgents\(\{ per_page: 100, active_only: true \}\)/);
  // An older server sends no list: no card.
  assert.match(card, /if \(!listed\) return null;/);
  assert.match(read('app', '(admin)', 'admin', 'ai', 'agents', '[id]', 'page.tsx'), /<AiAgentCanCallCard agent=\{agent\} \/>/);
  assert.match(read('types', 'admin-ai.ts'), /can_call_agent_ids\?: number\[\];/);
});
