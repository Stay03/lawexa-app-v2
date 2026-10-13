import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spaceEmptyCopy, startChatRefusal, startDialogLine } from './content-model';

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
  // Study mode is never sent from a space (T3).
  const dialog = read('v2', 'features', 'spaces', 'detail', 'content', 'StartConversationDialog.tsx');
  assert.doesNotMatch(dialog, /studyMode/);
  assert.match(dialog, /title="New conversation"/);
  assert.match(dialog, /description=\{startDialogLine\(space\.name\)\}/);
  assert.match(dialog, /space=\{space\}/);
});

test('the refusals and the dialog line, word for word', () => {
  assert.equal(startChatRefusal(403, 'Forbidden'), 'Only the Owner and Contributors can start conversations here.');
  assert.equal(startChatRefusal(422, 'The space is archived.'), 'The space is archived.');
  assert.equal(startChatRefusal(422, null), 'This conversation can’t start here.');
  assert.equal(startChatRefusal(500, 'Server Error'), 'Couldn’t start the conversation. Please try again.');
  assert.equal(
    startDialogLine('Moot Court Prep'),
    'Everyone in Moot Court Prep can read it. The Owner and Contributors can continue it.',
  );
  for (const line of [startChatRefusal(403, null), startChatRefusal(422, null), startChatRefusal(0, null), startDialogLine('X')]) {
    assert.doesNotMatch(line, /[—–]/, line);
  }
});

test('an empty Conversations tab offers a new one to those who may add, and tells a Viewer who does', () => {
  assert.deepEqual(spaceEmptyCopy('chats', true), {
    title: 'No conversations in this space yet',
    description: 'Start a conversation here, or move one of yours in.',
  });
  assert.equal(spaceEmptyCopy('chats', false).description, 'Contributors and the owner add conversations here.');
});

test('the Conversations tab has a New conversation pill and an empty-state button, for the Owner and Contributors', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(
    panel,
    /const newChatButton = canAdd \? \(\s*<PillButton icon=\{Plus\} onClick=\{startChat\}>\s*New conversation\s*<\/PillButton>\s*\) : null;/,
  );
  assert.match(panel, /placeholder="Search conversations"\s*busy=\{query\.isPlaceholderData\}\s*action=\{newChatButton\}/);
  assert.match(panel, /<EmptyStateAddButton icon=\{Plus\} onClick=\{startChat\}>\s*New conversation\s*<\/EmptyStateAddButton>/);
  assert.match(panel, /<StartConversationDialog\s*key=\{`start-\$\{starting\.key\}`\}\s*space=\{\{ uuid: spaceUuid, name: spaceName \}\}/);
});
