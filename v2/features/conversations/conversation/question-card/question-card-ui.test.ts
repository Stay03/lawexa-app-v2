import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Question cards on screen (Arthur's go f6eaa156; techlead's review, 9
 * November 2026): a tap selects and Next or Send confirms; the questions'
 * streamed text leaves no second copy once the card is drawn; and the card
 * sits above the box of every chat, the case page's side chat included. */

const here = dirname(fileURLToPath(import.meta.url));
const conversation = join(here, '..');
const read = (...parts: string[]) => readFileSync(join(...parts), 'utf8');

test('a tap selects an option and moves nowhere; Next or Send confirms', () => {
  const panel = read(here, 'QuestionCardPanel.tsx');
  assert.match(panel, /const choose = \(option: number\) => \{\s*if \(locked\) return;\s*setDraft\(\{ option \}\);\s*\};/);
  assert.match(panel, /onClick=\{\(\) => advance\(drafts\)\}/);
  assert.match(panel, /\{isLast \? \(sending \? 'Sending…' : 'Send'\) : 'Next'\}/);
  // Skip never sends: on the last question it only clears the choice (Arthur, 05650d00).
  assert.match(panel, /const skip = \(\) => \{\s*if \(locked\) return;\s*setDraft\(null\);\s*if \(!isLast\) setIndex\(index \+ 1\);\s*\};/);
  // The answers go from two places only: Send (advance on the last question) and × (skip all).
  assert.equal(panel.match(/void send\(/g)?.length, 2);
});

test('changing answers: the card starts on them, × keeps them, and only the latest line offers it', () => {
  const panel = read(here, 'QuestionCardPanel.tsx');
  assert.match(panel, /\(\) => open\.amend\?\.prefill \?\? questions\.map\(startingAnswer\),/);
  assert.match(panel, /onClick=\{\(\) => \(keepOnClose \? onCancel\?\.\(\) : void send\(skipAllAnswers\(questions\)\)\)\}/);
  const marks = read(here, 'CardMarks.tsx');
  assert.match(
    marks,
    /who === null && chat && !chat\.isStreaming && chat\.changeCardAnswers\?\.rowId === rowId \? chat\.changeCardAnswers : null/,
  );
  assert.match(marks, /\{answers\.amend \? 'changed' : 'chose'\}/);
  // Both boxes pass × through.
  assert.match(read(conversation, 'ChatDock.tsx'), /onCancel=\{surface\.cancelCard\}/);
  assert.match(read(conversation, '..', '..', 'cases', 'detail', 'CaseChatCore.tsx'), /onCancel=\{surface\.cancelCard\}/);
});

test("a card's row draws only its mark: the streamed questions leave no second copy", () => {
  const row = read(conversation, 'rows', 'AssistantMessageRow.tsx');
  const early = row.indexOf('if (questionCard) {');
  assert.ok(early > 0);
  // The card's return comes before the text is drawn, and draws no text.
  assert.ok(early < row.indexOf('<ChatContent'));
  const branch = row.slice(early, row.indexOf('}', row.indexOf('<CardMark card={questionCard} />')));
  assert.doesNotMatch(branch, /ChatContent|message\.content|shownText/);
  // While the turn streams, the row is a plain answer; the card replaces it in place.
  assert.match(row, /const questionCard = isStreaming \? undefined : \(message as ChatMessage\)\.questionCard;/);
});

test("the card sits above the chat's own box and the case page's side chat box", () => {
  assert.match(read(conversation, 'ChatDock.tsx'), /<OpenQuestionCard\s+open=\{openCard\}/);
  const caseChat = read(conversation, '..', '..', 'cases', 'detail', 'CaseChatCore.tsx');
  assert.match(caseChat, /<OpenQuestionCard\s+open=\{openCard\}/);
  // A new card starts fresh by its own key, inside the wrapper: no key sits
  // beside a host's box, whose node must never be remounted.
  const panel = read(here, 'QuestionCardPanel.tsx');
  assert.match(panel, /const key = `\$\{props\.open\.cardMessageId \?\? 'unsaved'\}\$\{props\.open\.amend \? ':change' : ''\}`;/);
  assert.match(panel, /<QuestionCardPanel key=\{key\} \{\.\.\.props\} \/>/);
  // Only for a reader who may answer. It stays up, disabled, while a turn runs:
  // taken down for its own answers' send, it came back empty after a refusal.
  for (const host of [caseChat, read(conversation, 'ChatDock.tsx')]) {
    assert.match(host, /const openCard = surface && surface\.isOwnerResolved && surface\.canSend \? surface\.questionCard : null;/);
    assert.match(host, /disabled=\{[^}]*surface\.isStreaming\}/);
  }
  // The screen publishes the card to both boxes.
  const screen = read(conversation, 'ConversationScreen.tsx');
  assert.equal(screen.match(/\r?\n\s+questionCard,\r?\n\s+answerCard,\r?\n/g)?.length, 4);
});
