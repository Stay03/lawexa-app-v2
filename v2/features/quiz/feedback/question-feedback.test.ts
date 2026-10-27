import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canSendFeedback } from '@/v2/features/feedback/feedback-model';
import {
  QUIZ_FEEDBACK_REASONS,
  attemptQuestionSnapshot,
  quizFeedbackBody,
  quizFeedbackRefusal,
} from './question-feedback';

/* "Report a problem with this question" on a quiz question (Arthur, 26
 * October 2026; thread 87b8e449), sent to POST /feedback in Backend's shape:
 * a practice question or an authored/AI quiz's by content_uuid, a chat quiz
 * card by its answer's content_id and its place in it. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const code = (...parts: string[]) =>
  read(...parts).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SNAPSHOT = {
  position: 2,
  questionText: '  TEST DATA: Which court hears an appeal from the High Court?  ',
  chosenOption: 'TEST DATA Supreme Court',
  correctOption: 'TEST DATA Court of Appeal',
};

test('the five reasons are the server’s, in its words', () => {
  assert.deepEqual(
    QUIZ_FEEDBACK_REASONS.map(({ id, label }) => `${id}: ${label}`),
    [
      'wrong_answer: The answer marked correct is wrong',
      'unclear_question: The question is unclear',
      'typo: Typo or wording',
      'outdated_law: The law has changed',
      'other: Something else',
    ],
  );
});

test('a practice question goes by its uuid, with its session and what the reader saw', () => {
  const body = quizFeedbackBody({ kind: 'practice', questionUuid: 'q-1', sessionUuid: 's-1' }, SNAPSHOT, ['typo'], '');
  assert.deepEqual(body, {
    content_type: 'quiz_question',
    content_uuid: 'q-1',
    context: {
      reasons: ['typo'],
      question_text: 'TEST DATA: Which court hears an appeal from the High Court?',
      position: 2,
      chosen_option: 'TEST DATA Supreme Court',
      correct_option: 'TEST DATA Court of Appeal',
      session_uuid: 's-1',
    },
  });
});

test('an authored quiz’s question carries its quiz and attempt, and the words as feedback_text', () => {
  const body = quizFeedbackBody(
    { kind: 'quiz', questionUuid: 'q-2', quizUuid: 'quiz-1', attemptUuid: 'a-1' },
    SNAPSHOT,
    ['other', 'wrong_answer', 'other'],
    '  It should be the Court of Appeal.  ',
  );
  assert.equal(body.content_type, 'channel_quiz_question');
  assert.equal(body.content_uuid, 'q-2');
  assert.equal(body.feedback_text, 'It should be the Court of Appeal.');
  // In the form's order, once each.
  assert.deepEqual(body.context.reasons, ['wrong_answer', 'other']);
  assert.equal(body.context.quiz_uuid, 'quiz-1');
  assert.equal(body.context.attempt_uuid, 'a-1');
});

test('a chat quiz card goes by its saved answer and its place in it, with no position', () => {
  const body = quizFeedbackBody(
    { kind: 'chat', messageId: 812, quizIndex: 1 },
    { ...SNAPSHOT, position: null, chosenOption: null },
    ['unclear_question'],
    '',
  );
  assert.equal(body.content_type, 'message');
  assert.equal(body.content_id, 812);
  assert.equal(body.context.quiz_index, 1);
  assert.equal('position' in body.context, false);
  assert.equal('chosen_option' in body.context, false);
  assert.equal('content_uuid' in body, false);
});

test('the snapshot is cut to the server’s limits', () => {
  const body = quizFeedbackBody(
    { kind: 'practice', questionUuid: 'q-1', sessionUuid: 's-1' },
    { position: 0, questionText: 'x'.repeat(2500), chosenOption: 'y'.repeat(1200), correctOption: null },
    [],
    'z'.repeat(6000),
  );
  assert.equal(body.context.question_text.length, 2000);
  assert.equal(body.context.chosen_option?.length, 1000);
  assert.equal(body.feedback_text?.length, 5000);
  assert.equal(body.context.position, 0);
});

test('a report needs a reason or some words', () => {
  assert.equal(quizFeedbackRefusal([], '   '), 'Tick a reason or tell us in your own words.');
  assert.equal(quizFeedbackRefusal(['typo'], ''), null);
  assert.equal(quizFeedbackRefusal([], 'The date is wrong.'), null);
});

test('a solo question is reported at its own 0-based position, with the picked and the right option', () => {
  const snapshot = attemptQuestionSnapshot({
    question: 'TEST DATA: Who signs the return?',
    position: 3,
    options: [
      { id: 1, content: 'TEST DATA The company secretary', position: 0 },
      { id: 2, content: 'TEST DATA A director', position: 1 },
    ],
    your_option_id: 1,
    correct_option_id: 2,
  });
  assert.deepEqual(snapshot, {
    position: 3,
    questionText: 'TEST DATA: Who signs the return?',
    chosenOption: 'TEST DATA The company secretary',
    correctOption: 'TEST DATA A director',
  });
});

test('only an account may report; a guest pass and a signed-out reader see no flag', () => {
  assert.equal(canSendFeedback({ signedIn: true, role: 'user' }), true);
  assert.equal(canSendFeedback({ signedIn: true, role: 'guest' }), false);
  assert.equal(canSendFeedback({ signedIn: false, role: null }), false);
  const button = code('v2', 'features', 'quiz', 'feedback', 'QuestionFeedbackButton.tsx');
  assert.match(button, /if \(!canSendFeedback\(session\)\) return null;/);
  // The page feedback button too: the server refuses a guest's report.
  const pages = code('v2', 'features', 'feedback', 'FeedbackButton.tsx');
  assert.match(pages, /if \(!canSendFeedback\(session\)\) return null;/);
});

test('the flag shows where the answer is shown, never while a clock runs', () => {
  // Practice: on every review card (the stepper draws the card).
  const card = code('v2', 'features', 'quiz', 'results', 'ResultItemCard.tsx');
  assert.match(card, /<QuestionFeedbackButton\s+target=\{\{ kind: 'practice', questionUuid: question\.uuid, sessionUuid \}\}/);
  assert.match(code('v2', 'features', 'quiz', 'results', 'ReviewStepper.tsx'), /<ResultItemCard item=\{current\} index=\{currentIndex\} sessionUuid=\{sessionUuid\} \/>/);
  // Solo: on every answers page, and never while playing (Arthur, 27 October
  // 2026: a flag on the reveal let a reader pause the quiz to read the answer).
  const play = code('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  assert.doesNotMatch(play, /QuestionFeedbackButton|attemptQuestionSnapshot|reporting/);
  assert.match(code('v2', 'features', 'quiz', 'solo', 'results', 'AnswersStepper.tsx'), /snapshot=\{attemptQuestionSnapshot\(question\)\}/);
  // A chat quiz card: once answered (the result footer) and saved.
  const chat = code('v2', 'features', 'conversations', 'conversation', 'cards', 'QuizCard.tsx');
  assert.match(chat, /\{savedMessageId !== null && quizNumber !== undefined \? \(\s*<QuestionFeedbackButton/);
  assert.match(chat, /target=\{\{ kind: 'chat', messageId: savedMessageId, quizIndex: quizNumber - 1 \}\}/);
});

test('nothing holds the solo reveal: it moves on after its hold, or on a tap', () => {
  const play = code('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  assert.match(play, /if \(!holding\) return;\s*const id = window\.setTimeout\(\(\) => moveOnAfterHold\(\), REVEAL_HOLD_MS\);/);
  assert.match(play, /\}, \[holding, cursor\]\);/);
  assert.match(play, /onClick=\{holding \? moveOn : undefined\}/);
  assert.doesNotMatch(play, /holdRuns/);
  // A live channel game never had the flag, and still has none.
  assert.doesNotMatch(code('v2', 'features', 'channels', 'quiz', 'GamePhases.tsx'), /QuestionFeedbackButton/);
  // The flag's own tap never reaches a screen's "tap to move on".
  assert.match(code('v2', 'features', 'quiz', 'feedback', 'QuestionFeedbackButton.tsx'), /event\.stopPropagation\(\);\s*change\(true\);/);
});

test('a lost or refused report says why, the server’s ten-a-minute limit included', async () => {
  const { feedbackFailureText } = await import('@/v2/features/feedback/feedback-model');
  assert.equal(
    feedbackFailureText({ offline: true, status: null, serverMessage: 'Network Error' }),
    "Couldn't reach Lawexa, so nothing was sent. Your report is still here: try again.",
  );
  assert.equal(
    feedbackFailureText({ offline: false, status: 429, serverMessage: 'Too Many Attempts.' }),
    'That is a lot of reports in a minute. Your report is still here: try again shortly.',
  );
  assert.equal(feedbackFailureText({ offline: false, status: 422, serverMessage: 'The specified question does not exist.' }), 'The specified question does not exist.');
});
