import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ChatMessage, ConversationMessage, QuestionCard } from '@/types/chat';
import { openCardOf } from '@/v2/features/conversations/conversation/question-card/open-card';
import { CARD_CLOSED_COPY, cardRefusalCopy } from '@/v2/features/conversations/conversation/space-turn';
import { answersPayload, cardRefusalSentence, withCardFromCompleted, withOpenCardClosed } from './question-card-rows';
import { adoptServerFields } from './server-fields';
import type { EngineMessage } from './types';

/* Question cards on screen (9 November 2026): the card closes the moment the
 * server takes the reader's send, reaches a streamed answer from `completed`
 * or from the next read of the chat, and can be answered only while the chat
 * ends with it. */

const QUESTIONS: QuestionCard['questions'] = [
  {
    question: 'TEST DATA. Which tone?',
    why: '',
    options: [
      { label: 'Firm but polite', description: '' },
      { label: 'Final demand', description: '' },
    ],
    recommended: 0,
  },
];
const OPEN: QuestionCard = { status: 'open', questions: QUESTIONS, answers: null };
const at = new Date('2026-11-09T18:00:00Z');

const answer = (id: string, extra: Partial<ChatMessage & { savedId: number }> = {}): EngineMessage =>
  ({ id, role: 'assistant', content: 'TEST DATA. 1. Which tone?', timestamp: at, ...extra }) as EngineMessage;
const question = (id: string, extra: Partial<ChatMessage & { savedId: number }> = {}): EngineMessage =>
  ({ id, role: 'user', content: 'TEST DATA. Draft a letter.', timestamp: at, ...extra }) as EngineMessage;
const cardOf = (row: EngineMessage) => (row as ChatMessage).questionCard;

test('a send the server took closes the open card: answered, or skipped by a typed reply', () => {
  const rows = [question('msg_1'), answer('msg_2', { questionCard: OPEN })];
  assert.deepEqual(cardOf(withOpenCardClosed(rows, [{ option: 1 }])[1]), { ...OPEN, status: 'answered', answers: [{ option: 1 }] });
  assert.equal(cardOf(withOpenCardClosed(rows, null)[1])?.status, 'skipped');
  // Nothing open: the same array, so nothing renders again.
  const none = [question('msg_1')];
  assert.equal(withOpenCardClosed(none, null), none);
});

test("the completed event's card lands on the streamed answer, and replaces an open one", () => {
  const rows = [
    answer('msg_2', { questionCard: OPEN }),
    question('local-3', { savedId: 3 }),
    answer('local-4', { savedId: 4 }),
  ];
  const next = withCardFromCompleted(rows, 4, { type: 'question_card', status: 'open', questions: QUESTIONS, answers: null });
  assert.equal(cardOf(next[0])?.status, 'skipped');
  assert.deepEqual(cardOf(next[2]), OPEN);
});

test('a completed event without the card changes nothing; the next read brings it', () => {
  const rows = [answer('local-4', { savedId: 4 })];
  assert.equal(withCardFromCompleted(rows, 4, undefined), rows);
  assert.equal(withCardFromCompleted(rows, null, { type: 'question_card', status: 'open', questions: QUESTIONS }), rows);

  const server: ConversationMessage[] = [answer('msg_4', { questionCard: OPEN })];
  assert.deepEqual(cardOf(adoptServerFields(rows, server)[0]), OPEN);
});

test("a confidential chat's card, which has no saved id, goes on the answer just drawn", () => {
  const rows = [question('local-1'), answer('local-2')];
  const card = { type: 'question_card', status: 'open', questions: QUESTIONS, answers: null };
  assert.deepEqual(cardOf(withCardFromCompleted(rows, null, card, true)[1]), OPEN);
  // Elsewhere an answer without its id takes no card: its answers could name nothing.
  assert.equal(withCardFromCompleted(rows, null, card), rows);
  // …and the box offers it without an id only there.
  const drawn = withCardFromCompleted(rows, null, card, true);
  assert.equal(openCardOf(drawn), null);
  assert.deepEqual(openCardOf(drawn, true), { rowId: 'local-2', cardMessageId: null, card: OPEN });
});

test('answers go on the wire without the labels the row keeps', () => {
  assert.deepEqual(answersPayload([{ option: 0, label: 'Firm but polite' }, { text: 'Lagos' }, { skipped: true, label: 'B' }]), [
    { option: 0 },
    { text: 'Lagos' },
    { skipped: true },
  ]);
});

test("refused answers carry the server's sentence; the card says closed only for a closed card", () => {
  // Backend 54b85a68 refuses with a plain { message }, and a validation 422 with errors.
  const closed = cardRefusalSentence({
    success: false,
    message: 'That question card is not open in this chat. It may have been answered or replaced; type your message instead.',
    errors: null,
  });
  assert.equal(cardRefusalCopy(closed), CARD_CLOSED_COPY);
  const count = cardRefusalSentence({ success: false, message: "Send one answer for each of the card's 2 questions.", errors: null });
  assert.equal(cardRefusalCopy(count), "Send one answer for each of the card's 2 questions.");
  const files = cardRefusalSentence({
    message: 'Validation failed',
    errors: { question_answers: ['Answer the question card without attaching files; attach them in your next message.'] },
  });
  assert.equal(cardRefusalCopy(files), 'Answer the question card without attaching files; attach them in your next message.');
  assert.equal(cardRefusalCopy(cardRefusalSentence(null)), CARD_CLOSED_COPY);
});

test('a read can close a card a colleague answered, but never reopen one closed here', () => {
  const answered: QuestionCard = { ...OPEN, status: 'answered', answers: [{ option: 0 }] };
  const shownOpen = [answer('msg_2', { questionCard: OPEN })];
  assert.equal(cardOf(adoptServerFields(shownOpen, [answer('msg_2', { questionCard: answered })])[0])?.status, 'answered');

  const shownClosed = [answer('msg_2', { questionCard: answered })];
  assert.equal(adoptServerFields(shownClosed, [answer('msg_2', { questionCard: OPEN })]), shownClosed);
});

test("a reply drawn here takes its card answers from the server's copy when it lacks them", () => {
  const rows = [question('local-5', { savedId: 5 })];
  const server: ConversationMessage[] = [
    question('msg_5', { cardAnswers: { cardMessageId: 2, answers: [{ option: 0 }] } }),
  ];
  assert.deepEqual((adoptServerFields(rows, server)[0] as ChatMessage).cardAnswers, { cardMessageId: 2, answers: [{ option: 0 }] });
});

test('the questions that can be answered: an open card with its saved id, until a person sends something', () => {
  assert.deepEqual(openCardOf([question('msg_1'), answer('msg_2', { questionCard: OPEN })]), {
    rowId: 'msg_2',
    cardMessageId: 2,
    card: OPEN,
  });
  assert.deepEqual(openCardOf([answer('local-4', { savedId: 4, questionCard: OPEN })]), {
    rowId: 'local-4',
    cardMessageId: 4,
    card: OPEN,
  });
  // A turn after it closed it, whatever a stale copy says.
  assert.equal(openCardOf([answer('msg_2', { questionCard: OPEN }), question('msg_3')]), null);
  // The reader's own message before the server took it is not that turn yet:
  // a refused send takes it away, and the card must still be there.
  const unsent = question('local-3', { drawnHere: true });
  assert.deepEqual(openCardOf([answer('msg_2', { questionCard: OPEN }), unsent]), { rowId: 'msg_2', cardMessageId: 2, card: OPEN });
  assert.equal(openCardOf([answer('msg_2', { questionCard: OPEN }), question('local-3', { drawnHere: true, savedId: 3 })]), null);
  // No saved id yet: no answer can name it.
  assert.equal(openCardOf([answer('local-4', { questionCard: OPEN })]), null);
  assert.equal(openCardOf([answer('msg_2', { questionCard: { ...OPEN, status: 'skipped' } })]), null);
  assert.equal(openCardOf([answer('msg_2', { questionCard: OPEN, isStreaming: true })]), null);
  assert.equal(openCardOf([]), null);
});

test("Lawexa's own answers after an unanswered card leave it answerable; a person's message closes it", () => {
  // A sub-agent's reply wakes the chat (or a scheduled turn runs) after Lawexa
  // asked (Techlead's review, 13 November 2026): the card stays where it is.
  const step = { id: 'msg_3', role: 'tool', messageType: 'tool', toolName: 'message_agent', toolStatus: 'complete', content: '', timestamp: at } as unknown as EngineMessage;
  const woken = [question('msg_1'), answer('msg_2', { questionCard: OPEN }), step, answer('msg_4')];
  assert.deepEqual(openCardOf(woken), { rowId: 'msg_2', cardMessageId: 2, card: OPEN });
  // Even while the woken answer streams; nothing can be sent until it ends (the rows hold it).
  assert.deepEqual(openCardOf([...woken, answer('local-5', { isStreaming: true })])?.rowId, 'msg_2');
  // The person's next message closes it, as the server marks it skipped.
  assert.equal(openCardOf([...woken, question('msg_5')]), null);
  // A newer card is the one that counts: open, it is offered; closed, nothing is.
  const newer = [...woken, answer('msg_6', { questionCard: OPEN })];
  assert.equal(openCardOf(newer)?.rowId, 'msg_6');
  assert.equal(openCardOf([...woken, answer('msg_6', { questionCard: { ...OPEN, status: 'answered', answers: [{ option: 0 }] } })]), null);
});
