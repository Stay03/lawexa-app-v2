import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Question cards on screen, design A (Stay, 13 November 2026, thread c91086ec:
 * "lets just use this and use it well"): a card docked above the message box
 * asks one question at a time, with dots for the steps, Skip, Next and ×.
 * "Something else" turns its row into a field in place, and the box steps
 * away while it types. The answers come back as the reader's own bubble, and
 * they cannot be changed afterwards (Stay, 12 November). */

const here = dirname(fileURLToPath(import.meta.url));
const conversation = join(here, '..');
const read = (...parts: string[]) => readFileSync(join(...parts), 'utf8').replace(/\r\n/g, '\n');
const caseChatCore = () => read(conversation, '..', '..', 'cases', 'detail', 'CaseChatCore.tsx');
const dock = () => read(here, 'QuestionDock.tsx');

test('a tap selects an option and moves nowhere; Next or Send confirms', () => {
  const questions = dock();
  assert.match(questions, /setDraft\(\{ option: choice \}\);/);
  assert.match(questions, /onClick=\{\(\) => next\(\)\}/);
  assert.match(questions, /\{isLast \? \(sending \? 'Sending…' : 'Send'\) : 'Next'\}/);
  // The answers go from three places only: Send on the last question (Next's), × to skip them all, and the
  // box's arrow on the last question while "Something else" is on (design A V3).
  assert.equal(questions.match(/void send\(/g)?.length, 1);
  assert.equal(questions.match(/await send\(/g)?.length, 2);
  // Each question starts on Lawexa's recommendation, or on nothing when there is none.
  assert.match(questions, /useState<\(QuestionCardAnswer \| null\)\[\]>\(\(\) => questions\.map\(startingAnswer\)\)/);
});

test('Skip leaves this question unanswered and moves on; on the last it sends', () => {
  const questions = dock();
  assert.match(
    questions,
    /const skip = \(\) => \{\s*if \(locked\) return;\s*const current = drafts\.map\(\(entry, at\) => \(at === index \? null : entry\)\);\s*setDrafts\(current\);\s*next\(current\);/,
  );
  assert.match(questions, /if \(isLast\) void send\(answersToSend\(questions, current\)\);/);
});

test('a dot of a question already passed goes back to it before Send', () => {
  const questions = dock();
  assert.match(questions, /disabled=\{locked \|\| at > reached \|\| at === index\}\s*onClick=\{\(\) => goTo\(at\)\}/);
  assert.match(questions, /setReached\(\(furthest\) => Math\.max\(furthest, at\)\);/);
});

test('Change answers is gone: nothing reopens a card once its answers went', () => {
  for (const file of [
    read(here, 'CardMarks.tsx'),
    dock(),
    read(here, 'open-card.ts'),
    read(conversation, 'ConversationScreen.tsx'),
    read(conversation, 'chat-context.tsx'),
    read(conversation, 'ChatDock.tsx'),
    caseChatCore(),
  ]) {
    assert.doesNotMatch(file, /amend|changeCardAnswers|cancelCard|Change answers/);
  }
});

test("a card's row keeps only its lead line while the dock asks: the streamed text leaves no second copy", () => {
  const row = read(conversation, 'rows', 'AssistantMessageRow.tsx');
  const early = row.indexOf('if (questionCard) {');
  assert.ok(early > 0);
  // The card's return comes before the text is drawn, and draws no text.
  assert.ok(early < row.indexOf('<ChatContent'));
  const branch = row.slice(early, row.indexOf('}', row.indexOf('<AskedQuestions rowId={message.id} card={questionCard} />')));
  assert.doesNotMatch(branch, /ChatContent|message\.content|shownText/);
  // While the turn streams, the row is a plain answer; the lead line replaces it in place.
  assert.match(row, /const questionCard = isStreaming \? undefined : \(message as ChatMessage\)\.questionCard;/);
  // Only the row that asks, while open, for a reader who may answer: the lead alone.
  const marks = read(here, 'CardMarks.tsx');
  assert.match(marks, /const answering = card\.status === 'open' && chat\?\.cardQuestions\?\.open\.rowId === rowId;/);
  assert.match(marks, /\{answering \? null : card\.status === 'open' \? \(/);
});

test('a card docks above either box, which reads "Or type a different answer" while the questions wait', () => {
  for (const host of [read(conversation, 'ChatDock.tsx'), caseChatCore()]) {
    assert.match(host, /<QuestionDock\s+key=\{openCard\.cardMessageId \?\? openCard\.rowId\}/);
    assert.match(host, /onAnswer=\{surface\.answerCard\}/);
    assert.match(host, /CARD_ANSWER_PLACEHOLDER/);
    assert.match(host, /const openCard = surface && surface\.isOwnerResolved && surface\.canSend \? surface\.questionCard : null;/);
  }
  assert.match(dock(), /export const CARD_ANSWER_PLACEHOLDER = 'Or type a different answer';/);
  // On a phone the card is capped and scrolls inside.
  assert.match(dock(), /max-h-\[60dvh\]/);
});

test('the screen hands the open card to the rows and to both boxes, held while a turn runs', () => {
  const screen = read(conversation, 'ConversationScreen.tsx');
  assert.match(screen, /held: isLoadingHistory \|\| isStreaming \|\| sendHeldBy !== null/);
  assert.match(screen, /cardQuestions=\{cardQuestions\}/);
  // Both boxes get the card and its answer (two publishes, each with its dependency list).
  assert.equal(screen.match(/\n\s+questionCard,\n/g)?.length, 4);
  assert.equal(screen.match(/\n\s+answerCard,\n/g)?.length, 4);
});

test("the reader's answers come back as their own bubble, each question with its answer", () => {
  const marks = read(here, 'CardMarks.tsx');
  assert.match(marks, /\{answer \? answerForList\(question, answer\) : 'Skipped'\}/);
  const row = read(conversation, 'rows', 'UserMessageRow.tsx');
  assert.match(row, /<CardAnswersBubble answers=\{message\.cardAnswers\} content=\{displayContent\} ground=\{BUBBLE_GROUND\[tint\]\} \/>/);
  // In both the personal row and a space chat's turn.
  assert.equal(row.match(/\{cardBubble \? \(\s*cardBubble\s*\) : pastedTexts\.length > 0 \? \(/g)?.length, 2);
});

test('the choices are one Tab stop, and the arrow keys move the choice with the focus', () => {
  const questions = dock();
  // "Something else" is the last choice in the group: the arrows reach it, and the keyboard stays on the choices.
  assert.match(questions, /tabIndex=\{at === \(choiceAt \?\? 0\) \? 0 : -1\}/);
  assert.match(questions, /tabIndex=\{choiceAt === optionCount \? 0 : -1\}/);
  assert.match(questions, /const target = optionKeyTarget\(event\.key, choiceAt, optionCount \+ 1\);[\s\S]{0,260}choose\(target, true\);[\s\S]{0,200}\.focus\(\);/);
  assert.match(questions, /pointBox\(index, ownWords, !byKey\);/);
});

test('"Something else" makes the box the field: the card sits on it, and its arrow is the one way on', () => {
  const questions = dock();
  assert.match(questions, /Something else/);
  // The card is flush on the box: no gap, no bottom corners or border; the box drops its top corners and gap.
  assert.match(questions, /className="mx-4 flex max-h-\[60dvh\] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-border bg-card"/);
  assert.match(read(conversation, 'ConversationComposer.tsx'), /joinedAbove=\{joinedAbove\}/);
  // The jurisdiction row steps away: nothing sits between the card and the box.
  assert.match(read(conversation, 'ConversationComposer.tsx'), /const showMeta = showMetaProp && !joinedAbove;/);
  // The box holds the words for the question, and the reader's own draft waits aside.
  assert.match(questions, /box\.current\?\.swap\(at === null \? \(replyDraft\.current \?\? ''\) : words\[at\]\)/);
  // While it answers, the card's Next and Skip step away.
  assert.match(questions, /\{!ownChosen && \(\s*<div className="[^"]*">\s*<button[\s\S]*?onClick=\{skip\}/);
  // Its send is the answer: files and words over the limit come back with a reason.
  assert.match(questions, /export const OTHER_ANSWER_MAX = 2000;/);
  assert.match(questions, /if \(attachments\.length > 0\) return \{ refused: ANSWER_FILES_COPY \};/);
  assert.match(questions, /if \(text\.length > OTHER_ANSWER_MAX\) return \{ refused: ANSWER_TOO_LONG_COPY \};/);
  // Both hosts route the box's send through the card, and take its hint and its arrow's name.
  for (const host of [read(conversation, 'ChatDock.tsx'), caseChatCore()]) {
    assert.match(host, /const cardBox = useCardBox\(openCard, cardDock\);/);
    assert.match(host, /cardBox\.answering \? cardBox\.answer\(message, attachments\)|if \(cardBox\.answering\) return cardBox\.answer\(message, attachments\);/);
    assert.match(host, /\{\.\.\.cardBox\.answering\}/);
    assert.match(host, /joinedAbove/);
  }
  // "Recommended" only on the option the server marks, after its label (wrapping under it when it must).
  assert.match(questions, /\{question\.recommended === at && <span className="[^"]*">Recommended<\/span>\}/);
});
