import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DISPLAY_NAME_LABEL, displayNameField, displayNameForSave } from './agent-display-name';

/* Backend's sub-agents 88cef0fe (12 November 2026): an agent's display_name is
 * what readers see; empty, its Name is shown. The techlead sets the Lawexa
 * agents to "Lawexa" after the push. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the form sends the trimmed name, or null to clear it', () => {
  assert.equal(displayNameForSave('  Lawexa '), 'Lawexa');
  assert.equal(displayNameForSave(''), null);
  assert.equal(displayNameForSave('   '), null);
  assert.equal(displayNameForSave(undefined), null);
});

test('the field takes up to 255 characters, with the server’s own words past that', () => {
  assert.equal(displayNameField.safeParse('x'.repeat(255)).success, true);
  const long = displayNameField.safeParse('x'.repeat(256));
  assert.equal(long.success, false);
  assert.equal(long.error?.issues[0]?.message, 'The display name cannot exceed 255 characters.');
});

test('the edit page shows the field next to Name and always sends it, so emptying it clears the name', () => {
  const page = read('app', '(admin)', 'admin', 'ai', 'agents', '[id]', 'edit', 'page.tsx');
  assert.match(page, /display_name: displayNameField\.optional\(\),/);
  assert.match(page, /display_name: agent\.display_name \?\? '',/);
  assert.match(page, /const submitData: AdminAiUpdateAgentData = \{ \.\.\.formData, display_name: displayNameForSave\(formData\.display_name\) \};/);
  assert.match(page, /name="display_name"[\s\S]*\{DISPLAY_NAME_LABEL\}[\s\S]*<FormDescription>\{DISPLAY_NAME_HINT\}<\/FormDescription>/);
  assert.equal(DISPLAY_NAME_LABEL, 'Name people see');
});

test('the create sheet sends the name only when one is given', () => {
  const sheet = read('components', 'admin', 'ai', 'AiAgentFormSheet.tsx');
  assert.match(sheet, /const submitData: AdminAiCreateAgentData = \{ \.\.\.rest, \.\.\.\(shown \? \{ display_name: shown \} : \{\}\) \};/);
  assert.match(sheet, /name="display_name"[\s\S]*\{DISPLAY_NAME_LABEL\}/);
  assert.doesNotMatch(sheet, /submitData as \{/);
});
