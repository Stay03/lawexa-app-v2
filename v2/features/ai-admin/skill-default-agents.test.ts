import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  agentIdsPayload,
  agentNamesList,
  agentRows,
  chosenAgentIds,
  createdOnAgents,
  toggleAgentId,
} from '@/lib/utils/skill-agents';

/* A new skill goes on Lite and Expert by default (Arthur, 18 November 2026;
 * server d8fda929). The admin pages live outside v2, so the rules are pinned
 * here, where the suite runs. TEST DATA. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const LITE = { id: 228, name: 'Lite' };
const EXPERT = { id: 229, name: 'Expert' };
const SPOTTER = { id: 240, name: 'Issue Spotter' };
const DRAFTER = { id: 241, name: 'Contract Drafter' };

test('the ticks start on the server defaults, and the admin’s own picks win once made', () => {
  assert.deepEqual(chosenAgentIds(null, [228, 229]), [228, 229]);
  assert.equal(chosenAgentIds(null, null), null, 'nothing known until the defaults answer');
  assert.deepEqual(chosenAgentIds([229], [228, 229]), [229]);
  assert.deepEqual(chosenAgentIds([], [228, 229]), [], 'unticking every box is a choice too');
});

test('a box turns on and off and the list keeps the rows’ order', () => {
  const order = [228, 229, 241, 240];
  assert.deepEqual(toggleAgentId([228, 229], 228, order), [229]);
  assert.deepEqual(toggleAgentId([229], 228, order), [228, 229]);
  assert.deepEqual(toggleAgentId([228, 229], 240, order), [228, 229, 240]);
});

test('the payload sends known ticks, an empty list included, and nothing when the defaults never answered', () => {
  assert.deepEqual(agentIdsPayload([228, 229]), { agent_ids: [228, 229] });
  assert.deepEqual(agentIdsPayload([]), { agent_ids: [] });
  assert.deepEqual(agentIdsPayload(null), {}, 'left out, the server uses its defaults');
});

test('the default agents come first in the server’s order, then the other active agents by name, each once', () => {
  assert.deepEqual(
    agentRows([SPOTTER, EXPERT, DRAFTER, LITE], [LITE, EXPERT]).map((agent) => agent.name),
    ['Lite', 'Expert', 'Contract Drafter', 'Issue Spotter'],
  );
  assert.deepEqual(agentRows([], [LITE, EXPERT]).map((agent) => agent.name), ['Lite', 'Expert'], 'the defaults alone if the list fails');
});

test('the create toast says where the skill went, from the server’s answer', () => {
  assert.equal(createdOnAgents(1, [LITE, EXPERT]), 'Saved as version 1, on Lite and Expert.');
  assert.equal(createdOnAgents(1, [LITE, EXPERT, SPOTTER]), 'Saved as version 1, on Lite, Expert and Issue Spotter.');
  assert.equal(createdOnAgents(1, []), "Saved as version 1, on no agent yet. Add one on the skill's page to use it.");
  assert.equal(createdOnAgents(1, undefined), 'Saved as version 1.', 'an older server sends no agents');
  assert.equal(agentNamesList(['Lite']), 'Lite');
});

test('the wiring: the defaults route, agent_ids on create only, the Agents row on a new skill only', () => {
  const api = read('lib', 'api', 'admin-ai.ts');
  assert.match(api, /apiClient\.get<AdminAiSkillDefaultAgentsResponse>\('\/admin\/ai-skills\/default-agents'\)/);
  const form = read('components', 'admin', 'ai', 'AiSkillFormSheet.tsx');
  assert.match(form, /is_active: data\.is_active,\n\s+\.\.\.agentIdsPayload\(chosenAgents\),/, 'sent with the create');
  assert.equal(form.match(/agentIdsPayload\(/g)?.length, 1, 'and not with an edit');
  assert.match(form, /const choosingAgents = open && !isEditMode;/);
  assert.match(form, /\) : \(\n\s+<fieldset className="space-y-2" aria-describedby="skill-agents-hint">\n\s+<legend[^>]*>Agents<\/legend>/);
  assert.match(form, /toast\.success\(response\.data \? createdOnAgents\(response\.data\.version, response\.data\.agents\) : response\.message\)/);
});
