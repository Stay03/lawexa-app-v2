import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ConversationAuthor } from '@/types/chat';
import { authorLine, canSendIn, hasSpaceContract, VIEW_ONLY_COPY, viewOnlyReason } from './space-turn';

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
