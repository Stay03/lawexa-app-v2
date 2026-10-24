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

test('an empty All or Conversations pill reads Arthur’s words to those who may add, and tells a Viewer who does', () => {
  const arthur = {
    title: 'Start working with Lawexa',
    description:
      'Ask questions, explore your subject or work towards your goal. Add resources to give Lawexa the context it needs.',
  };
  assert.deepEqual(spaceEmptyCopy('all', true), arthur);
  assert.deepEqual(spaceEmptyCopy('conversations', true), arthur);
  assert.equal(spaceEmptyCopy('conversations', false).description, 'Contributors and the owner add conversations here.');
});

test('the home has the message box at its bottom, for the Owner and Contributors, and no New conversation (Stay, 15 October 2026)', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // On All, Conversations and Folders; not on People (Arthur, 24 October
  // 2026: "The folder tab in spaces should also have the chat composer",
  // reversing his 17 October item 2; the Files pill is gone). Hidden, still
  // mounted, while files are ticked (bulk select part 3).
  assert.match(
    panel,
    /\{access\.canAdd && DOCK_TABS\.has\(tab\) \? \([\s\S]{0,240}?<div className=\{selecting \? 'hidden' : 'contents'\}>\s*<SpaceChatDock space=\{\{ uuid: space\.uuid, name: space\.name \}\} handle=\{dock\} \/>\s*<\/div>\s*\) : null\}/,
  );
  assert.match(panel, /const DOCK_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>\(\['all', 'conversations', 'folders'\]\);/);
  assert.doesNotMatch(panel, /New conversation|StartConversationDialog|startChat/);
  // The earlier conversations stay in the list above the box.
  assert.match(panel, /renderFeedRow\(\{ entry, now, menus: rowMenus, key: itemKey\(entry\) \}\)/);
  // Docked at the pane's bottom: sticky, pushed down by a full-height column.
  const dock = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceChatDock.tsx');
  assert.match(dock, /className="sticky bottom-0 z-10 -mx-4 -mb-16 mt-auto px-4 pt-6 v2-safe-bottom"/);
  const parts = read('v2', 'features', 'spaces', 'detail', 'lobby-parts.tsx');
  assert.match(parts, /'mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-16 pt-5 sm:pt-6'/);
  assert.match(panel, /<div className="flex flex-1 flex-col">[\s\S]{0,900}?<div className=\{cn\(SPACE_PILL_BAR, 'flex-row items-center gap-2'\)\}>/);
});

test('the pill bar\'s + is in the pills\' scale, at the row\'s end at every width, and its menu has icons (Stay, 22 and 23 October 2026)', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // "That new folder button is ridiculously big and wasting space and out of place."
  assert.match(
    panel,
    /'v2-interactive relative inline-flex size-8 shrink-0 items-center justify-center gap-1 rounded-full bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary\/90 after:absolute after:-inset-1\.5 data-\[state=open\]:bg-primary\/90 sm:w-auto sm:px-3'/,
  );
  assert.match(panel, /<span className="sr-only sm:not-sr-only">Add<\/span>/);
  // "the new folder, select and upload should have icons" (Stay, 23 October 2026, 00:06Z).
  assert.match(panel, /<FolderPlus \/>\s*New folder/);
  assert.match(panel, /<Upload \/>\s*Upload files/);
  assert.match(panel, /<ListChecks \/>\s*Select/);
  assert.doesNotMatch(panel, /min-h-11/);
  assert.match(panel, /const PILLS_CLASS =\s*'inline-flex max-w-full min-w-0 items-center gap-0\.5 overflow-x-auto overscroll-x-contain rounded-full bg-secondary\/60 p-0\.5';/);
  // With four pills the + fits a phone's row beside People: it ends the
  // row at every width, and the header carries no slot for it.
  assert.match(panel, /\{action \? <div className="ml-auto flex shrink-0 justify-end">\{action\}<\/div> : null\}/);
  assert.doesNotMatch(panel, /createPortal|headerActions/);
  const header = read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx');
  assert.doesNotMatch(header, /actionsRef/);
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.doesNotMatch(screen, /headerActions|setHeaderActions/);
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

test('the empty All and Conversations pills offer Upload files, and Invite people to whoever may invite (Arthur, 15 October 2026)', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // Both are secondary: the box docked under the list is the way to start.
  assert.match(
    panel,
    /<EmptyStateAddButton variant="outline" icon=\{Upload\} onClick=\{onAttach\}>\s*Upload files\s*<\/EmptyStateAddButton>/,
  );
  assert.match(panel, /onAttach=\{\(\) => dock\.current\?\.attach\(\)\}/);
  assert.match(
    panel,
    /\{access\.openInvite \? \(\s*<EmptyStateAddButton\s+variant="outline"\s+icon=\{UserPlus\}\s+onClick=\{access\.openInvite\}\s*>\s*Invite people/,
  );
  // Whoever may manage the space's people, however many are in it.
  assert.match(panel, /openInvite: scope !== null && canManage \? scope\.openInvite : null,/);
  assert.doesNotMatch(panel, /Go to your conversations/);
});

test('Upload files in an empty space puts the file in the box as a chip (Arthur, 15 October 2026)', () => {
  const composer = read('v2', 'shell', 'designs', 'HomeComposer.tsx');
  // The box's own picker, opened from outside: the file joins the box's chips,
  // uploads into the space, and goes with the first message.
  assert.match(composer, /useImperativeHandle\(handle, \(\) => \(\{ attach: \(\) => fileInputRef\.current\?\.click\(\) \}\), \[\]\);/);
  assert.match(composer, /const uploaded = await uploadAttachment\(file, space\?\.uuid \?\? null\);/);
  const dock = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceChatDock.tsx');
  assert.match(dock, /handle=\{handle\}/);
});

test('the space box is the phone’s at every width, centred on a desktop (B4, Arthur, 17 October 2026)', () => {
  const dock = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceChatDock.tsx');
  // As wide as the chat's follow-up box on a desktop (Stay, 15 October 2026).
  assert.match(dock, /<div className="pb-3 md:mx-auto md:w-full md:max-w-md">/);
  // Arthur's line stays (12:04Z and 12:17Z): not the follow-up one.
  assert.match(dock, /placeholder=\{SPACE_COMPOSER_PLACEHOLDER\}/);
  assert.match(dock, /export const SPACE_COMPOSER_PLACEHOLDER = 'How can Lawexa help you with this Space\?';/);
  // The one-row desktop pill went: no host asks the composer for it.
  assert.doesNotMatch(dock, /compact/);
  assert.doesNotMatch(read('v2', 'shell', 'designs', 'HomeComposer.tsx'), /compact/);
});
