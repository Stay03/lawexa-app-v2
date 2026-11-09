import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ApiMessage, ChatMessage, QuestionCardQuestion } from '@/types/chat';
import {
  ALL_SKIPPED_LINE,
  allSkipped,
  answersLine,
  answersToSend,
  closedCard,
  readCardAnswers,
  readQuestionCard,
  skipAllAnswers,
  startingAnswer,
} from './question-card';
import { transformApiMessages } from './transform-api-messages';

/* Question cards (Arthur's go f6eaa156; Backend's shape, 9 November 2026).
 * Lawexa ends a turn with 1 to 4 questions of 2 to 4 options; the reader
 * answers them in one send, as the line they then see ("You chose: …"). */

const TONE: QuestionCardQuestion = {
  question: 'TEST DATA. Which tone should the letter take?',
  why: 'The tone decides the deadline.',
  options: [
    { label: 'Firm but polite', description: '14-day deadline.' },
    { label: 'Final demand', description: '7 days, then court.' },
    { label: 'Friendly reminder', description: 'No deadline.' },
  ],
  recommended: 0,
};
const DEADLINE: QuestionCardQuestion = {
  question: 'TEST DATA. Which deadline?',
  why: '',
  options: [
    { label: '14-day deadline', description: '' },
    { label: '7-day deadline', description: '' },
  ],
  recommended: 1,
};

const cardMeta = (extra: Record<string, unknown> = {}) => ({
  type: 'question_card',
  status: 'open',
  questions: [TONE, DEADLINE],
  answers: null,
  ...extra,
});

test('a card is read from its metadata', () => {
  const card = readQuestionCard(cardMeta());
  assert.deepEqual(card, { status: 'open', questions: [TONE, DEADLINE], answers: null });
});

test('a shape the app does not know is no card, so the answer stays plain text', () => {
  assert.equal(readQuestionCard(cardMeta({ type: 'radar_report' })), null);
  assert.equal(readQuestionCard(cardMeta({ status: 'closed' })), null);
  assert.equal(readQuestionCard(cardMeta({ questions: [] })), null);
  assert.equal(readQuestionCard(cardMeta({ questions: [TONE, TONE, TONE, TONE, TONE] })), null);
  assert.equal(readQuestionCard(cardMeta({ questions: [{ ...TONE, options: [TONE.options[0]] }] })), null);
  assert.equal(readQuestionCard(cardMeta({ questions: [{ ...TONE, options: [{ label: '' }, { label: 'B' }] }] })), null);
  assert.equal(readQuestionCard(null), null);
});

test('a recommended index outside the options is no recommendation', () => {
  const card = readQuestionCard(cardMeta({ questions: [{ ...TONE, recommended: 7 }] }));
  assert.equal(card?.questions[0].recommended, null);
});

test('stored answers come back with the card', () => {
  const card = readQuestionCard(
    cardMeta({ status: 'answered', answers: [{ option: 0, label: 'Firm but polite' }, { skipped: true, label: '7-day deadline' }] }),
  );
  assert.deepEqual(card?.answers, [{ option: 0, label: 'Firm but polite' }, { skipped: true, label: '7-day deadline' }]);
});

test("a reply's answers are read from its metadata", () => {
  assert.deepEqual(
    readCardAnswers({ type: 'question_answers', card_message_id: 41, answers: [{ option: 0 }, { text: 'Lagos' }] }),
    { cardMessageId: 41, answers: [{ option: 0 }, { text: 'Lagos' }] },
  );
  assert.equal(readCardAnswers({ type: 'question_answers', answers: [] }), null);
  assert.equal(readCardAnswers({ files: [] }), null);
});

test('each question starts on its recommended option, so Next alone takes it', () => {
  assert.deepEqual(startingAnswer(TONE), { option: 0 });
  assert.deepEqual(startingAnswer(DEADLINE), { option: 1 });
  assert.equal(startingAnswer({ ...TONE, recommended: null }), null);
});

test('the line sent and shown: chosen labels and own words, in order, skips left out', () => {
  assert.equal(answersLine([TONE, DEADLINE], [{ option: 0 }, { option: 0 }]), 'Firm but polite · 14-day deadline');
  assert.equal(answersLine([TONE, DEADLINE], [{ text: 'Very firm' }, { skipped: true }]), 'Very firm');
  assert.equal(answersLine([TONE, DEADLINE], skipAllAnswers([TONE, DEADLINE])), ALL_SKIPPED_LINE);
});

test('answers to send: nothing given, or empty own words, is a skip', () => {
  assert.deepEqual(answersToSend([TONE, DEADLINE], [{ option: 2 }, null]), [{ option: 2 }, { skipped: true }]);
  assert.deepEqual(answersToSend([TONE, DEADLINE], [{ text: '  ' }, { text: ' Lagos ' }]), [{ skipped: true }, { text: 'Lagos' }]);
  assert.equal(answersToSend([TONE, DEADLINE], [null, null]).length, 2);
});

test('× skips every question, and that reads as skipped, not chosen', () => {
  const answers = skipAllAnswers([TONE, DEADLINE]);
  assert.deepEqual(answers, [{ skipped: true }, { skipped: true }]);
  assert.equal(allSkipped(answers), true);
  assert.equal(allSkipped([{ skipped: true }, { option: 0 }]), false);
});

test('a card closes as answered with its answers, or as skipped by a typed reply', () => {
  const open = readQuestionCard(cardMeta())!;
  assert.deepEqual(closedCard(open, [{ option: 0 }, { option: 1 }]), { ...open, status: 'answered', answers: [{ option: 0 }, { option: 1 }] });
  assert.deepEqual(closedCard(open, null), { ...open, status: 'skipped' });
});

/* ── The transform ────────────────────────────────────────────────────────── */

const message = (id: number, role: ApiMessage['role'], content: string, metadata: ApiMessage['metadata'] = null): ApiMessage =>
  ({ id, conversation_id: 'c', agent_id: null, role, content, metadata, created_at: '2026-11-09T18:00:00Z' }) as ApiMessage;

test('a card is drawn as an answer carrying its card; its answers as a user turn carrying them', () => {
  const rows = transformApiMessages([
    message(1, 'user', 'TEST DATA. Draft a demand letter.'),
    message(2, 'assistant', 'TEST DATA. 1. Which tone? …', cardMeta() as ApiMessage['metadata']),
    message(3, 'user', 'Firm but polite · 14-day deadline', {
      type: 'question_answers',
      card_message_id: 2,
      answers: [{ option: 0 }, { option: 0 }],
    }),
  ]);
  assert.deepEqual(rows.map((row) => row.id), ['msg_1', 'msg_2', 'msg_3']);
  const card = rows[1] as ChatMessage;
  assert.equal(card.content, 'TEST DATA. 1. Which tone? …');
  assert.equal(card.questionCard?.status, 'open');
  assert.deepEqual((rows[2] as ChatMessage).cardAnswers, { cardMessageId: 2, answers: [{ option: 0 }, { option: 0 }] });
  assert.equal((rows[0] as ChatMessage).cardAnswers, undefined);
});

test('a card the app cannot read stays its plain-text answer, never dropped', () => {
  const rows = transformApiMessages([message(2, 'assistant', 'TEST DATA. 1. Which tone?', { type: 'question_card' } as ApiMessage['metadata'])]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].content, 'TEST DATA. 1. Which tone?');
  assert.equal((rows[0] as ChatMessage).questionCard, undefined);
});
