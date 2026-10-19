import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { POOR_REASONS, mayOffer, reasonReady, type ChatMoment, type OfferInputs } from './model';
import { beginOffer, currentMomentSeq, endOffer, noteAnswerStreaming, noteChatMoment } from './store';

/* "How is Lawexa doing?" (Arthur, 19 October 2026; build go 09:59 UTC).
 * Choices: rephrase left out; Space chats in; closing or ignoring counts as
 * asked; the server holds the 14 days and the new-user rule. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const moment = (over: Partial<ChatMoment> = {}): ChatMoment => ({
  trigger: 'copy',
  messageId: 42,
  awaitsNewAnswer: false,
  streamed: false,
  seq: 5,
  ...over,
});
const ready = (over: Partial<OfferInputs> = {}): OfferInputs => ({
  isAccount: true,
  eligible: true,
  askedThisSession: false,
  isStreaming: false,
  quizInProgress: false,
  moment: moment(),
  seqAtMount: 0,
  ...over,
});

test('the banner appears after a moment, for an eligible account, between answers', () => {
  assert.equal(mayOffer(ready()), true);
});

test('never for a guest or a bot, never without the server’s yes, never twice a session', () => {
  assert.equal(mayOffer(ready({ isAccount: false })), false);
  assert.equal(mayOffer(ready({ eligible: false })), false);
  // Not known yet (the request is out, or failed): no banner.
  assert.equal(mayOffer(ready({ eligible: null })), false);
  assert.equal(mayOffer(ready({ askedThisSession: true })), false);
});

test('never during an answer, never mid-quiz, never without a moment in this chat', () => {
  assert.equal(mayOffer(ready({ isStreaming: true })), false);
  assert.equal(mayOffer(ready({ quizInProgress: true })), false);
  assert.equal(mayOffer(ready({ moment: null })), false);
  // A moment from before this chat's box appeared (a case page's side chat,
  // another chat) is not about this one.
  assert.equal(mayOffer(ready({ seqAtMount: 5 })), false);
  assert.equal(mayOffer(ready({ seqAtMount: 4 })), true);
});

test('Ask again waits for the new answer to be written', () => {
  const asked = moment({ trigger: 'regenerate', awaitsNewAnswer: true });
  assert.equal(mayOffer(ready({ moment: asked })), false);
  assert.equal(mayOffer(ready({ moment: { ...asked, streamed: true }, isStreaming: true })), false);
  assert.equal(mayOffer(ready({ moment: { ...asked, streamed: true } })), true);
});

test('Poor’s reasons are Arthur’s, in his order, and only "Something else" needs words', () => {
  assert.deepEqual(
    POOR_REASONS.map((reason) => [reason.key, reason.label]),
    [
      ['wrong_citation', 'Wrong citation'],
      ['missed_case_or_statute', 'Missed a case or statute'],
      ['outdated_law', 'Outdated law'],
      ['didnt_answer', 'Didn’t answer'],
      ['too_slow', 'Too slow'],
      ['something_else', 'Something else'],
    ],
  );
  assert.equal(reasonReady('too_slow', ''), true);
  assert.equal(reasonReady('something_else', '   '), false);
  assert.equal(reasonReady('something_else', 'It cited a repealed section'), true);
  assert.equal(reasonReady('something_else', 'x'.repeat(4501)), false);
  assert.equal(reasonReady(null, 'anything'), false);
});

test('one ask a session: the first offer takes the moment, later moments wait for the next session', () => {
  const before = currentMomentSeq();
  noteChatMoment('regenerate', 7);
  assert.equal(currentMomentSeq(), before + 1);
  noteAnswerStreaming();
  assert.equal(beginOffer('conv-1'), true);
  assert.equal(beginOffer('conv-1'), false);
  noteChatMoment('copy', 8);
  assert.equal(currentMomentSeq(), before + 1, 'a moment after the ask is not recorded');
  endOffer();
});

test('the moments are hooked where they happen, and only inside an answer', () => {
  const row = read('v2', 'features', 'conversations', 'conversation', 'rows', 'AssistantMessageRow.tsx');
  assert.match(row, /<AnswerScope messageId=\{savedId\}>/);
  assert.match(row, /await navigator\.clipboard\.writeText\(text\);\s*noteMoment\('copy'\);/);
  assert.match(row, /onClick=\{\(\) => \{\s*noteMoment\('regenerate'\);\s*onRegenerate\(\);\s*\}\}/);
  const link = read('v2', 'features', 'conversations', 'conversation', 'markdown', 'CaseMentionLink.tsx');
  assert.match(link, /onClick=\{\(\) => noteMoment\('cited_case'\)\}/);
  assert.match(link, /onOpen=\{\(\) => noteMoment\('cited_case'\)\}/);
  const preview = read('v2', 'features', 'conversations', 'conversation', 'markdown', 'CasePreview.tsx');
  assert.equal(preview.match(/onClick=\{\(\) => noteMoment\('cited_case'\)\}/g)?.length, 2);
  // A note's case link uses the same component: outside an answer, nothing is reported.
  const scope = read('v2', 'features', 'chat-rating', 'answer-scope.tsx');
  assert.match(scope, /createContext<number \| null \| undefined>\(undefined\)/);
  assert.match(scope, /if \(messageId !== undefined\) noteChatMoment\(trigger, messageId\);/);
  // Mid-quiz: an answer picked and not submitted.
  const quiz = read('v2', 'features', 'conversations', 'conversation', 'cards', 'QuizCard.tsx');
  assert.match(quiz, /const underWay = Object\.keys\(answers\)\.length > 0 && !isSubmitted;/);
  assert.match(quiz, /return \(\) => setQuizUnderWay\(quizId, false\);/);
});

test('the banner sits above every chat’s box, and the home box has none', () => {
  const dock = read('v2', 'features', 'conversations', 'conversation', 'ChatDock.tsx');
  assert.match(dock, /<ChatRatingSlot conversationId=\{conversationId\} isStreaming=\{surface\.isStreaming\} \/>\s*<ConversationComposer/);
  assert.doesNotMatch(read('v2', 'shell', 'designs', 'HomeComposer.tsx'), /ChatRating/);
});

test('shown and closed are reported, and a rating carries its answer and its moment', () => {
  const banner = read('v2', 'features', 'chat-rating', 'ChatRatingBanner.tsx');
  assert.match(banner, /if \(offerNow && beginOffer\(conversationId\)\) \{\s*void feedbackApi\.chatPromptSeen\('shown'\)/);
  assert.match(banner, /void feedbackApi\.chatPromptSeen\('closed'\)/);
  assert.match(banner, /conversationId: offer\.conversationId,\s*messageId: offer\.messageId,\s*trigger: offer\.trigger,/);
  const api = read('lib', 'api', 'feedback.ts');
  assert.match(api, /content_type: 'conversation',/);
  assert.match(api, /\.\.\.\(data\.messageId !== null \? \{ message_id: data\.messageId \} : \{\}\),/);
  assert.match(api, /\.\.\.\(data\.reason === 'something_else' && data\.text \? \{ text: data\.text \} : \{\}\),/);
  assert.match(api, /apiClient\.post\('\/feedback\/chat-prompt\/seen', \{ action \}\)/);
  assert.match(api, /apiClient\.get<\{ data: ChatPromptEligibility \}>\('\/feedback\/chat-prompt'\)/);
});
