import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LAST_KIND_NOTE } from './what-to-hide-copy';

/* "What to hide", V3 (Stay, 14 November 2026, thread cce2eafe): the six kinds
 * as tiles in a sheet, and "don't ask to save default. What ever the user
 * selects becomes their current default". The server saves the choice sent
 * with the first message; the app only reads the default. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the app never saves a default: no save call, no save control', () => {
  const api = read('lib', 'api', 'redaction-default.ts');
  assert.match(api, /get: async \(\): Promise<RedactionDefaultResponse>/);
  assert.doesNotMatch(api, /\bsave:|apiClient\.put/);
  const choice = read('v2', 'features', 'conversations', 'RedactionChoice.tsx');
  assert.doesNotMatch(choice, /useMutation|Save as my default|Use for new redacted chats|Switch/);
  // The choice still rides with the first message, where the server makes it the default.
  assert.match(read('v2', 'features', 'conversations', 'start-conversation.ts'), /redaction_categories: input\.redactionCategories,/);
});

test('the sheet shows the six kinds as tiles, opens on the current default, and keeps one kind on', () => {
  const choice = read('v2', 'features', 'conversations', 'RedactionChoice.tsx');
  assert.match(choice, /<ResponsiveOverlay\s+open=\{open\}\s+onOpenChange=\{setOpen\}\s+\/\/[^\n]*\n\s*title="What to hide"\s+size="content"/);
  assert.match(choice, /<div role="group" aria-label="What to hide" className="grid grid-cols-2 gap-2">/);
  assert.match(choice, /role="checkbox"\s+aria-checked=\{on\}/);
  // The last kind on cannot be turned off, and says why.
  assert.match(choice, /const last = on && chosen\?\.length === 1;/);
  assert.match(choice, /if \(!chosen \|\| last\) return;/);
  assert.match(choice, /\{LAST_KIND_NOTE\}/);
  // The line never cuts off: the names when they fit, else a count.
  assert.match(choice, /<FitText className="flex-1" full=\{`Redacted: \$\{summary\}`\} short=\{`Redacted: \$\{hiddenCount\(chosen\)\}`\} \/>/);
  // The ticks open on the person's current default (the home box seeds them from it).
  assert.match(read('v2', 'shell', 'designs', 'HomeComposer.tsx'), /redactionDefaultQuery\(/);
});

test('the sheet has no paragraph under its title, and keeps the last-kind note', () => {
  // Stay, 14 November 2026: "Remove the text under what to hide".
  const choice = read('v2', 'features', 'conversations', 'RedactionChoice.tsx');
  assert.doesNotMatch(choice, /description=|PERSON_1|Your next redacted chat starts with these/);
  assert.equal(LAST_KIND_NOTE, 'At least one kind stays hidden.');
});
