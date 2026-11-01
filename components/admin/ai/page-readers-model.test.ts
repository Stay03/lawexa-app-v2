import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AdminPageReaders } from '@/types/admin-ai';
import {
  NO_BACKUP,
  pageReadersError,
  pageReadersPayload,
  pageReadersSaved,
  pageReadersStart,
  readerChoices,
  readerName,
} from './page-readers-model';

/* The admin "Page readers" choice (Stay, 1c93152c, 1 November 2026; Backend's
 * contract in 384c, 649ad95c): a first reader and an optional backup, chosen
 * by name from the models that read pictures, saved as the server's own
 * `reader` strings. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const FIRST = 'anthropic/claude-haiku-5.5@anthropic';
const DATA: AdminPageReaders = {
  first: FIRST,
  backup: 'openai/gpt-6-luna@openai',
  options: [
    { model_id: 212, name: 'Claude Haiku 5.5', reader: 'anthropic/claude-haiku-5.5@anthropic' },
    { model_id: 198, name: 'GPT-6 Luna', reader: 'openai/gpt-6-luna@openai' },
  ],
};

test('the choices are the server’s picture models, and a saved reader outside them still shows', () => {
  assert.deepEqual(readerChoices(DATA).map((option) => option.name), ['Claude Haiku 5.5', 'GPT-6 Luna']);
  const old = { ...DATA, backup: 'deepseek/deepseek-v4.1-flash@deepseek' };
  assert.deepEqual(readerChoices(old).at(-1), { model_id: 0, name: 'deepseek/deepseek-v4.1-flash@deepseek', reader: 'deepseek/deepseek-v4.1-flash@deepseek' });
  assert.equal(readerName(readerChoices(DATA), 'openai/gpt-6-luna@openai'), 'GPT-6 Luna');
});

test('the save sends the server’s reader strings, the backup may be none, and never the first again', () => {
  assert.deepEqual(pageReadersPayload(FIRST, 'openai/gpt-6-luna@openai'), { first: FIRST, backup: 'openai/gpt-6-luna@openai' });
  assert.deepEqual(pageReadersPayload(FIRST, NO_BACKUP), { first: FIRST, backup: null });
  assert.equal(pageReadersError(FIRST, FIRST), 'The backup must be a different model from the first.');
  assert.equal(pageReadersError('', NO_BACKUP), 'Choose the model that reads scanned pages first.');
  // The server may hold no first reader yet.
  assert.equal(pageReadersError(null, NO_BACKUP), 'Choose the model that reads scanned pages first.');
  assert.deepEqual(pageReadersStart({ ...DATA, first: null, backup: null }), { first: '', backup: NO_BACKUP });
  assert.equal(pageReadersError(FIRST, NO_BACKUP), null);
});

test('the save’s confirmation names the models as the admin chose them', () => {
  const choices = readerChoices(DATA);
  assert.equal(
    pageReadersSaved(choices, { first: FIRST, backup: 'openai/gpt-6-luna@openai' }),
    'Scanned pages are now read by Claude Haiku 5.5, with GPT-6 Luna as the backup.',
  );
  assert.equal(pageReadersSaved(choices, { first: FIRST, backup: null }), 'Scanned pages are now read by Claude Haiku 5.5, with no backup.');
});

test('the card sits on the admin AI Models page and reads and saves the page readers route', () => {
  assert.match(read('app', '(admin)', 'admin', 'ai', 'models', 'page.tsx'), /<PageReadersCard \/>/);
  const api = read('lib', 'api', 'admin-ai.ts');
  assert.match(api, /apiClient\.get<AdminPageReadersResponse>\('\/admin\/page-readers'\)/);
  assert.match(api, /apiClient\.put<AdminPageReadersResponse>\('\/admin\/page-readers', data\)/);
  const card = read('components', 'admin', 'ai', 'PageReadersCard.tsx');
  // A refusal names the bad entry under errors.first.
  assert.match(card, /setServerError\(apiError\.errors\?\.first\?\.\[0\] \?\? apiError\.message\);/);
  assert.match(card, />Reads scanned pages first</);
  // A refetch moves an untouched form and leaves unsaved edits alone.
  assert.match(card, /const \{ first, backup \} = edits \?\? saved;/);
  assert.doesNotMatch(card, /<PageReadersForm key=/);
  assert.match(card, />Backup \(used when the first fails on a page\)</);
});
