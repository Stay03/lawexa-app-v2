import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  alwaysOnCostNote,
  counterLabel,
  diffSummary,
  estimateTokens,
  lineDiff,
  loadModeHint,
  LOAD_MODE_LABEL,
  restoreQuestion,
  savedAsVersion,
  SKILL_DESCRIPTION_MAX,
  SKILL_INSTRUCTIONS_MAX,
  SKILL_NAME_MAX,
  skillNameProblem,
  suggestSkillName,
  tokensLabel,
  usageLine,
} from './skill-model';

/* The skills admin pages (a1f45096; the design Stay approved at 03:06Z on 28
 * October 2026; woz's server, Irish's screens). The rules first, then the
 * wiring, pinned by source. TEST DATA throughout. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the server’s limits are the form’s limits', () => {
  assert.equal(SKILL_NAME_MAX, 64);
  assert.equal(SKILL_DESCRIPTION_MAX, 300);
  assert.equal(SKILL_INSTRUCTIONS_MAX, 20_000);
});

test('a skill name is snake_case: a lowercase letter first, single underscores, at most 64', () => {
  assert.equal(skillNameProblem('research_legal_question'), null);
  assert.equal(skillNameProblem('build_quiz_v2'), null);
  assert.equal(skillNameProblem('a'), null);
  assert.match(skillNameProblem('') ?? '', /required/);
  for (const bad of ['Research', 'research-question', '2_research', '_research', 'research_', 'research__question', 'research question']) {
    assert.notEqual(skillNameProblem(bad), null, bad);
  }
  assert.equal(skillNameProblem('a'.repeat(64)), null);
  assert.match(skillNameProblem('a'.repeat(65)) ?? '', /64/);
});

test('the suggested name follows the display name until the admin types one', () => {
  assert.equal(suggestSkillName('Research a legal question'), 'research_a_legal_question');
  assert.equal(suggestSkillName('  Draft — a Document!  '), 'draft_a_document');
  assert.equal(suggestSkillName('2026 quiz builder'), 'quiz_builder');
  assert.equal(suggestSkillName('Résumé review'), 'resume_review');
  assert.equal(skillNameProblem(suggestSkillName('TEST DATA: Build a quiz (v2)')), null);
  assert.ok(suggestSkillName('word '.repeat(40)).length <= SKILL_NAME_MAX);
});

test('the counters and the token estimate are the server’s (characters / 4)', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('x'.repeat(1240)), 310);
  assert.equal(counterLabel(1240, SKILL_INSTRUCTIONS_MAX), '1,240 / 20,000');
  assert.equal(counterLabel(0, SKILL_DESCRIPTION_MAX), '0 / 300');
  assert.equal(tokensLabel(310), '~310 tokens');
});

test('each load mode says what it does, and an always-on skill says what it costs', () => {
  assert.equal(LOAD_MODE_LABEL.on_demand, 'On demand');
  assert.equal(LOAD_MODE_LABEL.always_on, 'Always on');
  assert.match(loadModeHint('on_demand', 310), /sees the description and opens the steps/);
  assert.equal(loadModeHint('always_on', 310), 'The steps go into every turn of each agent it is on: ~310 tokens a turn.');
  assert.equal(alwaysOnCostNote(1500), 'Adds ~1,500 tokens to every turn of this agent.');
});

test('the usage line: loaded of offered on demand (woz: offered − offered_not_loaded), turns in full when always on', () => {
  const totals = { loads_on_demand: 12, loads_always_on: 0, offered: 40, offered_not_loaded: 28 };
  assert.equal(usageLine('on_demand', totals, 7), 'Loaded on 12 of 40 turns it was offered in the last 7 days.');
  assert.equal(
    usageLine('on_demand', { loads_on_demand: 0, loads_always_on: 0, offered: 0, offered_not_loaded: 0 }, 30),
    'Not offered to Lawexa in the last 30 days.',
  );
  assert.equal(
    usageLine('always_on', { loads_on_demand: 0, loads_always_on: 1, offered: 1, offered_not_loaded: 0 }, 1),
    'Given in full on 1 turn in the last day.',
  );
  assert.equal(
    usageLine('always_on', { loads_on_demand: 0, loads_always_on: 2340, offered: 2340, offered_not_loaded: 0 }, 7),
    'Given in full on 2,340 turns in the last 7 days.',
  );
});

test('a restore adds a version and says so first; a save names its version', () => {
  assert.equal(
    restoreQuestion(2, 5),
    'This saves version 2 as a new version 6. Nothing is lost: version 5 stays in the history.',
  );
  assert.equal(savedAsVersion(6), 'Saved as version 6.');
});

test('the line diff marks every line kept, removed or added, in order', () => {
  const before = ['1. Read the question.', '2. Search cases.', '3. Answer.'].join('\n');
  const after = ['1. Read the question.', '2. Ask for the court.', '3. Search cases.', '4. Answer with citations.'].join('\n');
  const lines = lineDiff(before, after);
  // Where lines changed, the old ones come first, then the new ones.
  assert.deepEqual(lines, [
    { kind: 'same', text: '1. Read the question.' },
    { kind: 'removed', text: '2. Search cases.' },
    { kind: 'removed', text: '3. Answer.' },
    { kind: 'added', text: '2. Ask for the court.' },
    { kind: 'added', text: '3. Search cases.' },
    { kind: 'added', text: '4. Answer with citations.' },
  ]);
  // A line moved down one place is kept, not removed and added.
  assert.deepEqual(lineDiff('a\nb\nc', 'x\na\nb\nc'), [
    { kind: 'added', text: 'x' },
    { kind: 'same', text: 'a' },
    { kind: 'same', text: 'b' },
    { kind: 'same', text: 'c' },
  ]);
  assert.equal(diffSummary(lines), '+3 −2');
  // Every line of each side appears once.
  assert.equal(lines.filter((line) => line.kind !== 'added').length, before.split('\n').length);
  assert.equal(lines.filter((line) => line.kind !== 'removed').length, after.split('\n').length);
  assert.equal(diffSummary(lineDiff('same\ntext', 'same\ntext')), 'No changes to the steps');
  assert.deepEqual(lineDiff('', 'new'), [
    { kind: 'removed', text: '' },
    { kind: 'added', text: 'new' },
  ]);
});

test('the API calls are woz’s routes', () => {
  const api = read('lib', 'api', 'admin-ai.ts');
  const calls: [string, RegExp][] = [
    ['list', /apiClient\.get<AdminAiSkillsListResponse>\('\/admin\/ai-skills'/],
    ['detail', /apiClient\.get<AdminAiSkillDetailResponse>\(`\/admin\/ai-skills\/\$\{id\}`\)/],
    ['create', /apiClient\.post<AdminAiMutationResponse<AdminAiSkill>>\('\/admin\/ai-skills', data\)/],
    ['update', /apiClient\.put<AdminAiMutationResponse<AdminAiSkill>>\(`\/admin\/ai-skills\/\$\{id\}`, data\)/],
    ['delete', /apiClient\.delete<AdminAiMutationResponse<null>>\(`\/admin\/ai-skills\/\$\{id\}`\)/],
    ['versions', /`\/admin\/ai-skills\/\$\{id\}\/versions`/],
    ['version', /`\/admin\/ai-skills\/\$\{id\}\/versions\/\$\{version\}`/],
    ['restore', /`\/admin\/ai-skills\/\$\{id\}\/versions\/\$\{version\}\/restore`/],
    ['attach and detach', /`\/admin\/ai-skills\/\$\{skillId\}\/agents\/\$\{agentId\}`/],
    ['usage', /`\/admin\/ai-skills\/\$\{id\}\/usage`, \{\s*params: \{ days \},/],
  ];
  for (const [name, pattern] of calls) assert.match(api, pattern, name);
});

test('a save or a restore refreshes the list, the skill and its versions; attach and detach refresh the agent too', () => {
  const hooks = read('lib', 'hooks', 'useAdminAi.ts');
  // Versions and usage hang under the skill's own key, which hangs under the skills key.
  assert.match(hooks, /skillDetail: \(id: number\) =>\s*\[\.\.\.adminAiKeys\.skills\(\), 'detail', id\] as const,/);
  assert.match(hooks, /skillVersions: \(id: number\) =>\s*\[\.\.\.adminAiKeys\.skillDetail\(id\), 'versions'\] as const,/);
  const restore = hooks.slice(hooks.indexOf('export function useRestoreAiSkillVersion'));
  assert.match(restore, /queryClient\.invalidateQueries\(\{ queryKey: adminAiKeys\.skills\(\) \}\);/);
  const attach = hooks.slice(hooks.indexOf('export function useAttachSkillToAgent'));
  assert.match(attach, /queryKey: adminAiKeys\.agentDetail\(variables\.agentId\)/);
});

test('the form fixes the name after create, counts the long fields and names the saved version', () => {
  const form = read('components', 'admin', 'ai', 'AiSkillFormSheet.tsx');
  assert.match(form, /readOnly=\{isEditMode\}/);
  assert.match(form, /'Fixed after create: Lawexa loads the skill by this name\.'/);
  // An edit never sends a name.
  const update = form.slice(form.indexOf('updateMutation.mutate('), form.indexOf('} else {', form.indexOf('updateMutation.mutate(')));
  assert.doesNotMatch(update, /name: data\.name/);
  assert.match(form, /counterLabel\(description\.length, SKILL_DESCRIPTION_MAX\)/);
  assert.match(form, /counterLabel\(instructions\.length, SKILL_INSTRUCTIONS_MAX\)/);
  assert.match(form, /<FormDescription>\{loadModeHint\(loadMode, tokens\)\}<\/FormDescription>/);
  assert.match(form, /toast\.success\(response\.data \? savedAsVersion\(response\.data\.version\) : response\.message\);/);
});

test('delete is refused while the skill is on an agent; restore asks first; an always-on skill shows its cost', () => {
  const remove = read('components', 'admin', 'ai', 'AiSkillDeleteDialog.tsx');
  assert.match(remove, /const attached = skill\.agents_count > 0;/);
  assert.match(remove, /disabled=\{attached \|\| deleteMutation\.isPending\}/);

  const versions = read('components', 'admin', 'ai', 'AiSkillVersions.tsx');
  assert.match(versions, /\{restoring \? restoreQuestion\(restoring\.version, skill\.version\) : null\}/);
  assert.match(versions, /\{current \? null : \(\s*<Button variant="ghost" size="sm" onClick=\{\(\) => setRestoring\(version\)\}>/);

  const agents = read('components', 'admin', 'ai', 'AiSkillAgentManager.tsx');
  assert.match(agents, /\{alwaysOnCostNote\(skill\.estimated_tokens\)\}/);
});

test('Skills sits under Tools in the admin menu, and its pages are the list and the skill', () => {
  const nav = read('components', 'admin', 'admin-nav-ai.tsx');
  assert.ok(nav.indexOf("url: '/admin/ai/tools'") < nav.indexOf("url: '/admin/ai/skills'"));
  const list = read('app', '(admin)', 'admin', 'ai', 'skills', 'page.tsx');
  assert.match(list, /<AiSkillsTable/);
  const detail = read('app', '(admin)', 'admin', 'ai', 'skills', '[id]', 'page.tsx');
  for (const part of ['<AiSkillAgentManager', '<AiSkillUsageCard', '<AiSkillVersions']) assert.ok(detail.includes(part), part);
});

test('the usage chart draws its bars: each Bar is a direct child of the chart, never in a fragment', () => {
  // recharts 2 finds its parts among the chart's direct children; a fragment hid every bar.
  const card = read('components', 'admin', 'ai', 'AiSkillUsageCard.tsx');
  assert.doesNotMatch(card, /<>\s*<Bar/);
  assert.match(card, /\{onDemand \? <Bar dataKey="loaded" stackId="turns"/);
  assert.match(card, /<Bar dataKey="offered_not_loaded" stackId="turns"/);
  // On demand: loaded stacked on offered-but-not-loaded, from woz's daily rows.
  assert.match(card, /loaded: Math\.max\(0, day\.offered - day\.offered_not_loaded\),/);
});

test('an agent’s page lists its skills read-only, and draws nothing for a server without them', () => {
  const card = read('components', 'admin', 'ai', 'AiAgentSkillsCard.tsx');
  assert.match(card, /if \(!skills\) return null;/);
  assert.match(card, /<Link href=\{`\/admin\/ai\/skills\/\$\{skill\.id\}`\}/);
  assert.match(card, /\{skill\.is_active \? null : <Badge variant="secondary">Inactive<\/Badge>\}/);
  // Read-only: no attach or detach here.
  assert.doesNotMatch(card, /useAttachSkillToAgent|useDetachSkillFromAgent/);
  const page = read('app', '(admin)', 'admin', 'ai', 'agents', '[id]', 'page.tsx');
  assert.match(page, /<AiAgentSkillsCard skills=\{agent\.skills\} \/>/);
  const types = read('types', 'admin-ai.ts');
  assert.match(types, /export type AdminAiAgentDetail = AdminAiAgent & \{\s*\/\*\*[^*]*\*\/\s*skills\?: AdminAiAgentSkill\[\];/);
});

test('only the list counts the loads: one skill’s page never reads loads_7d (woz’s server leaves it off)', () => {
  const types = read('types', 'admin-ai.ts');
  assert.match(types, /export interface AdminAiSkillRow extends AdminAiSkill \{\s*loads_7d: number;\s*\}/);
  assert.match(types, /interface AdminAiSkillsListResponse \{[^}]*data: AdminAiSkillRow\[\];/);
  const skillType = types.slice(types.indexOf('export interface AdminAiSkill {'), types.indexOf('export interface AdminAiSkillRow'));
  assert.doesNotMatch(skillType, /loads_7d/);
  const page = read('app', '(admin)', 'admin', 'ai', 'skills', '[id]', 'page.tsx');
  assert.doesNotMatch(page, /loads_7d/);
  assert.match(page, /\{skill\.agents_count\.toLocaleString\('en-US'\)\}/);
});
