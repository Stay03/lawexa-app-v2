import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QueryClient } from '@tanstack/react-query';

import { hiddenCount, hiddenSummary, toggleCategory } from '@/lib/utils/redaction-categories';
import type { RedactionCategory, RedactionDefaultResponse } from '@/types/redaction';
import { defaultAfterStart, redactionDefaultKey, settleRedactionDefault } from './redaction-default-cache';
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

/* Fable's review of V3 (14 November 2026): behaviour, not the source, wherever
 * the suite can run it. TEST DATA only. */
const ALL: RedactionCategory[] = ['names', 'addresses', 'phones', 'emails', 'identity', 'financial'];
const OPTIONS = ALL.map((key) => ({ key, label: key, short_label: key, description: '' }));
const answer = (categories: RedactionCategory[]): RedactionDefaultResponse => ({ success: true, data: { categories, options: OPTIONS } });

test('after a redacted chat starts, the cached default is the choice it was sent with', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(redactionDefaultKey(31), answer(ALL));
  // Tick only names and send: the next redacted chat starts from names, not all six.
  settleRedactionDefault(client, ['names']);
  assert.deepEqual(client.getQueryData<RedactionDefaultResponse>(redactionDefaultKey(31))?.data.categories, ['names']);
  // And it is read again from the server, which stays the one source.
  assert.equal(client.getQueryState(redactionDefaultKey(31))?.isInvalidated, true);
  client.clear();
});

test('a start that sent no choice leaves the default as the server keeps it', () => {
  const kept = answer(['names', 'emails']);
  assert.equal(defaultAfterStart(kept, undefined), kept);
  assert.equal(defaultAfterStart(kept, []), kept);
  assert.equal(defaultAfterStart(undefined, ['names']), undefined);
  // The server's order, repeats and unknown keys dropped.
  assert.deepEqual(defaultAfterStart(kept, ['emails', 'names', 'emails'])?.data.categories, ['names', 'emails']);
  // The options are untouched.
  assert.equal(defaultAfterStart(kept, ['phones'])?.data.options, kept.data.options);
});

test('the stale-default sequence: names only, then home again within five minutes, sends names only', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(redactionDefaultKey(31), answer(ALL));
  settleRedactionDefault(client, toggleCategory(toggleCategory(toggleCategory(toggleCategory(toggleCategory(ALL, 'addresses'), 'phones'), 'emails'), 'identity'), 'financial'));
  // HomeComposer seeds the ticks from the cached default (pickedCategories ?? saved categories).
  const seeded = client.getQueryData<RedactionDefaultResponse>(redactionDefaultKey(31))?.data.categories ?? null;
  assert.deepEqual(seeded, ['names']);
  assert.equal(hiddenSummary(seeded, { names: 'names' }), 'names');
  assert.equal(hiddenCount(seeded), '1 of 6 kinds');
  client.clear();
});

test('the last kind on cannot be turned off; any other toggles', () => {
  assert.deepEqual(toggleCategory(['names'], 'names'), ['names']);
  assert.deepEqual(toggleCategory(['names', 'emails'], 'names'), ['emails']);
  assert.deepEqual(toggleCategory(['emails'], 'names'), ['names', 'emails']);
  assert.equal(hiddenCount(ALL), 'all 6 kinds');
  assert.equal(hiddenCount(['names', 'addresses', 'phones', 'emails']), '4 of 6 kinds');
});

test('startConversation settles the default for a redacted chat, and Change says it opens a dialog', () => {
  assert.match(read('v2', 'features', 'conversations', 'start-conversation.ts'), /if \(redacted\) settleRedactionDefault\(deps\.queryClient, input\.redactionCategories\);/);
  const choice = read('v2', 'features', 'conversations', 'RedactionChoice.tsx');
  assert.match(choice, /aria-haspopup="dialog"\s+aria-expanded=\{open\}/);
  assert.match(choice, /queryKey: redactionDefaultKey\(userId\),/);
});
