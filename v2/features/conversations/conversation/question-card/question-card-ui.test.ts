import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Question cards on screen, design B (Arthur's pick, 13 November 2026, thread
 * c91086ec): the questions are asked inside Lawexa's answer, where it asked,
 * not on a card above the box. A tap selects and Next or Send confirms; the
 * answers come back as the reader's own bubble; and they cannot be changed
 * afterwards (Stay, 12 November). */

const here = dirname(fileURLToPath(import.meta.url));
const conversation = join(here, '..');
const read = (...parts: string[]) => readFileSync(join(...parts), 'utf8');
const caseChatCore = () => read(conversation, '..', '..', 'cases', 'detail', 'CaseChatCore.tsx');

test('a tap selects an option and moves nowhere; Next or Send confirms', () => {
  const questions = read(here, 'InlineQuestions.tsx');
  assert.match(
    questions,
    /const choose = \(option: number\) => \{\s*if \(locked\) return;\s*setDrafts\(\(current\) => current\.map\(\(entry, at\) => \(at === index \? \{ option \} : entry\)\)\);\s*\};/,
  );
  assert.match(questions, /onClick=\{next\}/);
  assert.match(questions, /\{isLast \? \(sending \? 'Sending…' : 'Send'\) : 'Next'\}/);
  // The answers go from two places only: Send on the last question, and the skip button.
  assert.equal(questions.match(/void send\(/g)?.length, 2);
  // Each question starts on Lawexa's recommendation.
  assert.match(questions, /useState<\(QuestionCardAnswer \| null\)\[\]>\(\(\) => questions\.map\(startingAnswer\)\)/);
});

test('"Skip the rest" keeps the answers given so far and skips this question and the later ones', () => {
  const questions = read(here, 'InlineQuestions.tsx');
  assert.match(
    questions,
    /const skipRest = \(\) => void send\(answersToSend\(questions, drafts\.map\(\(draft, at\) => \(at < index \? draft : null\)\)\)\);/,
  );
  assert.match(questions, /\{count === 1 \? 'Skip' : isLast \? 'Skip and send' : 'Skip the rest'\}/);
});

test('an answered question folds to its choice, and a tap opens it again before Send', () => {
  const questions = read(here, 'InlineQuestions.tsx');
  assert.match(questions, /if \(at < index\) \{[\s\S]{0,400}onClick=\{\(\) => goTo\(at\)\}/);
  assert.match(questions, /\{words \?\? 'Skipped'\}/);
});

test('Change answers is gone: nothing reopens a card once its answers went', () => {
  for (const file of [
    read(here, 'CardMarks.tsx'),
    read(here, 'InlineQuestions.tsx'),
    read(here, 'open-card.ts'),
    read(conversation, 'ConversationScreen.tsx'),
    read(conversation, 'chat-context.tsx'),
    read(conversation, 'ChatDock.tsx'),
    caseChatCore(),
  ]) {
    assert.doesNotMatch(file, /amend|changeCardAnswers|cancelCard|Change answers/);
  }
});

test("a card's row asks the questions itself: the streamed text leaves no second copy", () => {
  const row = read(conversation, 'rows', 'AssistantMessageRow.tsx');
  const early = row.indexOf('if (questionCard) {');
  assert.ok(early > 0);
  // The card's return comes before the text is drawn, and draws no text.
  assert.ok(early < row.indexOf('<ChatContent'));
  const branch = row.slice(early, row.indexOf('}', row.indexOf('<AskedQuestions rowId={message.id} card={questionCard} />')));
  assert.doesNotMatch(branch, /ChatContent|message\.content|shownText/);
  // While the turn streams, the row is a plain answer; the questions replace it in place.
  assert.match(row, /const questionCard = isStreaming \? undefined : \(message as ChatMessage\)\.questionCard;/);
  // Only the row that asks, while open, for a reader who may answer.
  const marks = read(here, 'CardMarks.tsx');
  assert.match(
    marks,
    /const answering = card\.status === 'open' && chat\?\.cardQuestions\?\.open\.rowId === rowId \? chat\.cardQuestions : null;/,
  );
});

test('no card sits above either box; each box reads "Or type a different answer" while the questions wait', () => {
  for (const host of [read(conversation, 'ChatDock.tsx'), caseChatCore()]) {
    assert.doesNotMatch(host, /OpenQuestionCard|QuestionCardPanel/);
    assert.match(host, /CARD_ANSWER_PLACEHOLDER/);
    assert.match(host, /const openCard = surface && surface\.isOwnerResolved && surface\.canSend \? surface\.questionCard : null;/);
  }
  assert.match(read(here, 'InlineQuestions.tsx'), /export const CARD_ANSWER_PLACEHOLDER = 'Or type a different answer';/);
});

test('the screen hands the open card to the rows, held while a turn runs, and the boxes only see it', () => {
  const screen = read(conversation, 'ConversationScreen.tsx');
  assert.match(screen, /held: isLoadingHistory \|\| isStreaming \|\| sendHeldBy !== null/);
  assert.match(screen, /cardQuestions=\{cardQuestions\}/);
  // Both boxes get the card, for the hint and nothing else.
  assert.equal(screen.match(/\r?\n\s+questionCard,\r?\n/g)?.length, 4);
  assert.doesNotMatch(screen, /answerCard,\r?\n/);
});

test("the reader's answers come back as their own bubble, each question with its answer", () => {
  const marks = read(here, 'CardMarks.tsx');
  assert.match(marks, /\{answer \? answerForList\(question, answer\) : 'Skipped'\}/);
  const row = read(conversation, 'rows', 'UserMessageRow.tsx');
  assert.match(row, /<CardAnswersBubble answers=\{message\.cardAnswers\} content=\{displayContent\} ground=\{BUBBLE_GROUND\[tint\]\} \/>/);
  // In both the personal row and a space chat's turn.
  assert.equal(row.match(/\{cardBubble \? \(\s*cardBubble\s*\) : pastedTexts\.length > 0 \? \(/g)?.length, 2);
});
