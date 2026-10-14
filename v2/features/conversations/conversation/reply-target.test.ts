import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ConversationAuthor, MessageReplyTo } from '@/types/chat';
import { jumpTarget } from './jump-target';
import {
  REPLY_DRAFT,
  REPLY_PREVIEW_CHARS,
  replyAuthorLabel,
  replySnippet,
  replyTargetOf,
  savedIdOf,
} from './reply-target';
import { SWIPE_REPLY_PX, swipeShift } from './rows/use-swipe-reply';

/*
 * Replies in a space chat (Stay, 14 October 2026: "replies should be like how
 * whatsapp replies are"; the techlead's contract of the same day). The rules
 * are pure and tested here; the rows are .tsx, which this runner does not load,
 * so their wiring is pinned in source.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');
const readHere = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const ADA: ConversationAuthor = { id: 7, uuid: 'ada', name: 'Ada Obi', avatar_url: null };
const quote = (over: Partial<MessageReplyTo> = {}): MessageReplyTo => ({
  id: 4812,
  role: 'user',
  author: ADA,
  preview: 'Can a tenant withhold rent?',
  is_unavailable: false,
  ...over,
});

test('a saved question or a saved answer can be replied to, and nothing else', () => {
  assert.deepEqual(replyTargetOf({ id: 'msg_4812', role: 'user', content: ' Can a tenant withhold rent? ', author: ADA }), quote());
  // An answer this client streamed, once its saved id has been stamped.
  assert.deepEqual(replyTargetOf({ id: 'local-9', role: 'assistant', content: 'Yes, if…', savedId: 4813 }), {
    id: 4813,
    role: 'assistant',
    author: null,
    preview: 'Yes, if…',
    is_unavailable: false,
  });
  // The row this client drew, before the server saved it: no id yet.
  assert.equal(replyTargetOf({ id: 'local-1', role: 'user', content: 'hi', author: ADA }), null);
  assert.equal(replyTargetOf({ id: 'msg_1', role: 'assistant', content: 'hi', isStreaming: true }), null);
  assert.equal(replyTargetOf({ id: 'msg_1', role: 'assistant', content: 'hi', messageType: 'handover' }), null);
  assert.equal(replyTargetOf({ id: 'msg_1', role: 'tool', content: '{}' }), null);
  assert.equal(replyTargetOf({ id: 'msg_1', role: 'user', content: '   ' }), null);
  // A withheld writer stays withheld in the quote.
  assert.equal(replyTargetOf({ id: 'msg_2', role: 'user', content: 'x', author: null })?.author, null);
  assert.equal(replyTargetOf({ id: 'msg_2', role: 'user', content: 'x'.repeat(500) })?.preview?.length, REPLY_PREVIEW_CHARS);
  assert.equal(savedIdOf({ id: 'msg_31' }), 31);
  assert.equal(savedIdOf({ id: 'x', savedId: 5 }), 5);
});

test('the quote names Lawexa, You, the writer, or Someone', () => {
  assert.equal(replyAuthorLabel(quote({ role: 'assistant', author: null }), 7), 'Lawexa');
  assert.equal(replyAuthorLabel(quote(), 7), 'You');
  assert.equal(replyAuthorLabel(quote(), 8), 'Ada Obi');
  assert.equal(replyAuthorLabel(quote(), null), 'Ada Obi');
  assert.equal(replyAuthorLabel(quote({ author: null }), 8), 'Someone');
});

test('the quote is one plain line: no markdown marks, tags or breaks', () => {
  assert.equal(
    replySnippet(quote({ preview: '## Notice\n\n- **Seven days** for a `weekly` tenant <case slug="x">Ade v Bola</case>' })),
    'Notice Seven days for a weekly tenant Ade v Bola',
  );
  assert.equal(replySnippet(quote({ preview: null, is_unavailable: true })), '');
});

test('the staged reply keeps with the draft, and a damaged one is dropped', () => {
  const raw = REPLY_DRAFT.encode(quote());
  assert.equal(typeof raw, 'string');
  assert.deepEqual(REPLY_DRAFT.decode(raw as string), quote());
  assert.equal(REPLY_DRAFT.encode(null), null);
  assert.equal(REPLY_DRAFT.empty, null);
  assert.equal(REPLY_DRAFT.decode('{'), null);
  assert.equal(REPLY_DRAFT.decode(JSON.stringify({ id: 'x' })), null);
  assert.equal(REPLY_DRAFT.decode(JSON.stringify({ ...quote(), role: 'tool' })), null);
});

test('a row from the server keeps its reply_to; a row that replies to nothing has none', () => {
  const at = '2026-10-14T09:00:00Z';
  const row = (id: number, over: Partial<ApiMessage>): ApiMessage => ({
    id,
    conversation_id: 'c1',
    agent_id: null,
    role: 'user',
    content: 'q',
    metadata: {},
    created_at: at,
    author: ADA,
    ...over,
  });
  const deleted = quote({ preview: null, is_unavailable: true });
  const [reply, plain, gone] = transformApiMessages([
    row(1, { reply_to: quote() }),
    row(2, { reply_to: null }),
    row(3, { reply_to: deleted }),
  ]);
  assert.deepEqual(reply.replyTo, quote());
  assert.equal('replyTo' in plain, false);
  assert.deepEqual(gone.replyTo, deleted);
});

test('the engine sends reply_to_message_id, on a retry too, and draws the quote on its own row', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /\.\.\.\(convId && options\.replyTo && \{ reply_to_message_id: options\.replyTo\.id \}\),\n {6}\};\n {6}const response = await chatApi\.start\(applyJurisdiction\(baseBody, choice\)\);/);
  assert.match(engine, /\.\.\.\(originalMsg\.replyTo && \{ reply_to_message_id: originalMsg\.replyTo\.id \}\),/);
  assert.match(engine, /const optimisticMsg = addUserMessage\(message, attachmentsList, options\.replyTo\);/);
  assert.match(engine, /drawnHere: true,\n {6}\.\.\.\(replyTo && \{ replyTo \}\),/);
  const types = read('types', 'chat.ts');
  assert.match(types, /reply_to_message_id\?: number;\n\}/);
  assert.match(types, /reply_to\?: MessageReplyTo \| null;/);
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /\.\.\.\(replyTo && \{ replyTo \}\),\n {6}\}\);/);
});

test('?m= is a positive whole number or nothing', () => {
  assert.equal(jumpTarget('4820'), 4820);
  assert.equal(jumpTarget(['4820', '1']), 4820);
  assert.equal(jumpTarget(undefined), null);
  for (const bad of ['', '0', '-3', '12a', '1.5', '01', ' 4']) assert.equal(jumpTarget(bad), null, bad);
  assert.equal(jumpTarget('9'.repeat(17)), null, 'longer than a safe id');
});

test('a swipe follows the finger to the threshold, then gives way', () => {
  assert.equal(swipeShift(-20), 0);
  assert.equal(swipeShift(30), 30);
  assert.equal(swipeShift(SWIPE_REPLY_PX), SWIPE_REPLY_PX);
  assert.ok(swipeShift(SWIPE_REPLY_PX + 40) < SWIPE_REPLY_PX + 40);
  assert.equal(swipeShift(1000), 88);
});

test('the wiring: replies only in a space chat the reader may send in, through this screen’s composer', () => {
  const screen = readHere('ConversationScreen.tsx');
  assert.match(screen, /const canReply = controller\.showAuthors && canSend && !externalComposer && !isConfidential;/);
  assert.match(screen, /onReply=\{canReply \? stageReply : null\}/);
  assert.match(screen, /composerRef\.current\?\.reply\(target\)/);
  const list = readHere('MessageList.tsx');
  assert.match(list, /data-message-id=\{messageId \?\? undefined\}/);
  assert.match(list, /data-flash:bg-primary\/10/);
  assert.match(list, /\{onReply && <TurnActionsSheet held=\{held\} onReply=\{replyFromSheet\} onClose=\{closeSheet\} \/>\}/);
  // A user row: hover Reply for a mouse, a swipe and a long press on touch.
  const row = readHere('rows', 'UserMessageRow.tsx');
  assert.match(row, /const target = onReply \? replyTargetOf\(message\) : null;/);
  assert.match(row, /action=\{reply \? <HoverReply onClick=\{reply\} \/> : null\}/);
  assert.match(row, /<SwipeToReply\s+onReply=\{reply\}\s+onLongPress=\{/);
  // An answer: Reply in its action bar and a swipe; its text stays selectable.
  const answer = readHere('rows', 'AssistantMessageRow.tsx');
  assert.match(answer, /<SwipeToReply onReply=\{reply\}>/);
  assert.doesNotMatch(answer, /onLongPress/);
  assert.match(readHere('rows', 'HoverReply.tsx'), /pointer-fine:inline-flex/);
  // The composer: the bar, Escape, and the reply going with the turn.
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /useDraft\(`conversation_draft_reply_\$\{draftScopeId\}`, REPLY_DRAFT\)/);
  assert.match(composer, /if \(event\.key === 'Escape' && replyTo\) \{\s*event\.preventDefault\(\);\s*setReply\(null\);/);
  assert.match(composer, /aria-label="Cancel reply"/);
});
