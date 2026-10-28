import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { POOR_REASONS, mayOffer, reasonReady, type ChatMoment, type OfferInputs } from './model';
import { beginOffer, endOffer, noteAnswerStreaming, noteChatMoment } from './store';

/* "How is Lawexa doing?" (Arthur, 19 October 2026; build go 09:59 UTC).
 * Choices: rephrase left out; Space chats in; closing or ignoring counts as
 * asked; the server holds the 14 days and the new-user rule. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const moment = (over: Partial<ChatMoment> = {}): ChatMoment => ({
  trigger: 'copy',
  messageId: 42,
  awaitsNewAnswer: false,
  streamed: false,
  conversationId: 'conv-1',
  seq: 5,
  ...over,
});
const ready = (over: Partial<OfferInputs> = {}): OfferInputs => ({
  isAccount: true,
  eligible: true,
  serverMoment: null,
  askedThisSession: false,
  isStreaming: false,
  quizInProgress: false,
  moment: moment(),
  conversationId: 'conv-1',
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
  // A moment in another chat is not about this one.
  assert.equal(mayOffer(ready({ conversationId: 'conv-2' })), false);
});

test('a plan that ended asks with no moment, in the chat that is open, still never mid-answer', () => {
  const ended = ready({ serverMoment: 'plan_ended', moment: null });
  assert.equal(mayOffer(ended), true);
  assert.equal(mayOffer({ ...ended, conversationId: 'conv-7' }), true);
  assert.equal(mayOffer({ ...ended, isStreaming: true }), false);
  assert.equal(mayOffer({ ...ended, quizInProgress: true }), false);
  assert.equal(mayOffer({ ...ended, askedThisSession: true }), false);
  assert.equal(mayOffer({ ...ended, eligible: false }), false);
  assert.equal(mayOffer({ ...ended, isAccount: false }), false);
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

test('a moment belongs to the chat whose page it happened on; anywhere else it is not recorded', () => {
  // A case page's side chat: no chat page, no moment.
  noteChatMoment('copy', 3, '/cases/okafor-v-ade');
  assert.equal(beginOffer('okafor-v-ade'), false);
  // The chat's page, public or internal form.
  noteChatMoment('cited_case', 4, '/v2/c/conv-9');
  // Another chat's box does not take it; its own does.
  assert.equal(beginOffer('conv-1'), false);
  assert.equal(beginOffer('conv-9'), true);
  endOffer();
});

test('one ask a session: later moments are not recorded', () => {
  noteChatMoment('regenerate', 7, '/c/conv-1');
  noteAnswerStreaming();
  // The session asked already (previous test): nothing more is offered.
  assert.equal(beginOffer('conv-1'), false);
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
  // "Open case" in the preview's body reports the moment, then leaves the
  // case's name for the move-first frame; the error state's "Open case" reports it alone.
  assert.match(preview, /onClick=\{\(\) => \{\s*noteMoment\('cited_case'\);\s*rememberCasePeek\(/);
  assert.equal(preview.match(/onClick=\{\(\) => noteMoment\('cited_case'\)\}/g)?.length, 1);
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
  assert.match(banner, /if \(offerNow && beginOffer\(conversationId, serverMoment\)\) \{\s*void feedbackApi\.chatPromptSeen\('shown'\)/);
  // The server is asked once a session as a chat opens, so a plan that ended can ask first.
  assert.match(banner, /enabled: isAccount && !askedThisSession,/);
  assert.match(banner, /const serverMoment = prompt\.data\?\.moment === 'plan_ended' \? 'plan_ended' : null;/);
  assert.match(banner, /void feedbackApi\.chatPromptSeen\('closed'\)/);
  assert.match(banner, /conversationId: offer\.conversationId,\s*messageId: offer\.messageId,\s*trigger: offer\.trigger,/);
  const api = read('lib', 'api', 'feedback.ts');
  assert.match(api, /content_type: 'conversation',/);
  assert.match(api, /\.\.\.\(data\.messageId !== null \? \{ message_id: data\.messageId \} : \{\}\),/);
  assert.match(api, /\.\.\.\(data\.reason === 'something_else' && data\.text \? \{ text: data\.text \} : \{\}\),/);
  assert.match(api, /apiClient\.post\('\/feedback\/chat-prompt\/seen', \{ action \}\)/);
  assert.match(api, /apiClient\.get<\{ data: ChatPromptEligibility \}>\('\/feedback\/chat-prompt'\)/);
});
