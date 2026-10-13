import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type {
  ApiMessage,
  ConversationAuthor,
  ConversationListItem,
  ConversationsListResponse,
  ConversationStatusData,
} from '@/types/chat';
import { conversationsCache, makeOptimisticConversation } from '../cache';
import { reportFollowUpRefusal, subscribeFollowUpRefusals, type FollowUpRefusal } from './embedded-composer';
import { conversationsQueries } from '../queries';
import {
  askAgainRefusal,
  askingLabel,
  authorLine,
  canSendIn,
  draftWithRefused,
  hasSpaceContract,
  isOwnTurn,
  SPACE_CHAT_POLL_MS,
  sendRefusal,
  stopsPolling,
  turnChanged,
  turnHeldBy,
  turnStart,
  VIEW_ONLY_COPY,
  viewOnlyReason,
} from './space-turn';

/**
 * Spaces F4 (backend B4 bd76241 and 1135730): a chat in a space, read and
 * continued by its members. The chat side; the space side is in
 * `v2/features/spaces/space-chat-f4.test.ts`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const readHere = (name: string) => readFileSync(join(here, name), 'utf8');

const at = '2026-10-13T09:00:00Z';
const ada: ConversationAuthor = { id: 41, name: 'Ada Obi', avatar_url: null };
const userRow = (id: number, over: Partial<ApiMessage> = {}): ApiMessage => ({
  id,
  conversation_id: 'c1',
  agent_id: null,
  role: 'user',
  content: `question ${id}`,
  metadata: {},
  created_at: at,
  ...over,
});
const answerRow = (id: number, over: Partial<ApiMessage> = {}): ApiMessage => ({
  id,
  conversation_id: 'c1',
  agent_id: 1,
  role: 'assistant',
  content: `answer ${id}`,
  metadata: {},
  created_at: at,
  ...over,
});

/* ── Commit 1: the B4 fields on the shapes ────────────────────────────────── */

test('a user turn keeps who asked, and an answer never carries a writer', () => {
  const [question, answer] = transformApiMessages([
    userRow(1, { author: ada }),
    answerRow(2, { author: null }),
  ]);
  assert.deepEqual(question.author, ada);
  assert.equal('author' in answer, false);
});

test('a withheld writer stays null, and a transcript from before B4 keeps its old shape', () => {
  const [withheld] = transformApiMessages([userRow(1, { author: null })]);
  assert.equal(withheld.author, null);
  const [old] = transformApiMessages([userRow(1)]);
  assert.equal('author' in old, false);
  assert.deepEqual(Object.keys(old).sort(), ['content', 'id', 'role', 'timestamp']);
});

test('a chat can be started in a space, by its uuid', () => {
  const types = read('types', 'chat.ts');
  assert.match(types, /export interface ChatStartRequest \{[\s\S]*?\n {2}space_uuid\?: string;\r?\n\}/);
  // The status and the 409 name the sender and the message being answered.
  assert.match(types, /pending_message\?: PendingUserMessage \| null;/);
  assert.match(types, /export interface PendingUserMessage \{\s+id: number;\s+preview: string;\s+author_id: number \| null;\s+\}/);
  assert.match(types, /last_message_id\?: number \| null;/);
});

/* ── Commit 2: who may send, and why a reader may not ─────────────────────── */

test('the server decides who sends; an API before B4 falls back to ownership', () => {
  assert.equal(canSendIn({ can_send: true }, false), true, 'a Contributor in someone else’s chat');
  assert.equal(canSendIn({ can_send: false }, true), false, 'the server said no');
  assert.equal(canSendIn({}, true), true);
  assert.equal(canSendIn({}, false), false);
});

test('a Viewer is told who may continue; anyone else that it was shared with them', () => {
  assert.equal(viewOnlyReason({ can_send: false, my_space_role: 'viewer' }), 'viewer');
  // A Viewer who owns the chat may send (B10), so the role alone is not the reason.
  assert.equal(viewOnlyReason({ can_send: true, my_space_role: 'viewer' }), 'shared');
  assert.equal(viewOnlyReason({ can_send: false, my_space_role: null }), 'shared');
  assert.equal(viewOnlyReason({ can_send: false, my_space_role: 'editor' }), 'shared');
  assert.equal(viewOnlyReason({}), 'shared');
  assert.equal(viewOnlyReason(null), 'shared');
  assert.deepEqual(VIEW_ONLY_COPY, {
    title: 'View only',
    viewer: 'Only the Owner and Contributors can continue this conversation.',
    shared: 'This conversation was shared with you.',
  });
  for (const line of Object.values(VIEW_ONLY_COPY)) assert.doesNotMatch(line, /[—–]/, line);
});

test('the composer follows canSend, and the owner verbs stay with ownership', () => {
  const screen = readHere('ConversationScreen.tsx');
  assert.match(screen, /\) : controller\.canSend \? \(/);
  assert.doesNotMatch(screen, /\) : controller\.isOwner \? \(/);
  assert.match(screen, /<ViewOnlyPill reason=\{controller\.viewOnlyReason\} \/>/);
  // The pill is its own module (so the case dock need not load this screen).
  const pill = readHere('ViewOnlyPill.tsx');
  assert.match(pill, /export function ViewOnlyPill\(\{ reason \}: \{ reason: ViewOnlyReason \}\)/);
  assert.doesNotMatch(pill, /View only —/);
  // Share, move, rename, delete and export are still the owner's.
  assert.match(screen, /canDelete=\{\s*controller\.isOwnerResolved &&\s*controller\.isOwner &&/);
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /const canSend = detailData \? canSendIn\(detailData, isOwner\) : isOwner;/);
});

test('the case dock reads the same answer through the embedded surface', () => {
  const surface = readHere('embedded-composer.ts');
  assert.match(surface, /canSend: boolean;/);
  assert.match(surface, /surface\.canSend === next\.canSend &&/);
  assert.match(readHere('ConversationScreen.tsx'), /publishEmbeddedComposer\(\{[\s\S]*?canSend,\s*viewOnlyReason,/);
  const dock = read('v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx');
  assert.match(dock, /surface\.isOwnerResolved && !surface\.canSend;/);
  assert.match(dock, /<ViewOnlyPill reason=\{surface\?\.viewOnlyReason \?\? 'shared'\} \/>/);
});

/* ── Commit 3: who asked ──────────────────────────────────────────────────── */

test('a user turn names who asked: You for your own, the name for a colleague', () => {
  assert.equal(authorLine({ id: 7, name: 'Me Myself', avatar_url: null }, 7)?.label, 'You');
  const colleague = authorLine(ada, 7);
  assert.equal(colleague?.label, 'Ada Obi');
  assert.equal(colleague?.spoken, 'Asked by Ada Obi');
  assert.deepEqual(colleague?.person, ada);
  // The row this client drew itself carries no author key: the reader's own.
  assert.deepEqual(authorLine(undefined, 7), { label: 'You', spoken: 'Asked by you', person: null });
  // A writer withheld from a stranger is never "You".
  assert.equal(authorLine(null, 7), null);
  assert.equal(authorLine(null, null), null);
});

test('labels need the B4 fields on the record', () => {
  assert.equal(hasSpaceContract({ can_send: false }), true);
  assert.equal(hasSpaceContract({ can_send: true }), true);
  assert.equal(hasSpaceContract({}), false);
  assert.equal(hasSpaceContract(null), false);
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /const isSpaceChat = detailData\?\.space != null;/);
  assert.match(controller, /const showAuthors = isSpaceChat && hasSpaceContract\(detailData\);/);
});

test('the list hands every user row the flag and the viewer; the row draws the line only then', () => {
  const list = readHere('MessageList.tsx');
  assert.match(list, /showAuthor=\{showAuthors\}\s+viewerId=\{viewerId\}/);
  assert.match(list, /<UserMessageRow message=\{message\} showAuthor=\{showAuthor\} viewerId=\{viewerId\} \/>/);
  const row = readHere(join('rows', 'UserMessageRow.tsx'));
  assert.match(row, /const author = showAuthor \? authorLine\(message\.author, viewerId\) : null;/);
  assert.match(row, /\{author\.person \? \(\s*<MemberAvatar/);
  assert.match(row, /<span className="sr-only">\{author\.spoken\}<\/span>/);
  assert.match(readHere('ConversationScreen.tsx'), /showAuthors=\{controller\.showAuthors\}\s+viewerId=\{serverUserId\}/);
});

/* ── Commit 4: whose turn is running ──────────────────────────────────────── */

const status = (over: Partial<ConversationStatusData> = {}): ConversationStatusData => ({
  status: 'completed',
  messages: [],
  execution_id: null,
  stream_url: null,
  pending_since: '2026-10-13T08:59:00Z',
  execution_user: { id: 41, name: 'Ada Obi' },
  pending_message: null,
  can_cancel: false,
  last_message_id: 10,
  ...over,
});

test('"{name} is asking" names a colleague, only while the turn is pending', () => {
  assert.deepEqual(turnHeldBy(status({ status: 'pending' }), 7), { id: 41, name: 'Ada Obi' });
  assert.equal(turnHeldBy(status({ status: 'pending' }), 41), null, 'the reader’s own turn');
  // The status keeps the last sender after the turn ends (B3 answer).
  for (const ended of ['completed', 'failed', 'expired', 'idle'] as const) {
    assert.equal(turnHeldBy(status({ status: ended }), 7), null, ended);
  }
  assert.equal(turnHeldBy(status({ status: 'pending', execution_user: null }), 7), null);
  assert.equal(turnHeldBy(null, 7), null);
  assert.equal(askingLabel('Ada'), 'Ada is asking');
});

test('a turn that began between two reads is seen, even one that also ended', () => {
  const before = status();
  assert.equal(turnChanged(before, before), false);
  assert.equal(turnChanged(before, { ...before }), false);
  assert.equal(turnChanged(before, status({ last_message_id: 11 })), true);
  assert.equal(turnChanged(before, status({ pending_since: '2026-10-13T09:01:00Z' })), true);
  assert.equal(turnChanged(before, status({ execution_id: 'e2' })), true);
});

test('the status is read every four seconds, live, never kept, and a refusal stops it', () => {
  assert.equal(SPACE_CHAT_POLL_MS, 4000);
  const leaf = conversationsQueries.status({ conversationId: 'c1', viewerId: 7 });
  assert.deepEqual(leaf.queryKey, ['conversations', 'status', 'c1', { viewerId: 7 }]);
  assert.equal(leaf.staleTime, 0);
  assert.equal(leaf.gcTime, 0);
  assert.equal(leaf.retry, false);
  assert.equal('meta' in leaf, false, 'never on the device');
  const forbidden = Object.assign(new Error('403'), { response: { status: 403 } });
  const missing = Object.assign(new Error('404'), { response: { status: 404 } });
  const down = Object.assign(new Error('503'), { response: { status: 503 } });
  assert.equal(stopsPolling(forbidden), true);
  assert.equal(stopsPolling(missing), true);
  assert.equal(stopsPolling(down), false);
  assert.equal(stopsPolling(null), false);
  const queries = read('v2', 'features', 'conversations', 'queries.ts');
  assert.match(queries, /refetchInterval: \(query\) => \(stopsPolling\(query\.state\.error\) \? false : SPACE_CHAT_POLL_MS\),/);
});

test('the poll waits for the mount flow, stops while streaming, and reads the transcript before attaching', () => {
  const controller = readHere('useConversationController.ts');
  assert.match(
    controller,
    /enabled:\s*isSpaceMember &&\s*!isConfidential &&\s*!isGoneOnServer &&\s*recoveredFor === conversationId &&\s*!isStreaming,/,
  );
  // Recovery settles after the mount flow's own attach, or on any connect.
  assert.match(controller, /const recovered = await recoverPendingState\(conversationId\)[^\n]*\n\s*if \(cancelled\) return;[\s\S]*?setRecoveredFor\(conversationId\);\s*\}\)\(\);/);
  // Opened mid-turn: the mount flow attached, so whose turn it is is read once.
  assert.match(controller, /if \(recovered === 'reconnected' && inSpace\) void queryClient\.prefetchQuery\(statusOptions\);/);
  assert.match(controller, /onConnected: \(\) => \{\s*\/\/[^\n]*\n[^\n]*\n\s*setRecoveredFor\(conversationId\);/);
  assert.match(
    controller,
    /await queryClient\.refetchQueries\(\{ queryKey: detailKey, exact: true \}\);\s*if \(!stillWanted\(\)\) return;\s*const fresh = queryClient\.getQueryData\(detailKey\);\s*if \(fresh\) adoptConversationHistory\(fresh\);\s*if \(executionId\) connectToStream\(executionId\);\s*else await recoverPendingState\(conversationId\)/,
  );
  assert.match(controller, /void followTurn\(statusData\.execution_id, \(\) => !cancelled\);/);
  // A send drops the last status read before it goes.
  assert.match(controller, /queryClient\.removeQueries\(\{ queryKey: statusKey, exact: true \}\);[\s\S]*?await send\(/);
});

test('a colleague’s turn names them in the activity row, holds Send and offers no Stop', () => {
  assert.match(readHere('ActivityStatus.tsx'), /: \(narration \?\? restingLabel \?\? RESTING_LABEL\);/);
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /const ownTurnRunning = isStreaming && sendHeldBy === null;/);
  assert.match(composer, /\{isStreaming && canStop \? \(/);
  assert.match(composer, /isStreaming && sendHeldBy !== null \? `Wait for \$\{sendHeldBy\}’s answer` : 'Send message'/);
  assert.match(composer, /disabled=\{!canSend \|\| isStreaming\}/);
  const screen = readHere('ConversationScreen.tsx');
  assert.match(screen, /sendHeldBy=\{controller\.sendHeldBy\}\s+canStop=\{controller\.canStop\}/);
  assert.match(screen, /controller\.sendHeldBy !== null \? askingLabel\(controller\.sendHeldBy\) : undefined/);
});

/* ── Commit 5: a send that meets another turn keeps the message ───────────── */

test('a refused send says why, and that the message is kept', () => {
  assert.equal(
    sendRefusal({ kind: 'held', by: { id: 41, name: 'Ada' }, executionId: null, since: null }, 7),
    'Ada is asking right now. Your message is kept.',
  );
  assert.equal(sendRefusal({ kind: 'held', by: null, executionId: null, since: null }, 7), 'Someone is asking right now. Your message is kept.');
  assert.equal(
    sendRefusal({ kind: 'held', by: { id: 7, name: 'Me' }, executionId: null, since: null }, 7),
    'Your last question is still being answered. Your message is kept.',
  );
  assert.equal(sendRefusal({ kind: 'forbidden' }, 7), VIEW_ONLY_COPY.viewer);
  for (const line of [sendRefusal({ kind: 'held', by: null, executionId: null, since: null }, 7), sendRefusal({ kind: 'forbidden' }, 7)]) {
    assert.doesNotMatch(line, /[—–]/);
  }
});

test('the engine hands the refusal back: a 409 without attaching, a 403 instead of a banner', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(
    engine,
    /removeMessage\(optimisticMsg\.id\);\s*const pendingData = responseData\.data;\s*setState\(\(prev\) => \(\{ \.\.\.prev, isStreaming: false, isCancelling: false \}\)\);\s*return \{\s*kind: 'held',\s*by: pendingData\?\.execution_user \?\? null,\s*executionId: pendingData\?\.execution_id \?\? null,\s*since: pendingData\?\.pending_since \?\? null,\s*\};/,
  );
  assert.match(
    engine,
    /if \(err instanceof AxiosError && err\.response\?\.status === 403\) \{\s*removeMessage\(optimisticMsg\.id\);\s*setState\(\(prev\) => \(\{ \.\.\.prev, isStreaming: false, isCancelling: false \}\)\);\s*return \{ kind: 'forbidden' \};/,
  );
  // The blocked-plan banner keeps its place before the 403.
  assert.ok(engine.indexOf('const blocked = extractBlockedReason(err);') < engine.indexOf("return { kind: 'forbidden' };"));
});

test('submit drops the old status first, and a refusal by role re-reads the record', () => {
  const controller = readHere('useConversationController.ts');
  assert.match(
    controller,
    /queryClient\.removeQueries\(\{ queryKey: statusKey, exact: true \}\);\s*seenStatusRef\.current = null;\s*setRefusedTurn\(null\);\s*const fileIds[\s\S]*?const refusal = await send\(/,
  );
  assert.match(controller, /if \(refusal === null\) return undefined;\s*takeRefusal\(refusal\);\s*return \{ refused: sendRefusal\(refusal, serverUserId\) \};/);
  assert.match(controller, /\} else \{\s*void queryClient\.invalidateQueries\(\{ queryKey: detailKey \}\);/);
  assert.match(controller, /const heldBy = statusHeldBy \?\? refusedByColleague;/);
});

test('the composer gives a refused message back, with its pasted cards and files, and says why', () => {
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /const draft = \{ input, pasted: pastedItems\.map\(\(i\) => i\.text\), uploads \};/);
  assert.match(composer, /outcome = await onSubmit\(fullMessage, attachmentsSnapshot\);/);
  assert.match(
    composer,
    /updateInput\(\(current\) => \(current\.trim\(\) === '' \? draft\.input : current\)\);\s*for \(const text of draft\.pasted\) addPasted\(text\);\s*setUploads\(\(current\) => \[\.\.\.draft\.uploads, \.\.\.current\]\);\s*showError\(outcome\.refused\);/,
  );
  // A sent tray's thumbnails are released only once the send was taken.
  assert.match(composer, /if \(!outcome\) for \(const u of draft\.uploads\) if \(u\.preview\) URL\.revokeObjectURL\(u\.preview\);/);
  // The case dock passes the refusal through.
  assert.match(read('v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx'), /if \(surface\) return surface\.submit\(message, attachments\);/);
});

test('a send moves its chat to the top of the owner’s lists once, with no second row', () => {
  const page = (rows: ConversationListItem[]): ConversationsListResponse => ({
    success: true,
    message: '',
    data: rows,
    pagination: { current_page: 1, per_page: 20, total: rows.length, last_page: 2, from: 1, to: rows.length },
    links: { first: '', last: '', prev: null, next: null },
  });
  const row = (id: string) => makeOptimisticConversation(id, id);
  const client = new QueryClient();
  const flatKey = [...conversationsQueries.lists(), { per_page: 10 }, { viewerId: 7 }];
  const infiniteKey = [...conversationsQueries.lists(), 'infinite', {}, { viewerId: 7 }];
  client.setQueryData(flatKey, page([row('a'), row('b'), row('c')]));
  client.setQueryData<InfiniteData<ConversationsListResponse>>(infiniteKey, {
    pages: [page([row('a'), row('b')]), page([row('c'), row('d')])],
    pageParams: [1, 2],
  });
  conversationsCache.touch(client, 'c');
  const flat = client.getQueryData<ConversationsListResponse>(flatKey);
  assert.deepEqual(flat?.data.map((r) => r.id), ['c', 'a', 'b']);
  const infinite = client.getQueryData<InfiniteData<ConversationsListResponse>>(infiniteKey);
  assert.deepEqual(infinite?.pages.map((p) => p.data.map((r) => r.id)), [['c', 'a', 'b'], ['d']]);
  // A chat that is not in the reader's own lists (a colleague's) changes nothing.
  conversationsCache.touch(client, 'zz');
  assert.equal(client.getQueryData(flatKey), flat);
  client.clear();
});

/* ── Ask again re-asks only the reader's own question ─────────────────────── */

test('Ask again is offered on the owner’s own last question, never on a colleague’s', () => {
  assert.equal(isOwnTurn(undefined, 7), true, 'a row this client drew');
  assert.equal(isOwnTurn({ id: 7, name: 'Me', avatar_url: null }, 7), true);
  assert.equal(isOwnTurn(ada, 7), false);
  assert.equal(isOwnTurn(null, 7), false, 'a withheld writer');
  assert.equal(isOwnTurn({ id: 7, name: 'Me', avatar_url: null }, null), false);
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /lastUserTurn !== null &&\s*!!lastUserTurn\.content &&\s*isOwnTurn\(lastUserTurn\.author, serverUserId\);/);
});

/* ── The case dock reads whose turn it is through the surface ─────────────── */

test('the case page’s side chat holds Send and offers no Stop on a colleague’s turn', () => {
  const surface = readHere('embedded-composer.ts');
  assert.match(surface, /sendHeldBy: string \| null;/);
  assert.match(surface, /canStop: boolean;/);
  assert.match(surface, /surface\.sendHeldBy === next\.sendHeldBy &&\s*surface\.canStop === next\.canStop &&/);
  assert.match(readHere('ConversationScreen.tsx'), /publishEmbeddedComposer\(\{[\s\S]*?sendHeldBy,\s*canStop,\s*isOwnerResolved,/);
  const dock = read('v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx');
  assert.match(dock, /sendHeldBy=\{surface \? surface\.sendHeldBy : null\}\s*canStop=\{surface \? surface\.canStop : true\}/);
});

/* ── Result-card follow-ups respect can_send and give a refusal back ──────── */

test('a reader who may not send gets disabled card actions, and the screen sends no follow-up', () => {
  const screen = readHere('ConversationScreen.tsx');
  assert.match(screen, /canSend=\{canSend\}\s*conversationId=\{conversationId\}/);
  assert.match(screen, /\(message: string\) => \{\s*if \(!canSend\) return;/);
  assert.match(readHere('chat-context.tsx'), /\(\) => \(\{ sendMessage, isStreaming, canSend, conversationId \}\)/);
  for (const card of ['DeepResearchPromptCard', 'MultiQuestionPlanCard', 'MultiQuestionPromptCard', 'NextQuestionPromptCard']) {
    assert.match(
      readHere(join('cards', `${card}.tsx`)),
      /disabled=\{clicked \|\| isInteracted \|\| chatContext\?\.isStreaming \|\| chatContext\?\.canSend === false\}/,
      card,
    );
  }
  assert.match(
    readHere(join('cards', 'QuizCard.tsx')),
    /disabled=\{!allAnswered \|\| !chatContext \|\| chatContext\.isStreaming \|\| !chatContext\.canSend\}/,
  );
});

test('a refused follow-up (409 or 403) comes back to the composer with the composer’s own sentence', () => {
  const screen = readHere('ConversationScreen.tsx');
  // Both refusals arrive as `outcome.refused`, the sentence sendRefusal wrote.
  assert.match(
    screen,
    /const outcome = await submit\(message, \[\]\);\s*if \(!outcome\) return;\s*if \(externalComposer\) \{\s*reportFollowUpRefusal\(\{ conversationId, text: message, sentence: outcome\.refused \}\);\s*\} else \{\s*composerRef\.current\?\.refuse\(message, outcome\.refused\);/,
  );
  assert.match(screen, /draftScopeId=\{conversationId\}\s*stageRef=\{composerRef\}/);
  const composer = readHere('ConversationComposer.tsx');
  assert.match(composer, /refuse: \(text, sentence\) => \{\s*updateInput\(\(current\) => draftWithRefused\(current, text\)\);\s*setErrorText\(sentence\);\s*setErrorOpen\(true\);/);
  // The draft keeps what the reader typed, and the follow-up after it.
  assert.equal(draftWithRefused('', 'Explain the next step'), 'Explain the next step');
  assert.equal(draftWithRefused('  ', 'Explain the next step'), 'Explain the next step');
  assert.equal(draftWithRefused('My own words', 'Explain the next step'), 'My own words\n\nExplain the next step');
  // The sentences themselves, as the composer shows them for its own sends.
  assert.equal(sendRefusal({ kind: 'held', by: { id: 41, name: 'Ada' }, executionId: null, since: null }, 7), 'Ada is asking right now. Your message is kept.');
  assert.equal(sendRefusal({ kind: 'forbidden' }, 7), VIEW_ONLY_COPY.viewer);
});

test('with the case dock’s composer, a refused follow-up reaches that composer, once, for its own chat only', () => {
  const heard: FollowUpRefusal[] = [];
  const stop = subscribeFollowUpRefusals('c1', (refusal) => heard.push(refusal));
  reportFollowUpRefusal({ conversationId: 'c1', text: 'Next question', sentence: 'Ada is asking right now. Your message is kept.' });
  reportFollowUpRefusal({ conversationId: 'c2', text: 'Another chat', sentence: 'x' });
  stop();
  reportFollowUpRefusal({ conversationId: 'c1', text: 'After the dock left', sentence: 'x' });
  assert.deepEqual(heard.map((r) => r.text), ['Next question']);
  const dock = read('v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx');
  assert.match(
    dock,
    /return subscribeFollowUpRefusals\(conversationId, \(\{ text, sentence \}\) => \{\s*if \(text === null\) stageRef\.current\?\.explain\(sentence\);\s*else stageRef\.current\?\.refuse\(text, sentence\);\s*\}\);/,
  );
});

/* ── A refused "Ask again" is told, not dropped ───────────────────────────── */

test('a refused Ask again says why in the composer’s banner, for a 409 and for a 403', () => {
  // 409: the question is on screen already, so nothing is promised as kept.
  assert.equal(
    askAgainRefusal({ kind: 'held', by: { id: 41, name: 'Ada Obi' }, executionId: null, since: null }, 7),
    'Ada Obi is asking right now. Ask again once their answer is in.',
  );
  assert.equal(askAgainRefusal({ kind: 'held', by: null, executionId: null, since: null }, 7), 'Someone is asking right now. Ask again once the answer is in.');
  assert.equal(askAgainRefusal({ kind: 'held', by: { id: 7, name: 'Me' }, executionId: null, since: null }, 7), 'Your last question is still being answered.');
  // 403: the Viewer line, as for a refused send.
  assert.equal(askAgainRefusal({ kind: 'forbidden' }, 7), VIEW_ONLY_COPY.viewer);
  for (const line of [askAgainRefusal({ kind: 'held', by: null, executionId: null, since: null }, 7), askAgainRefusal({ kind: 'forbidden' }, 7)]) {
    assert.doesNotMatch(line, /kept|[—–]/, line);
  }
  const controller = readHere('useConversationController.ts');
  assert.match(
    controller,
    /const refusal = await send\(lastUserContent, \{[\s\S]*?\}\);\s*if \(refusal === null\) return undefined;\s*takeRefusal\(refusal\);\s*return \{ refused: askAgainRefusal\(refusal, serverUserId\) \};/,
  );
  // Both refusals change the screen as a refused send does.
  assert.match(
    controller,
    /if \(refusal\.kind === 'held'\) \{\s*setRefusedTurn\(\{ by: refusal\.by, since: refusal\.since \}\);[\s\S]*?void followTurn\(refusal\.executionId, \(\) => liveRef\.current === conversationId\);\s*\} else \{\s*void queryClient\.invalidateQueries\(\{ queryKey: detailKey \}\);/,
  );
  const screen = readHere('ConversationScreen.tsx');
  assert.match(
    screen,
    /const outcome = await regenerate\(\);\s*if \(!outcome\) return;\s*if \(externalComposer\) \{\s*reportFollowUpRefusal\(\{ conversationId, text: null, sentence: outcome\.refused \}\);\s*\} else \{\s*composerRef\.current\?\.explain\(outcome\.refused\);/,
  );
  assert.match(screen, /onRegenerate=\{askAgain\}/);
  assert.match(readHere('ConversationComposer.tsx'), /explain: \(sentence\) => \{\s*setErrorText\(sentence\);\s*setErrorOpen\(true\);/);
});

/* ── The activity row sits above the answer being written, not a finished one ─ */

test('the activity row goes above the last group only while that answer is being written', () => {
  const list = readHere('MessageList.tsx');
  assert.match(
    list,
    /const lastGroupIsAnswer =\s*lastGroup\?\.type === 'single' &&\s*lastGroup\.message\.role === 'assistant' &&\s*lastGroup\.message\.isStreaming === true;/,
  );
  // The reader's own turn: the engine's placeholder is the streaming row.
  assert.match(
    read('v2', 'runtime', 'chat-engine', 'engine.ts'),
    /\{ id, role: 'assistant', content: '', timestamp: new Date\(\), isStreaming: true \}/,
  );
});

/* ── A 409's turn is followed after the record is read (review S1) ────────── */

test('after a 409 the running turn’s question is read before its answer streams', () => {
  const controller = readHere('useConversationController.ts');
  // One follow at a time: the poll and a 409 can both lead here.
  assert.match(controller, /if \(followingRef\.current\) return;\s*followingRef\.current = true;/);
  assert.match(controller, /\} finally \{\s*followingRef\.current = false;\s*\}/);
  // The engine no longer attaches in the 409 branch.
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  const branch = engine.slice(engine.indexOf("if (responseData?.code === 'PENDING_RESPONSE') {"), engine.indexOf('// 503 redaction service unavailable'));
  assert.doesNotMatch(branch, /connectToStream|pollForCompletion/);
});

/* ── The "is asking" row's clock and name (review N1, N3) ─────────────────── */

test('the row’s clock runs from the turn’s own start, and the name stays in front of narration', () => {
  assert.equal(turnStart('2026-10-13T09:00:00Z'), Date.parse('2026-10-13T09:00:00Z'));
  assert.equal(turnStart(null), null);
  assert.equal(turnStart(undefined), null);
  assert.equal(turnStart('not a date'), null);
  const controller = readHere('useConversationController.ts');
  assert.match(
    controller,
    /const heldSince = statusHeldBy\s*\? turnStart\(statusData\?\.pending_since\)\s*: refusedByColleague\s*\? turnStart\(refusedTurn\?\.since\)\s*: null;/,
  );
  assert.match(read('v2', 'runtime', 'chat-engine', 'engine.ts'), /since: pendingData\?\.pending_since \?\? null,/);
  const list = readHere('MessageList.tsx');
  assert.match(list, /const activityStart = heldSince \?\? streamStartTime;/);
  assert.equal((list.match(/<ActivityRow startTime=\{activityStart\}/g) ?? []).length, 3);
  assert.match(readHere('ConversationScreen.tsx'), /heldSince=\{controller\.heldSince\}/);
  const row = readHere('ActivityStatus.tsx');
  assert.match(row, /restingLabel !== undefined && narration\s*\? `\$\{restingLabel\} · \$\{narration\}`/);
});

/* ── A send while a turn already streams is refused, not lost (review N2) ─── */

test('a send while a stream is live returns a held refusal, so the words come back', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /if \(eventSource\) return \{ kind: 'held', by: null, executionId, since: null \};/);
  assert.doesNotMatch(engine, /if \(eventSource\) return null;/);
  // Following the execution already followed stays quiet.
  assert.match(engine, /if \(eventSource\) \{\s*if \(execId !== executionId\) \{\s*console\.warn\(/);
});

/* ── No second transcript read after the reader's own turn (review N4) ────── */

test('a send and a re-ask forget the last status as seen, so their own turn is not read as a new one', () => {
  const controller = readHere('useConversationController.ts');
  const resets = controller.match(
    /queryClient\.removeQueries\(\{ queryKey: statusKey, exact: true \}\);\s*seenStatusRef\.current = null;\s*setRefusedTurn\(null\);/g,
  );
  assert.equal(resets?.length, 2, 'submit and regenerate');
  // The first read with nothing seen never refetches the transcript.
  assert.match(controller, /if \(previous !== null && turnChanged\(previous, statusData\)\) \{/);
});

/* ── A stranger reading a published space chat is not polled (review N8) ──── */

test('only a member of the space reads its status', () => {
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /const isSpaceMember = isSpaceChat && detailData\?\.my_space_role != null;/);
  assert.match(controller, /inSpace = data\.space != null && data\.my_space_role != null;/);
});

/* ── A 409's follow does not outlive its screen (re-review R1) ────────────── */

test('a 409’s follow attaches only while the screen still shows that chat', () => {
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /useEffect\(\(\) => \{\s*let cancelled = false;\s*liveRef\.current = conversationId;/);
  const clears = controller.match(/cancelled = true;\s*liveRef\.current = null;/g);
  assert.equal(clears?.length, 2, 'both of the mount flow’s cleanups');
  assert.match(controller, /void followTurn\(refusal\.executionId, \(\) => liveRef\.current === conversationId\);/);
  // followTurn checks before it attaches, after the read.
  assert.match(controller, /if \(!stillWanted\(\)\) return;\s*const fresh = queryClient\.getQueryData\(detailKey\);/);
});

/* ── A refused send's turn does not label the next one (re-review R4) ─────── */

test('the turn a refused send met stops naming its sender when it ends', () => {
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /onCompleted: \(\) => \{\s*(\/\/[^\n]*\n\s*)*setRefusedTurn\(null\);/);
  assert.match(controller, /onError: \(\) => setRefusedTurn\(null\),\s*onCancelled: \(\) => setRefusedTurn\(null\),/);
  // A pending status outranks the refusal (a turn that ended by polling fires no handler).
  assert.match(controller, /isStreaming &&\s*statusData\?\.status !== 'pending' &&\s*refusedBy !== null &&/);
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /resetStreamingBuffers\(\);\s*handlers\.onCancelled\?\.\(\);\s*\}\);/);
});
