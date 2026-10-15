import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ContentRole, Space } from '@/types/collab';
import {
  canRemoveFromSpace,
  createFolderRefusal,
  fileTypeLabel,
  movePayload,
  moveRefusal,
  moveTargets,
  ownsItem,
  removeRefusal,
  spaceEmptyCopy,
  spaceFolderPayload,
  spaceItemRef,
  uploadPrecheck,
  uploadRefusal,
} from './content-model';
import { canAddContent, SPACE_TAB_LABELS } from './model';

/* Spaces F3 (12 October 2026, backend B3 cb0fae8): adding to a space,
 * taking items out, and moving items in and out. Pure rules first, then the
 * wiring of the .tsx and the mutations, pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

/* ── Request bodies: exactly the documented keys ─────────────────────────── */

test('a new space folder sends name and is_private, and parent_id only inside a folder', () => {
  const root = spaceFolderPayload('  Smith v Jones  ', null);
  assert.deepEqual(root, { name: 'Smith v Jones', is_private: true });
  assert.deepEqual(Object.keys(root).sort(), ['is_private', 'name']);
  const child = spaceFolderPayload('Pleadings', 'folder-uuid');
  assert.deepEqual(child, { name: 'Pleadings', is_private: true, parent_id: 'folder-uuid' });
  assert.deepEqual(Object.keys(child).sort(), ['is_private', 'name', 'parent_id']);
});

test('Remove from Space sends type and id only, whatever else the item carries', () => {
  const chat = spaceItemRef({
    type: 'conversation',
    id: 'chat-uuid',
    // Extra keys a menu's target carries must not ride along.
    ...({ name: 'A chat', space: { uuid: 's', name: 'S' } } as object),
  } as never);
  assert.deepEqual(chat, { type: 'conversation', id: 'chat-uuid' });
  assert.deepEqual(spaceItemRef({ type: 'folder', id: 'folder-uuid' }), {
    type: 'folder',
    id: 'folder-uuid',
  });
  const file = spaceItemRef({ type: 'file', id: 42 });
  assert.deepEqual(file, { type: 'file', id: 42 });
  assert.equal(typeof file.id, 'number');
});

test('every move sends space_uuid and nothing else, null to come back out', () => {
  assert.deepEqual(movePayload('space-uuid'), { space_uuid: 'space-uuid' });
  const out = movePayload(null);
  assert.deepEqual(out, { space_uuid: null });
  // Present even when null: the file route requires the key.
  assert.ok(Object.prototype.hasOwnProperty.call(out, 'space_uuid'));
});

test('the API sends each body to its documented route', () => {
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /apiClient\.post<SpaceFolderResponse>\(\s*`\/spaces\/\$\{spaceUuid\}\/folders`,\s*payload\s*\)/);
  assert.match(api, /formData\.append\('file', file\);\s*const response = await apiClient\.post<SpaceFileResponse>\(\s*`\/spaces\/\$\{spaceUuid\}\/files`,\s*formData,/);
  assert.match(api, /apiClient\.delete<ApiResponse<null>>\(\s*`\/spaces\/\$\{spaceUuid\}\/items`,\s*\{ data: item \}\s*\)/);
  assert.match(api, /apiClient\.patch<MoveToSpaceResponse>\(\s*`\/conversations\/\$\{conversationId\}`,\s*payload\s*\)/);
  assert.match(api, /apiClient\.put<MoveToSpaceResponse>\(\s*`\/folders\/\$\{encodeURIComponent\(folderUuid\)\}`,\s*payload\s*\)/);
  assert.match(api, /apiClient\.patch<MoveToSpaceResponse>\(\s*`\/files\/\$\{fileId\}`,\s*payload\s*\)/);
  // The lists' documented filters.
  assert.match(api, /status: params\.status \|\| undefined,/);
  assert.match(api, /parent_id: params\.parent_id \|\| undefined,\s*search: params\.search \|\| undefined,\s*sort: params\.sort \|\| undefined,\s*order: params\.order \|\| undefined,/);
  // The callers build the bodies through the model, never by hand.
  const mutations = read('v2', 'features', 'spaces', 'content-mutations.ts');
  assert.match(mutations, /spacesApi\.removeItem\(spaceUuid, spaceItemRef\(item\)\)/);
  assert.match(mutations, /const body = movePayload\(to\);/);
  for (const call of ['moveConversation', 'moveFolder', 'moveFile']) {
    assert.match(mutations, new RegExp(`spaceMovesApi\\.${call}\\(item\\.id, body\\)`), call);
  }
  const dialog = read('v2', 'features', 'folders', 'FolderNameDialog.tsx');
  assert.match(dialog, /createSpaceFolder\.mutate\(spaceFolderPayload\(trimmed, intent\.parent\?\.uuid \?\? null\)/);
});

/* ── Who may do what ─────────────────────────────────────────────────────── */

test('only an Owner or Contributor adds; only the space Owner removes', () => {
  const roles: readonly [ContentRole | null | undefined, boolean, boolean][] = [
    ['owner', true, true],
    ['editor', true, false],
    ['viewer', false, false],
    [null, false, false],
    [undefined, false, false],
  ];
  for (const [role, adds, removes] of roles) {
    assert.equal(canAddContent({ my_content_role: role }), adds, `add ${String(role)}`);
    assert.equal(canRemoveFromSpace({ my_content_role: role }), removes, `remove ${String(role)}`);
  }
});

test('a move is offered only on the viewer’s own item, into spaces they can add to', () => {
  assert.equal(ownsItem(7, 7), true);
  assert.equal(ownsItem(8, 7), false);
  assert.equal(ownsItem(undefined, 7), false);
  assert.equal(ownsItem(null, 7), false);
  assert.equal(ownsItem(7, null), false);
  const space = (uuid: string, role: ContentRole | null) =>
    ({ uuid, my_content_role: role }) as Space;
  assert.deepEqual(
    moveTargets([space('a', 'owner'), space('b', 'viewer'), space('c', 'editor'), space('d', null)]).map(
      (row) => row.uuid,
    ),
    ['a', 'c'],
  );
});

test('the tabs: a Viewer sees no add control, only the space Owner sees Remove from space', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /canAdd: space !== null && canAddContent\(space\),/);
  assert.match(panel, /canRemove: space !== null && canRemoveFromSpace\(space\),/);
  assert.match(panel, /const newFolderButton = canAdd \? \(/);
  assert.match(panel, /const uploadButton = canAdd \? \(/);
  // The file input and the tray exist only for someone who may add, and so
  // does the drop zone.
  assert.match(panel, /\{canAdd \? \(\s*<>\s*<input/);
  assert.match(panel, /return canAdd \? \(\s*<FileDropZone/);
  // Remove from space on each tab's rows, for the space's Owner only.
  assert.equal(panel.match(/onRemoveFromSpace=\{\s*canRemove \?/g)?.length, 3);
  // Move on each tab's rows, for the item's owner only.
  assert.match(panel, /ownsItem\(conversation\.user_id, viewerId\)/);
  assert.match(panel, /ownsItem\(recordByUuid\.get\(row\.uuid\)\?\.user\?\.id, viewerId\) \? moveRow : undefined/);
  assert.match(panel, /ownsItem\(file\.uploader\.id, viewerId\) \? moveFile : undefined/);
  // The empty state hands its action on only to someone who may add.
  const states = read('v2', 'features', 'spaces', 'detail', 'content', 'states.tsx');
  assert.match(states, /action=\{canAdd \? action : undefined\}/);
});

test('the folder and file menus carry the space rows only when the host passes them', () => {
  const menu = read('v2', 'features', 'folders', 'FolderActionsMenu.tsx');
  assert.match(menu, /\{onMove \? \(\s*<DropdownMenuItem onSelect=\{onMove\}>/);
  assert.match(menu, /\{onRemoveFromSpace \? \(\s*<DropdownMenuItem onSelect=\{onRemoveFromSpace\}>/);
  // Rename and Delete stay the owner's pair: never in a space tab's menu.
  assert.match(menu, /\{onRename \? \(\s*<>\s*<DropdownMenuSeparator \/>\s*<DropdownMenuItem\s+variant="destructive"/);
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // Rename stays the owner's: never in a space tab's menu. Delete is in it for
  // files alone since 15 October 2026 (a space's file belongs to the space).
  assert.doesNotMatch(panel, /onRename=/);
  assert.equal((panel.match(/onDelete=/g) ?? []).length, 1);
  assert.match(panel, /onCopyToMine=\{copyFile\}\s*onDelete=\{/);
  const row = read('v2', 'features', 'conversations', 'list', 'ConversationRow.tsx');
  // A confidential chat never gets a space row.
  assert.match(row, /\{!hasMenu \? null : is_confidential \? \(\s*<span aria-hidden className="size-9 shrink-0" \/>/);
  const list = read('v2', 'features', 'conversations', 'list', 'ConversationsList.tsx');
  assert.match(list, /conversation\.is_confidential \|\| conversation\.is_redacted\s*\?\s*undefined\s*:\s*\(\) => openMove\(conversation\)/);
});

/* ── Refusals, in plain words ────────────────────────────────────────────── */

test('a refused move says why, a confidential chat in plain words', () => {
  assert.equal(moveRefusal('conversation', 422, 'The given data was invalid.'), 'Confidential chats can’t go into a space.');
  assert.equal(
    moveRefusal('folder', 422, 'The parent folder belongs to another space.'),
    'The parent folder belongs to another space.',
  );
  assert.equal(moveRefusal('folder', 422, null), 'This can’t go into that space.');
  assert.match(moveRefusal('file', 403, 'Forbidden'), /your own items, into a space where you are an Owner or Contributor/);
  assert.equal(moveRefusal('conversation', 404, null), 'This conversation is no longer available to move.');
  assert.equal(moveRefusal('folder', 500, null), 'Couldn’t move it. Please try again.');
});

test('Remove from Space and New folder refusals', () => {
  assert.equal(removeRefusal(403), 'Only the space’s Owner can remove items from it.');
  assert.equal(removeRefusal(404), 'This is no longer in the space.');
  assert.equal(removeRefusal(0), 'Couldn’t remove it. Please try again.');
  assert.equal(createFolderRefusal(403, null), 'Only the Owner and Contributors can add folders here.');
  assert.equal(createFolderRefusal(422, 'The name field is required.'), 'The name field is required.');
});

test('a refused upload shows the rule in place, and no Retry for a refusal that would repeat', () => {
  assert.deepEqual(uploadRefusal(422, 'The file must not be greater than 10240 kilobytes.', 'The given data was invalid.'), {
    message: 'The file must not be greater than 10240 kilobytes.',
    retryable: false,
  });
  assert.deepEqual(uploadRefusal(422, null, 'The file must be a file of type: pdf.'), {
    message: 'The file must be a file of type: pdf.',
    retryable: false,
  });
  assert.equal(uploadRefusal(403, null, null).retryable, false);
  assert.equal(uploadRefusal(403, null, null).message, 'Only the Owner and Contributors can add files here.');
  assert.equal(uploadRefusal(0, null, null).retryable, true);
  assert.equal(uploadRefusal(500, null, null).retryable, true);
  // The tab reads the rules refusal off `errors.file`.
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /uploadRefusal\(apiError\.status, apiError\.errors\?\.file\?\.\[0\] \?\? null, apiError\.message\)/);
  assert.match(panel, /useUploadQueueFor\(upload\.mutateAsync, uploadPrecheck, describeUploadFailure\)/);
});

test('the upload precheck runs the document rules before a byte is sent', () => {
  const file = (name: string, type: string, size: number) => ({ name, type, size });
  assert.equal(uploadPrecheck(file('brief.pdf', 'application/pdf', 1024)), null);
  assert.equal(uploadPrecheck(file('order.rtf', '', 1024)), null);
  assert.equal(uploadPrecheck(file('photo.webp', 'image/webp', 1024)), null);
  assert.match(uploadPrecheck(file('setup.exe', 'application/x-msdownload', 1024)) ?? '', /can’t be added/);
  assert.match(uploadPrecheck(file('big.pdf', 'application/pdf', 11 * 1024 * 1024)) ?? '', /larger than 10 MB/);
});

test('the channel panel keeps its own queue rules through the shared queue', () => {
  const queue = read('v2', 'features', 'channels', 'files', 'use-upload-queue.ts');
  assert.match(queue, /return useUploadQueueFor\(uploadFile\.mutateAsync, validateChannelFile\);/);
  // The default failure note is the server's sentence with Retry, as before.
  assert.match(queue, /return \{ message: extractApiError\(error\)\.message, retryable: true \};/);
  assert.match(queue, /status: note\.retryable \? 'failed' : 'rejected',/);
});

/* ── Empty states and labels ─────────────────────────────────────────────── */

test('empty tabs teach the Owner and Contributors, and tell a Viewer who fills them', () => {
  // Design round 1: Stay's lines moved to the header of every shared space,
  // so the empty state names what is missing and how it gets filled instead
  // of repeating them.
  const nouns = { chats: 'conversations', folders: 'folders', files: 'files' } as const;
  for (const tab of ['chats', 'folders', 'files'] as const) {
    const adder = spaceEmptyCopy(tab, true);
    assert.equal(adder.title, `No ${nouns[tab]} in this space yet`, tab);
    assert.doesNotMatch(adder.title + adder.description, /Members can add|organised for the whole team/, tab);
    const viewer = spaceEmptyCopy(tab, false);
    assert.equal(viewer.title, `No ${nouns[tab]} in this space yet`, tab);
    assert.equal(viewer.description, `Contributors and the owner add ${nouns[tab]} here.`, tab);
  }
  assert.equal(spaceEmptyCopy('chats', true).description, 'Ask Lawexa below to start the first one.');
  assert.match(spaceEmptyCopy('folders', true).description, /Folders you add here are shared with everyone in this space\./);
  assert.match(spaceEmptyCopy('files', true).description, /Files you add here are shared with everyone in this space\./);
});

test('no em dash in the new UI strings', () => {
  const sources = [
    read('v2', 'features', 'spaces', 'content-model.ts'),
    read('v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx'),
    read('v2', 'features', 'spaces', 'detail', 'content', 'RemoveFromSpaceDialog.tsx'),
    read('v2', 'features', 'spaces', 'detail', 'content', 'states.tsx'),
  ];
  for (const tab of ['chats', 'folders', 'files'] as const) {
    for (const canAdd of [true, false]) {
      const { title, description } = spaceEmptyCopy(tab, canAdd);
      assert.doesNotMatch(title + description, /—/);
    }
  }
  // Every quoted UI string in the new surfaces (comments may keep theirs).
  for (const source of sources) {
    for (const literal of source.match(/(['`])(?:(?!\1)[^\\\n])*\1/g) ?? []) {
      assert.doesNotMatch(literal, /—/, literal);
    }
  }
});

test('the tab is called Conversations; its id stays chats for old links', () => {
  assert.equal(SPACE_TAB_LABELS.chats, 'Conversations');
});

test('Spaces copy promises no Lawexa behaviour', () => {
  for (const parts of [
    ['v2', 'features', 'collab', 'ui', 'states.tsx'],
    ['app', 'v2', '(collab)', 'spaces', '(list)', 'page.tsx'],
    ['v2', 'features', 'spaces', 'list', 'states.tsx'],
  ]) {
    assert.doesNotMatch(read(...parts), /Lawexa on call/, parts.join('/'));
  }
});

test('a file row names its type', () => {
  assert.equal(fileTypeLabel({ mime_type: 'application/pdf', original_name: 'a.pdf' }), 'PDF');
  assert.equal(fileTypeLabel({ mime_type: 'application/octet-stream', original_name: 'brief.docx' }), 'Word');
  assert.equal(fileTypeLabel({ mime_type: 'application/rtf', original_name: 'order.rtf' }), 'RTF');
  assert.equal(fileTypeLabel({ mime_type: 'image/png', original_name: 'scan.png' }), 'Image');
  assert.equal(fileTypeLabel({ mime_type: 'application/octet-stream', original_name: 'notes.txt' }), 'TXT');
  assert.equal(fileTypeLabel({ mime_type: 'application/octet-stream', original_name: 'README' }), 'File');
  const row = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileRow.tsx');
  // Design round 2: type and size are one element that holds its width, and
  // only the uploader truncates (was
  // `lead={[fileTypeLabel(file), formatBytes(file.size), file.uploader.name]}`).
  assert.match(
    row,
    /<span key="kind" className="flex shrink-0 items-center gap-2">\s*<span>\{fileTypeLabel\(file\)\}<\/span>\s*<MetaSeparator \/>\s*<span>\{formatBytes\(file\.size\)\}<\/span>\s*<\/span>,\s*file\.uploader\.name,/,
  );
});

/* ── Invalidations ───────────────────────────────────────────────────────── */

test('each write invalidates the space lists, the item’s own list and the counts', () => {
  const mutations = read('v2', 'features', 'spaces', 'content-mutations.ts');
  // One space's contents: its lists, its detail (counts), the /spaces rows.
  assert.match(
    mutations,
    /function invalidateSpaceContents\([\s\S]*?queryKey: spacesQueries\.contentsOf\(spaceUuid\)[\s\S]*?queryKey: spacesQueries\.detailsOf\(spaceUuid\)[\s\S]*?queryKey: spacesQueries\.lists\(\)/,
  );
  // The item's own family.
  assert.match(
    mutations,
    /case 'conversation':\s*return Promise\.all\(\[\s*queryClient\.invalidateQueries\(\{ queryKey: conversationsQueries\.lists\(\) \}\),\s*queryClient\.invalidateQueries\(\{\s*queryKey: \[\.\.\.conversationsQueries\.details\(\), item\.id\],/,
  );
  assert.match(
    mutations,
    /case 'folder':\s*return Promise\.all\(\[\s*queryClient\.invalidateQueries\(\{ queryKey: foldersQueries\.lists\(\) \}\),\s*queryClient\.invalidateQueries\(\{ queryKey: foldersQueries\.details\(\) \}\),/,
  );
  // New folder: the space, and the maker's own folder lists.
  assert.match(
    mutations,
    /spacesApi\.createFolder\(spaceUuid, payload\),[\s\S]*?onSuccess: \(\) =>\s*Promise\.all\(\[\s*invalidateSpaceContents\(queryClient, spaceUuid\),\s*queryClient\.invalidateQueries\(\{ queryKey: foldersQueries\.lists\(\) \}\),/,
  );
  // Upload: the space.
  assert.match(
    mutations,
    /spacesApi\.uploadFile\(spaceUuid, file, \{ onProgress, signal \}\),\s*meta: \{ silentError: true \},\s*onSuccess: \(\) => invalidateSpaceContents\(queryClient, spaceUuid\),/,
  );
  // Remove from Space: the space and the item's family.
  assert.match(
    mutations,
    /onSuccess: \(_response, item\) =>\s*Promise\.all\(\[\s*invalidateSpaceContents\(queryClient, spaceUuid\),\s*invalidateItemFamily\(queryClient, item\),/,
  );
  // A move: EVERY space's contents (it leaves one and enters another), every
  // space's detail and the /spaces rows, and the item's family.
  assert.match(
    mutations,
    /onSuccess: \(_response, \{ item \}\) =>\s*Promise\.all\(\[\s*queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.contents\(\) \}\),\s*queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.details\(\) \}\),\s*queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.lists\(\) \}\),\s*invalidateItemFamily\(queryClient, item\),/,
  );
  // Every write explains its own refusal in place.
  // (Six with the space file's copy and delete, 15 October 2026.)
  assert.equal(mutations.match(/meta: \{ silentError: true \}/g)?.length, 6);
  // The prefix a move invalidates is the one every space's contents sit under.
  const queries = read('v2', 'features', 'spaces', 'queries.ts');
  assert.match(queries, /contents: \(\) => \[\.\.\.spacesQueries\.all, 'contents'\] as const,/);
  assert.match(queries, /\[\.\.\.spacesQueries\.contents\(\), spaceUuid\] as const,/);
  // The folder level and the searches are part of each list's key.
  assert.match(queries, /\.\.\.\(parentId \? \{ parent_id: parentId \} : \{\}\),\s*\.\.\.\(search \? \{ search \} : \{\}\),/);
  assert.match(queries, /\.\.\.\(name \? \{ name \} : \{\}\),/);
});

test('approving a join request refreshes the real space and channel keys', () => {
  const invites = read('v2', 'features', 'invites', 'queries.ts');
  assert.doesNotMatch(invites, /\['space', parentUuid\]/);
  assert.doesNotMatch(invites, /\['channel', parentUuid\]/);
  assert.match(
    invites,
    /if \(kind === 'space'\) \{\s*void client\.invalidateQueries\(\{ queryKey: spacesQueries\.detailsOf\(parentUuid\) \}\);\s*void client\.invalidateQueries\(\{ queryKey: spacesQueries\.membersOf\(parentUuid\) \}\);\s*void client\.invalidateQueries\(\{ queryKey: spacesQueries\.lists\(\) \}\);\s*return;\s*\}/,
  );
  assert.match(invites, /void client\.invalidateQueries\(\{ queryKey: channelsQueries\.detailsOf\(parentUuid\) \}\);/);
  assert.match(invites, /void client\.invalidateQueries\(\{ queryKey: channelsQueries\.membersOf\(parentUuid\) \}\);/);
});

/* ── The move dialog and the chat's space line ──────────────────────────── */

test('the move dialog lists the spaces the viewer can add to and explains refusals in place', () => {
  const dialog = read('v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx');
  assert.match(dialog, /const targets = useMemo\(\(\) => \(rows \? moveTargets\(rows\) : \[\]\), \[rows\]\);/);
  assert.match(dialog, /setError\(moveRefusal\(item\.type, apiError\.status, apiError\.message\)\);/);
  // Back out is offered only for an item that names its space (techlead
  // decision 3, 12 October 2026; was: unless known to be the owner's alone).
  assert.match(dialog, /const inSpace = offersRemoveFromSpace\(item\);/);
  assert.match(dialog, /\{inSpace \? \(/);
  assert.match(dialog, /disabled=\{isCurrent \|\| move\.isPending\}/);
});

test('the remove confirm says it takes the item out and does not delete it', () => {
  const dialog = read('v2', 'features', 'spaces', 'detail', 'content', 'RemoveFromSpaceDialog.tsx');
  assert.match(dialog, /This takes the \$\{noun\} out of \$\{spaceName\}, so members no longer see it here\. It is not deleted: it goes back to the person who added it\./);
  assert.match(dialog, /\) : null\}\s*Remove from space\s*<\/AlertDialogAction>/);
  // Its button never reads as a delete.
  assert.doesNotMatch(dialog, />\s*Delete|bg-destructive/);
});

test('a chat in a space names it under its title, and its owner can move it', () => {
  const screen = read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx');
  assert.match(
    screen,
    /canMove=\{\s*controller\.isOwnerResolved &&\s*controller\.isOwner &&\s*!controller\.isConfidential &&\s*!controller\.isRedacted\s*\}/,
  );
  assert.match(screen, /canShowPlace=\{controller\.isOwnerResolved && !controller\.isConfidential\}/);
  const actions = read('v2', 'features', 'conversations', 'conversation', 'ConversationActions.tsx');
  assert.match(actions, /setHeaderPlace\(\{ label: placeName, href: `\/spaces\/\$\{placeUuid\}` \}, conversationId\);/);
  assert.match(actions, /useEffect\(\(\) => \(\) => clearHeaderPlace\(conversationId\), \[conversationId\]\);/);
  assert.match(actions, /id: 'move-chat',\s*label: 'Move to space',/);
  const header = read('v2', 'shell', 'V2Header.tsx');
  assert.match(header, /<HeaderPlaceLine place=\{showTitle \? place : null\} \/>/);
  const row = read('v2', 'features', 'conversations', 'list', 'ConversationRow.tsx');
  assert.match(row, /const spaceName = showSpace && !is_confidential \? \(conversation\.space\?\.name \?\? null\) : null;/);
  const list = read('v2', 'features', 'conversations', 'list', 'ConversationsList.tsx');
  assert.match(list, /reveal=\{revealRows && freshIds\.has\(conversation\.id\)\}\s*showSpace/);
});

test('the header place belongs to the chat that published it', () => {
  // A place published by one chat survives the clear of another (the tap from
  // one chat to the next unmounts the first after the second has published).
  const store = read('v2', 'shell', 'header-place.ts');
  assert.match(store, /export function clearHeaderPlace\(publisher: string\): void \{\s*if \(publisher !== owner\) return;/);
  assert.match(store, /export function setHeaderPlace\(next: HeaderPlace, publisher: string\): void \{\s*owner = publisher;/);
});
