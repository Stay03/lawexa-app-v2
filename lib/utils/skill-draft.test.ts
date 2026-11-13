import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ApiMessage, ChatMessage } from '@/types/chat';
import { diffCounts, diffLines } from './line-diff';
import {
  laterSkillDraftCard,
  readSkillDraftCard,
  skillDraftErrorSentence,
  skillDraftKindLine,
  skillDraftStatusLine,
} from './skill-draft';
import { transformApiMessages } from './transform-api-messages';

/* The skills tool's chat card (thread 2b436b4f; lawexa-api SkillDrafts::cardOf,
 * branch skills-tool 385ececc): read from the answer's metadata or the
 * completed event, worded on the card, and never moved backwards. TEST DATA. */

const CARD = {
  type: 'skill_draft',
  status: 'proposed',
  draft: '6f1c2d3e-0000-4000-8000-00000000d001',
  kind: 'change',
  name: 'cac_annual_returns',
  display_name: 'CAC annual returns',
  description: 'Files a company annual return on the CAC portal, arrears included.',
};

test('the card is read from its metadata, and anything else is not a card', () => {
  assert.deepEqual(readSkillDraftCard(CARD), {
    status: 'proposed',
    draft: CARD.draft,
    kind: 'change',
    name: 'cac_annual_returns',
    displayName: 'CAC annual returns',
    description: CARD.description,
  });
  assert.equal(readSkillDraftCard({ ...CARD, type: 'question_card' }), null);
  assert.equal(readSkillDraftCard({ ...CARD, status: 'archived' }), null);
  assert.equal(readSkillDraftCard({ ...CARD, draft: '' }), null);
  assert.equal(readSkillDraftCard(null), null);
  // A new skill with no title falls back to its name.
  assert.equal(readSkillDraftCard({ ...CARD, kind: 'new', display_name: '' })?.displayName, 'cac_annual_returns');
});

test('a stored answer with the card carries it, beside its own text', () => {
  const row = {
    id: 7,
    conversation_id: 'c1',
    agent_id: null,
    role: 'assistant',
    content: 'Here is the draft skill. Press Save to send it to an admin.',
    metadata: CARD,
    created_at: '2026-11-13T15:00:00Z',
  } as unknown as ApiMessage;
  const [message] = transformApiMessages([row]) as ChatMessage[];
  assert.equal(message.content, 'Here is the draft skill. Press Save to send it to an admin.');
  assert.equal(message.skillDraft?.draft, CARD.draft);
});

test('the card names what the draft is, and where it stands', () => {
  assert.equal(skillDraftKindLine({ kind: 'new', name: 'cac_ctc' }), 'New skill');
  assert.equal(skillDraftKindLine({ kind: 'change', name: 'cac_annual_returns' }), 'Changes cac_annual_returns');
  assert.equal(skillDraftStatusLine('proposed'), null);
  assert.equal(skillDraftStatusLine('pending'), 'Sent to an admin for approval');
  assert.equal(skillDraftStatusLine('published'), 'Approved and published');
  assert.equal(skillDraftStatusLine('rejected'), 'Not approved');
  assert.equal(skillDraftStatusLine('dismissed'), 'Not saved');
});

test('a read of the chat never moves the card backwards', () => {
  const proposed = readSkillDraftCard(CARD)!;
  const pending = { ...proposed, status: 'pending' as const };
  const published = { ...proposed, status: 'published' as const };
  // A read from before the reader's own Save still says "proposed": the card keeps "Sent".
  assert.equal(laterSkillDraftCard(pending, proposed), pending);
  // An admin's publish moves it on.
  assert.equal(laterSkillDraftCard(pending, published), published);
});

test('a failed request says what happened, in the server\'s words for a 422', () => {
  assert.equal(skillDraftErrorSentence({ status: 404, message: 'Not found', errors: null }), "This draft isn't available to you.");
  assert.equal(
    skillDraftErrorSentence({ status: 422, message: 'Validation failed', errors: { draft: ['This draft is already pending.'] } }),
    'This draft is already pending.',
  );
  assert.equal(skillDraftErrorSentence({ status: 0, message: '', errors: null }), "Couldn't reach Lawexa. Try again.");
});

test('the steps are compared line by line', () => {
  const diff = diffLines('Sign in.\nPick the year.\nPay.', 'Sign in.\nPick every year in arrears.\nPay.\nDownload the receipt.');
  assert.deepEqual(diff, [
    { kind: 'same', text: 'Sign in.' },
    { kind: 'removed', text: 'Pick the year.' },
    { kind: 'added', text: 'Pick every year in arrears.' },
    { kind: 'same', text: 'Pay.' },
    { kind: 'added', text: 'Download the receipt.' },
  ]);
  assert.deepEqual(diffCounts(diff), { added: 2, removed: 1 });
  assert.deepEqual(diffCounts(diffLines('Same.\r\nText.', 'Same.\nText.')), { added: 0, removed: 0 });
});
