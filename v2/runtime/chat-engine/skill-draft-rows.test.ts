import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChatMessage, ConversationMessage } from '@/types/chat';
import type { SkillDraftCard } from '@/types/skill-draft';
import { adoptServerFields } from './server-fields';
import { withSkillDraftFromCompleted, withSkillDraftStatus } from './skill-draft-rows';
import type { EngineMessage } from './types';

/* The skills tool's card in a live chat (thread 2b436b4f): it lands on the
 * streamed answer from `completed`, or from the next read of the chat; a Save
 * or Not now on this screen moves it at once; an admin's publish reaches it
 * through a read; and nothing moves it backwards. TEST DATA. */

const here = dirname(fileURLToPath(import.meta.url));
const at = new Date('2026-11-13T15:00:00Z');
const WIRE = {
  type: 'skill_draft',
  status: 'proposed',
  draft: 'draft-2',
  kind: 'new',
  name: 'cac_ctc',
  display_name: 'CAC certified true copy',
  description: 'Gets certified copies from CAC.',
};
const card = (draft: string, status: SkillDraftCard['status']): SkillDraftCard => ({
  status,
  draft,
  kind: 'new',
  name: 'cac_ctc',
  displayName: 'CAC certified true copy',
  description: 'Gets certified copies from CAC.',
});
const answer = (id: string, extra: Partial<ChatMessage & { savedId: number }> = {}): EngineMessage =>
  ({ id, role: 'assistant', content: 'Here is the draft skill. Press Save to send it to an admin.', timestamp: at, ...extra }) as EngineMessage;
const draftOf = (row: EngineMessage) => (row as ChatMessage).skillDraft;

test("the completed event's draft lands on the streamed answer and sets the older unsaved one aside", () => {
  const rows = [answer('msg_2', { skillDraft: card('draft-1', 'proposed') }), answer('local-4', { savedId: 4 })];
  const next = withSkillDraftFromCompleted(rows, 4, WIRE);
  assert.equal(draftOf(next[1])?.draft, 'draft-2');
  assert.equal(draftOf(next[0])?.status, 'dismissed');
  // No card, an unreadable one, or no saved answer: nothing changes.
  assert.equal(withSkillDraftFromCompleted(rows, 4, undefined), rows);
  assert.equal(withSkillDraftFromCompleted(rows, null, WIRE), rows);
  assert.equal(withSkillDraftFromCompleted(rows, 9, WIRE), rows);
});

test('Save or Not now moves every row showing that draft, and only those', () => {
  const rows = [answer('msg_2', { skillDraft: card('draft-1', 'dismissed') }), answer('msg_4', { skillDraft: card('draft-2', 'proposed') })];
  const saved = withSkillDraftStatus(rows, 'draft-2', 'pending');
  assert.equal(draftOf(saved[1])?.status, 'pending');
  assert.equal(saved[0], rows[0]);
  assert.equal(withSkillDraftStatus(saved, 'draft-2', 'pending'), saved, 'the same array when nothing changed');
});

test("a read of the chat brings a streamed answer's card, and an admin's publish, but never goes back", () => {
  const streamed = [answer('local-4', { savedId: 4 })];
  const server: ConversationMessage[] = [answer('msg_4', { skillDraft: card('draft-2', 'proposed') })];
  assert.equal(draftOf(adoptServerFields(streamed, server)[0])?.status, 'proposed');

  const sent = [answer('msg_4', { skillDraft: card('draft-2', 'pending') })];
  // A read from before the Save still says "proposed": the card keeps "Sent".
  assert.equal(adoptServerFields(sent, server), sent);
  // The admin published it.
  const published: ConversationMessage[] = [answer('msg_4', { skillDraft: card('draft-2', 'published') })];
  assert.equal(draftOf(adoptServerFields(sent, published)[0])?.status, 'published');
});

test('the card sits under the answer once its turn is over, and the engine can settle it', () => {
  const row = readFileSync(join(here, '..', '..', 'features', 'conversations', 'conversation', 'rows', 'AssistantMessageRow.tsx'), 'utf8');
  assert.match(row, /const skillDraft = isStreaming \|\| draining \? undefined : \(message as ChatMessage\)\.skillDraft;/);
  assert.match(row, /\{skillDraft && <SkillDraftCardView card=\{skillDraft\} \/>\}/);
  const engine = readFileSync(join(here, 'engine.ts'), 'utf8');
  assert.match(engine, /if \(event\.skill_draft\) \{\s*setMessages\(\(msgs\) => withSkillDraftFromCompleted\(msgs, savedAnswerId, event\.skill_draft\)\);/);
  const card = readFileSync(join(here, '..', '..', 'features', 'conversations', 'conversation', 'skill-draft', 'SkillDraftCard.tsx'), 'utf8');
  assert.match(card, /onSuccess: \(response\) => chat\?\.settleSkillDraft\(card\.draft, response\.data\.status\)/);
  // The steps are asked for only when the card is opened.
  assert.match(card, /queryFn: \(\) => skillDraftsApi\.get\(card\.draft\),\s*enabled: open,/);
});
