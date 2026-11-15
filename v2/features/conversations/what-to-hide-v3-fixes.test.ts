import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QueryClient } from '@tanstack/react-query';

import { hiddenSummary } from '@/lib/utils/redaction-categories';
import type { RedactionCategory, RedactionDefaultResponse } from '@/types/redaction';
import {
  FILE_RULE_PENDING,
  chatModeOf,
  fileRuleFor,
  privateModeOf,
  readAttachmentRule,
  readAttachmentRules,
  takesChosenFile,
  takesFile,
} from './attachment-rules';
import { redactionDefaultKey, settleRedactionDefault } from './redaction-default-cache';

/* Fable's re-check of Redacted mode V3 (thread cce2eafe; Techlead's brief,
 * 15 November 2026). The server holds the starting kinds and the files each
 * chat mode takes (Backend's redaction-choices 76df483f); the app reads both
 * and holds neither. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

/* ── 2. The starting kinds are the server's ─────────────────────────────── */

const SIX: RedactionCategory[] = ['names', 'addresses', 'phones', 'emails', 'identity', 'financial'];
const OPTIONS = SIX.map((key) => ({ key, label: key, short_label: key, description: '' }));
const LABELS = { names: 'names', addresses: 'addresses', phones: 'phone numbers', emails: 'emails', identity: 'IDs', financial: 'money details' };

test('a person who has not chosen sees the kinds the server starts with, and the next chat sends the same', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The server's answer for someone who never chose: its four starting kinds.
  const fresh: RedactionDefaultResponse = { success: true, data: { categories: ['names', 'addresses', 'phones', 'emails'], options: OPTIONS } };
  client.setQueryData(redactionDefaultKey(31), fresh);
  // HomeComposer seeds the ticks from that answer alone (pickedCategories ?? saved categories ?? null).
  const seeded = client.getQueryData<RedactionDefaultResponse>(redactionDefaultKey(31))?.data.categories ?? null;
  assert.equal(hiddenSummary(seeded, LABELS), 'names, addresses, phone numbers, emails');
  // Sent unchanged, the cached default stays those four.
  settleRedactionDefault(client, seeded ?? undefined);
  assert.deepEqual(client.getQueryData<RedactionDefaultResponse>(redactionDefaultKey(31))?.data.categories, ['names', 'addresses', 'phones', 'emails']);
  client.clear();
});

test('the app holds no starting set: the box sends nothing until the server has answered', () => {
  const home = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(home, /const redactionCategories = pickedCategories \?\? savedRedaction\.data\?\.data\.categories \?\? null;/);
  // With no answer yet nothing is sent, so the server uses its own default.
  assert.match(home, /\.\.\.\(redacted && redactionCategories && \{ redactionCategories \}\),/);
  for (const file of [home, read('v2', 'features', 'conversations', 'RedactionChoice.tsx'), read('lib', 'api', 'redaction-default.ts')]) {
    assert.doesNotMatch(file, /\['names', 'addresses', 'phones', 'emails'\]/);
  }
  assert.doesNotMatch(read('lib', 'api', 'redaction-default.ts'), /A new user hides all six/);
});

/* ── 3. The files each chat mode takes are the server's ─────────────────── */

const WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SERVER = {
  normal: {
    mime_types: ['application/pdf', WORD, 'application/msword', 'application/rtf', 'text/rtf', 'image/jpeg', 'image/png', 'image/webp'],
    extensions: ['.pdf', '.docx', '.doc', '.rtf', '.jpg', '.jpeg', '.png', '.webp'],
    max_bytes: 10485760,
    images: true,
    refused: 'TEST DATA. A chat takes PDF, Word, RTF and picture files.',
  },
  redacted: {
    mime_types: [WORD, 'application/msword', 'application/rtf', 'text/rtf'],
    extensions: ['.docx', '.doc', '.rtf'],
    max_bytes: 10485760,
    images: false,
    refused: "TEST DATA. A redacted chat takes Word (.doc, .docx) and RTF files only. A PDF or a picture can't be redacted, so paste its text in instead.",
  },
  confidential: {
    mime_types: [WORD, 'application/msword', 'application/rtf', 'text/rtf'],
    extensions: ['.docx', '.doc', '.rtf'],
    max_bytes: 10485760,
    images: false,
    refused: 'TEST DATA. A confidential chat takes Word (.doc, .docx) and RTF files only.',
  },
};

test("the server's rules are read per mode, and a shape the app does not know is no rule", () => {
  const rules = readAttachmentRules(SERVER);
  assert.deepEqual(Object.keys(rules), ['normal', 'redacted', 'confidential']);
  assert.deepEqual(rules.redacted?.extensions, ['.docx', '.doc', '.rtf']);
  assert.equal(rules.redacted?.images, false);
  // Broken or missing parts never widen what a chat takes.
  assert.equal(readAttachmentRule({ ...SERVER.redacted, mime_types: 'all' }), null);
  assert.equal(readAttachmentRule({ ...SERVER.redacted, refused: '' }), null);
  assert.equal(readAttachmentRule(null), null);
  assert.deepEqual(readAttachmentRules({ redacted: { nope: true } }), {});
  assert.deepEqual(readAttachmentRules(null), {});
  // Extensions come back in the ".docx" form whatever case or dot the server used.
  assert.deepEqual(readAttachmentRule({ ...SERVER.redacted, extensions: ['DOCX', '.Doc'] })?.extensions, ['.docx', '.doc']);
});

test('a redacted chat refuses a PDF and a picture with the server sentence, and takes Word and RTF', () => {
  const rule = fileRuleFor('redacted', readAttachmentRules(SERVER).redacted ?? null);
  assert.equal(rule.accept, '.docx,.doc,.rtf');
  assert.equal(takesFile(rule, { type: 'application/pdf' }), false);
  assert.equal(takesFile(rule, { type: 'image/png' }), false);
  assert.equal(takesFile(rule, { type: WORD }), true);
  assert.equal(takesFile(rule, { type: 'text/rtf' }), true);
  assert.equal(rule.refused, SERVER.redacted.refused);
  // A file chosen before redaction was switched on is judged by its type, else by its name.
  assert.equal(takesChosenFile(rule, { mime_type: 'application/pdf', file_name: 'TEST DATA.pdf' }), false);
  assert.equal(takesChosenFile(rule, { file_name: 'TEST DATA brief.PDF' }), false);
  assert.equal(takesChosenFile(rule, { file_name: 'TEST DATA brief.docx' }), true);
});

test('before the server answers, a private chat takes no file and says why; a normal chat keeps the upload rule', () => {
  const pending = fileRuleFor('redacted', null);
  assert.equal(pending.known, false);
  assert.equal(takesFile(pending, { type: WORD }), false);
  assert.equal(takesFile(pending, { type: 'application/pdf' }), false);
  assert.equal(pending.refused, FILE_RULE_PENDING);
  const normal = fileRuleFor('normal', null);
  assert.equal(takesFile(normal, { type: 'application/pdf' }), true);
  // Once the server answers for a normal chat, its rule and sentence are used.
  assert.equal(fileRuleFor('normal', readAttachmentRules(SERVER).normal ?? null).refused, SERVER.normal.refused);
});

test('a chat that is both confidential and redacted reads as confidential, as the server reads it', () => {
  assert.equal(chatModeOf(true, true), 'confidential');
  assert.equal(chatModeOf(true, false), 'redacted');
  assert.equal(chatModeOf(false, false), 'normal');
  assert.equal(privateModeOf(false, false), null);
  assert.equal(privateModeOf(true, false), 'redacted');
});

test('both chat boxes read the server rule, and the app keeps no private file list of its own', () => {
  const rules = read('v2', 'features', 'conversations', 'attachment-rules.ts');
  assert.doesNotMatch(rules, /PRIVATE_MODE_TYPES|'\.doc,\.docx,\.rtf'|privateModeFileError|allowedTypesFor|acceptedTypesFor/);
  const hook = read('v2', 'features', 'conversations', 'use-chat-file-rule.ts');
  assert.match(hook, /queryFn: chatAttachmentRulesApi\.get,/);
  assert.match(read('lib', 'api', 'chat-attachment-rules.ts'), /apiClient\.get<ChatAttachmentRulesResponse>\('\/chat\/attachment-rules'\)/);
  const chat = read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx');
  const home = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(chat, /const fileRule = useChatFileRule\(chatModeOf\(isRedacted, isConfidential\)\);/);
  assert.match(home, /const fileRule = useChatFileRule\(chatModeOf\(redacted, confidential\)\);/);
  for (const composer of [chat, home]) {
    assert.match(composer, /if \(!takesFile\(fileRule, file\)\) \{/);
    assert.match(composer, /accept=\{fileRule\.accept\}/);
    assert.doesNotMatch(composer, /application\/msword|ALLOWED_FILE_TYPES|ATTACHMENT_TYPE_ERROR/);
  }
  // The home box still refuses a file chosen before a private mode was switched on.
  assert.match(home, /uploads\.filter\(\(u\) => u\.status !== 'failed' && !takesChosenFile\(fileRule, u\)\)/);
});

/* ── 4. No paragraph under "What to hide" (Stay, 14 November 2026) ─────── */

test('"What to hide" still has no paragraph under its title', () => {
  const choice = read('v2', 'features', 'conversations', 'RedactionChoice.tsx');
  assert.match(choice, /title="What to hide"\s+size="content"/);
  assert.doesNotMatch(choice, /description=/);
});
