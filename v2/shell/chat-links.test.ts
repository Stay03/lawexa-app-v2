import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard for step 2 of the move-first work (9 October 2026): every link that
// opens a chat moves first, and a tap from a screen with its own title (the
// drawer or the rail over a chat) puts that title back when a back cancels it.
const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const sidebar = read('V2Sidebar.tsx');
const drawer = read('V2Drawer.tsx');
const homeRow = read('designs', 'sections', 'HomeSection.tsx');
const homeSections = read('designs', 'sections', 'HomeSections.tsx');
const activity = read('..', 'features', 'activity', 'ActivityTable.tsx');
const listRow = read('..', 'features', 'conversations', 'list', 'ConversationRow.tsx');
const controller = read('..', 'features', 'conversations', 'conversation', 'useConversationController.ts');
const store = read('header-context.ts');
const moveFirst = read('move-first.tsx');

const plainChatLink = /<Link\s[^>]*href=\{`\/c\//;

test('the rail and the drawer open chats with the move-first link', () => {
  for (const file of [sidebar, drawer]) {
    assert.match(file, /<MoveFirstLink[^>]*href=\{`\/c\/\$\{conversation\.id\}`\}\s*kind="conversation"\s*title=\{title\}\s*header=\{\{ title: title \|\| null, confidential: Boolean\(conversation\.is_confidential\) \}\}\s*headerOwner=\{conversation\.id\}/);
    assert.doesNotMatch(file, plainChatLink);
  }
  // The drawer still closes itself on the tap.
  assert.match(drawer, /headerOwner=\{conversation\.id\}\s*onClick=\{close\}/);
});

test('the home rows open chats with the move-first link, other rows stay plain links', () => {
  assert.match(homeRow, /\{move \? \(\s*<MoveFirstLink[\s\S]*?\) : \(\s*<Link href=\{href\} className=\{className\}>/);
  assert.match(homeSections, /move=\{\{\s*kind: 'conversation',[\s\S]*?owner: conversation\.id,\s*\}\}/);
  // The placeholder title never goes into the bar.
  assert.match(homeSections, /title: stripPastedTags\(conversation\.title\) \|\| null,/);
});

test('the activity rows open chats with the move-first link', () => {
  assert.equal((activity.match(/<MoveFirstLink\s*\{\.\.\.chatMove\(row\)\}/g) ?? []).length, 3);
  assert.match(activity, /headerOwner: row\.conversationId,/);
  assert.doesNotMatch(activity, /from 'next\/link'/);
});

test('the list row names the chat as the owner of the title it publishes', () => {
  assert.match(listRow, /headerOwner=\{id\}/);
});

test('an owned clear leaves a title someone else now owns', () => {
  assert.match(store, /export function setHeaderContext\(next: HeaderContext, publisher\?: string\): void \{\s*owner = publisher \?\? null;/);
  assert.match(store, /if \(publisher !== undefined && publisher !== owner\) return;/);
  assert.match(controller, /return \(\) => clearHeaderContext\(conversationId\);/);
  assert.match(controller, /setHeaderContext\(\s*\{[\s\S]*?\},\s*conversationId,\s*\);/);
});

test('a tap keeps the origin header and a cancelling back puts it back', () => {
  const tapBody = moveFirst.slice(moveFirst.indexOf('const navigate: Navigate = '));
  const keep = tapBody.indexOf('const restore = visible && pending?.restore ? pending.restore : snapshotHeaderContext();');
  const publish = tapBody.indexOf('if (header) setHeaderContext(header, headerOwner);');
  assert.ok(keep > 0 && publish > keep, 'the copy is taken before the destination publishes');
  assert.match(moveFirst, /if \(visible\) \{\s*if \(pending\?\.restore\) restoreHeaderContext\(pending\.restore\);/);
});
