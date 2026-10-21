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

test('the wiring: replies only in a space chat the reader may send in, through the chat’s docked box', () => {
  const screen = readHere('ConversationScreen.tsx');
  assert.match(screen, /const canReply = controller\.showAuthors && canSend && !externalComposer && !isConfidential;/);
  assert.match(screen, /onReply=\{canReply \? stageReply : null\}/);
  // The box is the shell's (message box B): the screen sends it the reply.
  assert.match(screen, /stageRouteReply\(conversationId, target\);/);
  assert.match(readHere('ChatDock.tsx'), /subscribeRouteReplies\(conversationId, \(target\) => composerRef\.current\?\.reply\(target\)\)/);
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
  // Unseen on touch but still reachable by a screen reader (review finding 4).
  assert.match(readHere('rows', 'HoverReply.tsx'), /'pointer-coarse:not-focus-visible:sr-only',/);
  // The composer: the bar, Escape, and the reply going with the turn.
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /useDraft\(replyDraftKey\(draftScopeId\), REPLY_DRAFT\)/);
  assert.match(composer, /if \(event\.key === 'Escape' && replyTo && !event\.nativeEvent\.defaultPrevented\) \{\s*event\.preventDefault\(\);\s*setReply\(null\);/);
  assert.match(composer, /aria-label="Cancel reply"/);
});

test('the review of cbf3fa6: what each finding changed', () => {
  // 1. The reader's own question carries its saved id once the send is taken,
  //    so it can be replied to and jumped to in the session that sent it.
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /rememberAuthoredIds\(\[userMessageId\]\);[\s\S]{0,500}?m\.id === optimisticMsg\.id \? \{ \.\.\.m, savedId: userMessageId \} : m/);
  // 2. Escape that closed a popover or a dialog first leaves the reply staged.
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /event\.key === 'Escape' && replyTo && !event\.nativeEvent\.defaultPrevented/);
  // 3. ?m= keeps trying as rows arrive, and stops once it has landed.
  const list = readHere('MessageList.tsx');
  assert.match(list, /if \(jumpToMessage\(jumpTo, \{ instant: true \}\)\) jumpedToRef\.current = jumpTo;/);
  assert.match(list, /\}, \[opened, jumpTo, jumpToMessage, rowCount\]\);/);
  // 6. A smooth jump centres the row again once it has stopped.
  assert.match(list, /root\.addEventListener\('scrollend', \(\) => row\.scrollIntoView\(\{ block: 'center', behavior: 'auto' \}\), \{ once: true \}\);/);
  // 5. A drag from inside something that scrolls sideways is left to it.
  const swipe = readHere('rows', 'use-swipe-reply.ts');
  assert.match(swipe, /if \(startsInSideScroller\(event\.target, event\.currentTarget\)\) return;/);
});

test('a reply whose original is gone gives the words back, not the quote, and says why', async () => {
  const turn = await import('./space-turn');
  assert.equal(turn.sendRefusal({ kind: 'reply-gone' }, 7), 'The message you replied to is no longer available. Your message is kept.');
  // The engine reads the one 422 on reply_to_message_id as this refusal, not as an error.
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /options\.replyTo &&\s*err instanceof AxiosError &&\s*err\.response\?\.status === 422 &&[\s\S]{0,160}?errors\?\.reply_to_message_id !== undefined\s*\) \{\s*removeMessage\(optimisticMsg\.id\);[\s\S]{0,120}?return \{ kind: 'reply-gone' \};/);
  // The controller marks it, and the composer keeps the quote off.
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /\.\.\.\(refusal\.kind === 'reply-gone' && \{ dropReply: true as const \}\),/);
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /if \(draft\.reply && !outcome\.dropReply\) updateReply\(\(current\) => current \?\? draft\.reply\);/);
  // The words and the files still come back, as for every refused send.
  assert.match(composer, /updateInput\(\(current\) => \(current\.trim\(\) === '' \? draft\.input : current\)\);/);
});

test('a send that never reached the server gives the words and the quote back (techlead, 15 October 2026)', async () => {
  const turn = await import('./space-turn');
  assert.equal(turn.sendRefusal({ kind: 'unsent' }, 7), "Couldn't reach Lawexa. Your message is kept, so you can send it again.");
  assert.equal(turn.askAgainRefusal({ kind: 'unsent' }, 7), "Couldn't reach Lawexa. Ask again in a moment.");
  // The engine reads "no answer at all" (and a 5xx) as this refusal when the
  // question was not saved, before the general error (the test below).
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /if \(savedId === null\) \{\s*removeMessage\(optimisticMsg\.id\);\s*setState\(\(prev\) => \(\{ \.\.\.prev, isStreaming: false, isCancelling: false \}\)\);\s*return \{ kind: 'unsent' \};\s*\}/);
  // It keeps the quote (no dropReply), and the record is not re-read for it.
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /\.\.\.\(refusal\.kind === 'reply-gone' && \{ dropReply: true as const \}\),/);
  assert.doesNotMatch(controller, /refusal\.kind === 'unsent' && \{ dropReply/);
  assert.match(controller, /\} else if \(refusal\.kind !== 'unsent' && refusal\.kind !== 'blocked'\) \{/);
});

test('a 5xx or a lost connection reads the chat first: a saved question stays, an unsaved one comes back', async () => {
  const { largestSavedId, savedTurnId } = await import('@/v2/runtime/chat-engine/saved-turn');
  const at = '2026-10-15T09:00:00Z';
  const row = (id: number, role: 'user' | 'assistant', content: string): ApiMessage => ({
    id, conversation_id: 'c1', agent_id: null, role, content, metadata: {}, created_at: at,
  });
  const before = [row(40, 'user', 'Earlier question'), row(41, 'assistant', 'Earlier answer')];
  // Saved: the newest user row, after what the screen held, with the same words.
  assert.equal(savedTurnId([...before, row(42, 'user', 'Is notice needed?')], ' Is notice needed? ', 41), 42);
  // Its file markers do not stop the match.
  assert.equal(savedTurnId([...before, row(42, 'user', 'See this <attached_image name="a.png" />')], 'See this', 41), 42);
  // Not saved: the chat ends with what was already there.
  assert.equal(savedTurnId(before, 'Is notice needed?', 41), null);
  // Not this question: an earlier one with the same words is not it.
  assert.equal(savedTurnId([row(40, 'user', 'Is notice needed?'), row(41, 'assistant', 'Yes')], 'Is notice needed?', 41), null);
  // Not this question: a colleague's newer, different one.
  assert.equal(savedTurnId([...before, row(42, 'user', 'Something else')], 'Is notice needed?', 41), null);
  // What the screen held: history ids and the saved ids of rows this engine drew.
  assert.equal(largestSavedId([{ id: 'msg_41' }, { id: 'local-3', savedId: 44 }, { id: 'local-4' }] as never), 44);
  assert.equal(largestSavedId([]), 0);
  // The engine: both kinds of failure, the read, then one branch or the other.
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /const savedBefore = largestSavedId\(state\.messages\);\s*const optimisticMsg = addUserMessage\(/);
  assert.match(engine, /if \(err instanceof AxiosError && \(!err\.response \|\| err\.response\.status >= 500\)\) \{/);
  assert.match(engine, /if \(convId && !isConfidentialTurnN && !isRedactedTurnN\) \{\s*try \{\s*const read = await chatApi\.getConversation\(convId, \{ lazyResults: true \}\);\s*savedId = savedTurnId\(read\.data\?\.messages \?\? \[\], message, savedBefore\);/);
  // Kept: the question stays as the saved row it is, and the answer's failure shows.
  assert.match(engine, /rememberAuthoredIds\(\[keptId\]\);\s*setMessages\(\(msgs\) => msgs\.map\(\(m\) => \(m\.id === optimisticMsg\.id \? \{ \.\.\.m, savedId: keptId \} : m\)\)\);[\s\S]{0,200}?error: 'Your question was sent, but its answer failed\. Try again\.',[\s\S]{0,40}?return null;/);
});

test('a quote is drawn the WhatsApp way: a straight bar in the quoted person’s colour (Stay, 15 October 2026)', async () => {
  const { quoteTone } = await import('./reply-target');
  const colours = new Map([['ada', 3], ['me', 0]]);
  // A question takes its writer's member colour; the reader's own ("You") takes theirs.
  assert.equal(quoteTone(quote(), colours), 3);
  assert.equal(quoteTone(quote({ author: { id: 1, uuid: 'me', name: 'Me', avatar_url: null } }), colours), 0);
  // Lawexa's answer is gold; a withheld writer, an unknown one or a personal chat is plain.
  assert.equal(quoteTone(quote({ role: 'assistant', author: null }), colours), 'lawexa');
  assert.equal(quoteTone(quote({ author: null }), colours), 'plain');
  assert.equal(quoteTone(quote({ author: { id: 9, uuid: 'gone', name: 'Gone', avatar_url: null } }), colours), 'plain');
  assert.equal(quoteTone(quote(), null), 'plain');
  // The shape: a rounded box that clips, and a 4 px bar flush left at full height,
  // not a thick border on a rounded box (which curves round the corner).
  const frame = readHere('rows', 'QuoteFrame.tsx');
  assert.match(frame, /className=\{cn\('flex w-full min-w-0 overflow-hidden rounded-xl text-left text-xs', className\)\}/);
  assert.match(frame, /<span aria-hidden data-quote-bar="" className=\{cn\('w-1 shrink-0 self-stretch', BAR\[kind\]\)\} \/>/);
  assert.match(frame, /member: 'bg-\[var\(--member-ink\)\] dark:bg-\[var\(--member-ink-dark\)\]',\s*lawexa: 'bg-primary',\s*plain: 'bg-foreground\/30',/);
  assert.match(frame, /style=\{typeof tone === 'number' \? memberStyle\(tone\) : undefined\}/);
  // The bubble's quote and the composer's bar both draw through it; no border edge is left.
  const quoteRow = readHere('rows', 'ReplyQuote.tsx');
  const composer = readHere('ConversationComposer.tsx');
  assert.equal((quoteRow.match(/<QuoteFrame tone=\{tone\} name=\{name\}>/g) ?? []).length, 2);
  assert.match(composer, /<QuoteFrame\s+className="bg-foreground\/\[0\.06\] flex-1 dark:bg-foreground\/\[0\.08\]"\s+tone=\{\s*quoteToneOf \? quoteToneOf\(replyShown\)/);
  for (const source of [quoteRow, composer, frame]) assert.doesNotMatch(source, /border-l-\[/);
  // The colours come from the space's member colours, the same ones the bubbles wear.
  assert.match(readHere('MessageList.tsx'), /\? quoteTone\(group\.message\.replyTo, memberColours\)/);
  assert.match(readHere('ConversationScreen.tsx'), /const quoteToneOf = useCallback\(\(replyTo: MessageReplyTo\) => quoteTone\(replyTo, memberColours\), \[memberColours\]\);/);
});

test('a Reply pressed before the composer has mounted is kept, not lost (WebKit, 15 October 2026)', async () => {
  // The transcript draws from the device's copy while the composer is still its
  // skeleton; a Reply then had only the composer's handle, which was null, and
  // the quote was dropped. The screen now writes the staged reply to the draft
  // store the composer reads, under the same key, and uses the handle only for focus.
  const { replyDraftKey } = await import('./reply-target');
  assert.equal(replyDraftKey('chat-1'), 'conversation_draft_reply_chat-1');
  const screen = readHere('ConversationScreen.tsx');
  const composer = readHere('ConversationComposer.tsx');
  assert.match(
    screen,
    /const stageReply = useCallback\(\s*\(target: MessageReplyTo\) => \{\s*writeDraft\(replyDraftKey\(conversationId\), REPLY_DRAFT, target\);\s*stageRouteReply\(conversationId, target\);\s*\},\s*\[conversationId\],\s*\);/,
  );
  // The composer reads the key the screen writes: the docked box's scope is the
  // same chat id, before and after the screen is up.
  assert.match(composer, /useDraft\(replyDraftKey\(draftScopeId\), REPLY_DRAFT\)/);
  const dock = readHere('ChatDock.tsx');
  assert.equal(dock.match(/draftScopeId=\{conversationId\}/g)?.length, 2);
});
