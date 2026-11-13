import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SkillDraft } from '@/types/skill-draft';
import {
  changedFields,
  draftKindLine,
  draftSourceLine,
  editProblem,
  importFileProblem,
  importProblem,
  publishProblem,
} from './skill-draft-model';

/* Admin AI Skills' drafts (the skills tool, thread 2b436b4f; API skills-tool
 * 385ececc): the words on the list and the draft page, and what each refused
 * request says, in the server's own sentences. TEST DATA. */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

const DRAFT: SkillDraft = {
  uuid: 'd-1',
  status: 'pending',
  source: 'chat',
  kind: 'change',
  name: 'cac_annual_returns',
  display_name: 'CAC annual returns',
  description: 'Files annual returns, arrears included.',
  instructions: 'Sign in.\nPick every year in arrears.',
  load_mode: 'on_demand',
  change_note: null,
  base_version: 3,
  live: {
    id: 9,
    version: 4,
    is_active: true,
    deleted: false,
    display_name: 'CAC annual returns',
    description: 'Files annual returns.',
    instructions: 'Sign in.\nPick the year.',
    load_mode: 'on_demand',
    changed_since_draft: true,
  },
  base: null,
  conversation: 'c-1',
  created_by: { uuid: 'u-1', name: 'TEST DATA Researcher' },
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  published_version: null,
  created_at: '2026-11-13T15:00:00Z',
  updated_at: '2026-11-13T15:00:00Z',
};

test('the draft says where it came from and what it is', () => {
  assert.equal(draftSourceLine(DRAFT), "Drafted in TEST DATA Researcher's chat");
  assert.equal(draftSourceLine({ ...DRAFT, source: 'zip' }), 'Imported from a SKILL.md zip by TEST DATA Researcher');
  assert.equal(draftKindLine(DRAFT), 'Changes cac_annual_returns');
  assert.equal(draftKindLine({ ...DRAFT, kind: 'new' }), 'New skill');
});

test('a change marks the fields that differ from the live skill', () => {
  assert.deepEqual(changedFields(DRAFT), ['description', 'instructions']);
  assert.deepEqual(changedFields({ ...DRAFT, live: null }), []);
});

test("a refused publish: 409 offers publishing over the newer version; 422 shows the server's sentence", () => {
  const newer = publishProblem({ status: 409, message: 'The live skill is at version 4, newer than version 3 this draft was written against.', errors: null });
  assert.deepEqual(newer, { kind: 'newer', message: 'The live skill is at version 4, newer than version 3 this draft was written against.' });
  const same = publishProblem({
    status: 422,
    message: 'Validation failed',
    errors: { draft: ['This draft is the same as the live skill at version 4, so publishing it would change nothing.'] },
  });
  assert.equal(same.kind, 'refused');
  assert.equal(same.message, 'This draft is the same as the live skill at version 4, so publishing it would change nothing.');
  assert.equal(publishProblem({ status: 422, message: 'x', errors: { name: ['A skill called cac_ctc already exists (it may be deleted).'] } }).message, 'A skill called cac_ctc already exists (it may be deleted).');
  assert.equal(publishProblem({ status: 0, message: '', errors: null }).kind, 'failed');
});

test("a refused import shows the server's reason; the file is checked before it is sent", () => {
  assert.equal(importProblem({ status: 422, message: 'x', errors: { file: ['The zip has no SKILL.md.'] } }), 'The zip has no SKILL.md.');
  assert.equal(importFileProblem({ name: 'skill.zip', size: 2048 }), null);
  assert.equal(importFileProblem({ name: 'skill.md', size: 2048 }), 'Choose a .zip file.');
  assert.equal(importFileProblem({ name: 'big.zip', size: 2 * 1024 * 1024 }), 'The zip is larger than 1 MB.');
  assert.equal(editProblem({ status: 422, message: 'x', errors: { draft: ['This draft is published, not waiting for review.'] } }), 'This draft is published, not waiting for review.');
});

test('the draft page offers publishing over a newer live skill, and the list has its import and tabs', () => {
  const page = read('app', '(admin)', 'admin', 'ai', 'skills', 'drafts', '[uuid]', 'page.tsx');
  assert.match(page, /problem\.kind === 'newer' \? \(\s*<Button[\s\S]{0,200}Publish over the newer version/);
  assert.match(page, /onPublishOver=\{\(\) => runPublish\(true\)\}/);
  assert.match(page, /draft\.live\?\.changed_since_draft \?/);
  const list = read('app', '(admin)', 'admin', 'ai', 'skills', 'drafts', 'page.tsx');
  assert.match(list, /Import SKILL\.md zip/);
  assert.match(list, /<SkillsTabs active="drafts" \/>/);
  assert.match(read('app', '(admin)', 'admin', 'ai', 'skills', 'page.tsx'), /<SkillsTabs active="skills" \/>/);
  const api = read('lib', 'api', 'admin-ai.ts');
  assert.match(api, /overNewer \? \{ over_newer: true \} : \{\}/);
  assert.match(api, /body\.append\('file', file\);/);
});
