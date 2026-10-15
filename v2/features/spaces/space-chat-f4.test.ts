import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHARED_INVITE_ROLES } from '@/v2/features/collab/membership/invite-roles';
import { invitationRoleMeaning } from '@/v2/features/invitations/row-model';
import { spaceEmptyCopy, startChatRefusal } from './content-model';

/**
 * Spaces F4 (backend B4 bd76241 and 1135730), the space side: starting a
 * conversation in a space. The chat side is in
 * `v2/features/conversations/conversation/space-turn.test.ts`.
 */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('a conversation starts in a space by its uuid, and never as a private chat there', () => {
  const start = read('v2', 'features', 'conversations', 'start-conversation.ts');
  assert.match(start, /\.\.\.\(spaceUuid !== undefined && \{ space_uuid: spaceUuid \}\),/);
  // The two private modes are off whenever a space is given (the server answers 422).
  assert.match(start, /const confidential = spaceUuid === undefined && input\.confidential === true;/);
  assert.match(start, /const redacted = spaceUuid === undefined && input\.redacted === true;/);
  // A start never names an existing conversation.
  assert.doesNotMatch(start, /conversation_id:/);
  // The space's tab, counts and list row re-ask, as for a chat moved in.
  assert.match(
    start,
    /if \(spaceUuid !== undefined\) \{\s*void deps\.queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.contentsOf\(spaceUuid\) \}\);\s*void deps\.queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.detailsOf\(spaceUuid\) \}\);\s*void deps\.queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.lists\(\) \}\);/,
  );
});

test('the home composer in a space offers no private modes and says a refusal in the space’s words', () => {
  const composer = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  assert.match(composer, /\{space \? null : \(\s*<>\s*<DropdownMenuSeparator \/>\s*<DropdownMenuLabel>Privacy<\/DropdownMenuLabel>/);
  assert.match(composer, /spaceUuid: space\?\.uuid,/);
  assert.match(composer, /setError\(space \? startChatRefusal\(apiError\.status, apiError\.message\) : apiError\.message\);/);
  // Study mode is never sent from a space (T3). The box is the dock at the
  // bottom of the Conversations tab since 15 October 2026 (Stay, Arthur).
  const dock = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceChatDock.tsx');
  assert.doesNotMatch(dock, /studyMode/);
  assert.match(dock, /space=\{space\}/);
  assert.match(dock, /placeholder=\{SPACE_COMPOSER_PLACEHOLDER\}/);
  assert.match(dock, /export const SPACE_COMPOSER_PLACEHOLDER = 'How can Lawexa help you with this Space\?';/);
  // Its own draft, never the home's shared one.
  assert.match(dock, /const \[value, setValue\] = useState\(''\);/);
  assert.doesNotMatch(dock, /useComposerDraft\(/);
});

test('the refusals, word for word', () => {
  assert.equal(startChatRefusal(403, 'Forbidden'), 'Only the Owner and Contributors can start conversations here.');
  assert.equal(startChatRefusal(422, 'The space is archived.'), 'The space is archived.');
  assert.equal(startChatRefusal(422, null), 'This conversation can’t start here.');
  assert.equal(startChatRefusal(500, 'Server Error'), 'Couldn’t start the conversation. Please try again.');
  for (const line of [startChatRefusal(403, null), startChatRefusal(422, null), startChatRefusal(0, null)]) {
    assert.doesNotMatch(line, /[—–]/, line);
  }
});

test('an empty Conversations tab reads Arthur’s words to those who may add, and tells a Viewer who does', () => {
  assert.deepEqual(spaceEmptyCopy('chats', true), {
    title: 'Start working with Lawexa',
    description:
      'Ask questions, explore your subject or work towards your goal. Add resources to give Lawexa the context it needs.',
  });
  assert.equal(spaceEmptyCopy('chats', false).description, 'Contributors and the owner add conversations here.');
});

test('the Conversations tab has the message box at its bottom, for the Owner and Contributors, and no New conversation (Stay, 15 October 2026)', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /\{canAdd \? <SpaceChatDock space=\{\{ uuid: spaceUuid, name: spaceName \}\} \/> : null\}/);
  assert.match(panel, /placeholder="Search conversations"\s*busy=\{query\.isPlaceholderData\}\s*action=\{null\}/);
  assert.doesNotMatch(panel, /New conversation|StartConversationDialog|startChat/);
  // The earlier conversations stay in the list above the box.
  assert.match(panel, /<ConversationRow\s+key=\{conversation\.id\}/);
  // Docked at the pane's bottom: sticky, pushed down by a full-height column.
  const dock = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceChatDock.tsx');
  assert.match(dock, /className="sticky bottom-0 z-10 -mx-4 -mb-16 mt-auto px-4 pt-6 v2-safe-bottom"/);
  const parts = read('v2', 'features', 'spaces', 'detail', 'lobby-parts.tsx');
  assert.match(parts, /const SPACE_COLUMN_BASE = 'mx-auto flex min-h-full w-full flex-col px-4 pb-16 pt-5 sm:pt-6';/);
  assert.match(parts, /export const SPACE_TAB_PANEL = 'mt-5 flex flex-1 flex-col';/);
});

test('the inviter and the invitee read one promise: a Contributor continues the space’s conversations', () => {
  const dialogLine = SHARED_INVITE_ROLES.find((option) => option.value === 'editor')?.description;
  const cardLine = invitationRoleMeaning({
    kind: 'space',
    invitation: {
      role: 'member',
      content_role: 'editor',
      space: { uuid: 's', name: 'S', type: 'study', description: null, kind: 'shared' },
    },
  });
  assert.equal(dialogLine, 'Can also add to the space and continue its conversations');
  assert.equal(cardLine, 'Can read, add to the space and continue its conversations');
  for (const line of [dialogLine ?? '', cardLine ?? '']) {
    assert.match(line, /add to the space and continue its conversations$/, line);
    assert.doesNotMatch(line, /[—–]/, line);
  }
});

test('the empty Conversations tab offers Upload files, and Invite people to whoever may invite (Arthur, 15 October 2026)', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // Both are secondary: the box docked under the tab is the way to start.
  assert.match(
    panel,
    /<EmptyStateAddButton variant="outline" icon=\{Upload\} onClick=\{uploads\.pickFiles\}>\s*Upload files\s*<\/EmptyStateAddButton>/,
  );
  assert.match(
    panel,
    /\{access\.openInvite \? \(\s*<EmptyStateAddButton\s+variant="outline"\s+icon=\{UserPlus\}\s+onClick=\{access\.openInvite\}\s*>\s*Invite people/,
  );
  // Whoever may manage the space's people, however many are in it.
  assert.match(panel, /openInvite: scope !== null && scope\.canManage \? scope\.openInvite : null,/);
  assert.doesNotMatch(panel, /Go to your conversations/);
});
