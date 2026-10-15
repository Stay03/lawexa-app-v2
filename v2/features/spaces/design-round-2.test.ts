import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LucideIcon } from 'lucide-react';
import { ruledAbove, type ScreenAction } from '@/v2/shell/screen-context';
import { spaceMenuItems, spaceRoleLabel, spaceRoleWord, viewerContentRole } from './model';

/* Spaces design round 2 (12 October 2026): the fixes to the round 1
 * critique (results/spaces-r1/critique-fable.md). Pure rules first, then the
 * wiring, pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

/** Every `key={…}` expression in a source, in order. */
const keysIn = (source: string): string[] =>
  Array.from(source.matchAll(/\bkey=\{([^}]*\}?[^}]*)\}/g), (match) => match[1]);

/* ── MUST 1: no two siblings share a key ─────────────────────────────────── */

test('the frame keys the members sheet and the delete dialog apart', () => {
  const frame = read('v2', 'features', 'collab', 'shell', 'CollabFrame.tsx');
  assert.match(frame, /<SpaceMembersSheet\s+key=\{`members-\$\{space\.uuid\}`\}/);
  assert.match(frame, /<DeleteSpaceDialog\s+key=\{`delete-\$\{space\.uuid\}`\}/);
  // No sibling is keyed by the bare uuid, and no two keys in the frame match.
  assert.doesNotMatch(frame, /key=\{space\.uuid\}/);
  const keys = keysIn(frame);
  assert.ok(keys.length >= 3);
  assert.equal(new Set(keys).size, keys.length, keys.join(' | '));
});

test('the move and remove dialogs, siblings with counters from 1, carry their names', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /<MoveToSpaceDialog\s+key=\{`move-\$\{moving\.key\}`\}/);
  assert.match(panel, /<RemoveFromSpaceDialog\s+key=\{`remove-\$\{removing\.key\}`\}/);
  assert.doesNotMatch(panel, /key=\{(moving|removing)\.key\}/);
});

/* ── MUST 2: the phone list row has two meta lines ───────────────────────── */

test('below sm the list row splits its meta; from sm up it is one line', () => {
  const row = read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx');
  assert.match(
    row,
    /<div className="sm:hidden">\s*<MetaLine className="mt-1\.5" lead=\{\[role\]\} trail=\{trail\} \/>\s*<MetaLine className="mt-0\.5" lead=\{inside\(PHONE_CHIP_LIMIT\)\} \/>\s*<\/div>/,
  );
  assert.match(
    row,
    /<MetaLine\s+className=\{cn\('mt-1\.5', role && 'hidden sm:flex'\)\}\s+lead=\{\[role, \.\.\.inside\(\)\]\}\s+trail=\{trail\}/,
  );
  // A row with no role keeps the one line at every width.
  assert.match(row, /\{role \? \(\s*<div className="sm:hidden">/);
});

/* ── MUST 3: on a phone only the uploader truncates ──────────────────────── */

test('a file row holds its type and size together and lets the uploader truncate', () => {
  const row = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileRow.tsx');
  assert.match(row, /<span key="kind" className="flex shrink-0 items-center gap-2">/);
  // The uploader is the one plain string, the fact `MetaLine` truncates.
  assert.match(row, /<\/span>,\s*file\.uploader\.name,\s*\]\}/);
  const line = read('v2', 'features', 'collab', 'kit', 'MetaLine.tsx');
  assert.match(line, /export function MetaSeparator\(\)/);
  assert.match(line, /\{index > 0 \? <MetaSeparator \/> : null\}/);
});

/* ── MUST 4: the empty state's add action has its word ───────────────────── */

test('the folders and files empty states offer a labelled button', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(
    panel,
    /action=\{\s*<EmptyStateAddButton icon=\{Plus\} onClick=\{startFolder\}>\s*New folder\s*<\/EmptyStateAddButton>/,
  );
  assert.match(
    panel,
    /action=\{\s*<EmptyStateAddButton icon=\{Upload\} onClick=\{pickFiles\}>\s*Upload\s*<\/EmptyStateAddButton>/,
  );
  // The word is plain text in the button, never `sr-only`.
  assert.match(
    panel,
    /<Button type="button" size="sm" onClick=\{onClick\}>\s*<Icon aria-hidden className="size-4" \/>\s*\{children\}\s*<\/Button>/,
  );
  // The toolbar pills are not handed to an empty state any more.
  assert.doesNotMatch(panel, /action=\{(newFolderButton|uploadButton)\}\s*onInvite/);
});

/* ── SHOULD 5: a sheet opens with focus on its body ──────────────────────── */

test('the members sheet frame focuses its body, never the first control', () => {
  const frame = read('v2', 'features', 'collab', 'membership', 'MembersSheetFrame.tsx');
  assert.match(
    frame,
    /onOpenAutoFocus=\{\(event\) => \{\s*event\.preventDefault\(\);\s*bodyRef\.current\?\.focus\(\);\s*\}\}/,
  );
  assert.match(frame, /ref=\{bodyRef\}\s*tabIndex=\{-1\}/);
  // A step change moves focus to the new step's body too.
  assert.match(frame, /if \(open\) bodyRef\.current\?\.focus\(\);\s*\}, \[open, title\]\);/);
});

/* ── SHOULD 6: the move dialog's footer, in the New folder order ─────────── */

test('the move dialog puts an outlined Cancel first in the DOM, reversed on a desktop', () => {
  const dialog = read('v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx');
  assert.match(
    dialog,
    /<DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-between">\s*<Button\s+type="button"\s+variant="outline"\s+disabled=\{move\.isPending\}\s+onClick=\{\(\) => onOpenChange\(false\)\}\s*>\s*Cancel/,
  );
  const footer = dialog.slice(dialog.indexOf('<DialogFooter'), dialog.indexOf('</DialogFooter>'));
  assert.ok(footer.indexOf('Cancel') < footer.indexOf('Remove from space'));
  assert.doesNotMatch(footer, /variant="ghost"|<span aria-hidden \/>/);
});

/* ── SHOULD 7: the file row's body opens the file ────────────────────────── */

test('the file row body is the open control, at least 44px tall', () => {
  const row = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceFileRow.tsx');
  assert.match(
    row,
    /<button\s+type="button"\s+onClick=\{\(\) => open\(file\.id\)\}\s+disabled=\{opening\}\s+className=\{cn\(\s*IDENTITY_CLASS,/,
  );
  // 40px mark plus `py-2.5`: 60px.
  assert.match(row, /const IDENTITY_CLASS =\s*'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2\.5 text-left';/);
  // The meta line is phrasing content inside the button.
  assert.match(row, /<MetaLine\s+as="span"/);
  // The 32px open button is gone; the menu stays a sibling of the body.
  assert.doesNotMatch(row, /aria-label=\{`Open \$\{file\.original_name\}`\}/);
  assert.match(row, /<\/button>\s*\)\}\s*\{onMove \|\| onRemoveFromSpace \? \(/);
  // The failure line, with its own Try again button, sits outside the body.
  assert.ok(row.indexOf("Couldn&rsquo;t open it.") > row.indexOf('</DropdownMenu>'));
});

/* ── SHOULD 8 and round 0 #2: the bar menu's rules ───────────────────────── */

const icon = (() => null) as unknown as LucideIcon;
const noop = () => {};
const menuRow = (id: string, extra: Partial<ScreenAction> = {}): ScreenAction => ({
  id,
  label: id,
  icon,
  onSelect: noop,
  ...extra,
});
const rules = (actions: readonly ScreenAction[]) =>
  actions.map((_, index) => ruledAbove(actions, index));

test('a rule goes before the first destructive row and where a row asks', () => {
  const space = (items: ReturnType<typeof spaceMenuItems>) =>
    items.map((item) =>
      menuRow(item, {
        destructive: item === 'leave' || item === 'delete',
        separatorBefore: item === 'rename',
      }),
    );
  // Owner: Members, Invite links, Waiting | Rename | Leave, Delete.
  assert.deepEqual(
    rules(space(spaceMenuItems({ canManage: true, isOwner: true, leaveRoute: 'leave' }))),
    [false, false, false, true, true, false],
  );
  // Viewer: Members | Leave.
  assert.deepEqual(
    rules(space(spaceMenuItems({ canManage: false, isOwner: false, leaveRoute: 'leave' }))),
    [false, true],
  );
  // The folder screen's menu: Rename, Move to space | Delete folder.
  assert.deepEqual(
    rules([menuRow('rename'), menuRow('move-to-space'), menuRow('delete', { destructive: true })]),
    [false, false, true],
  );
  // A menu that opens on a destructive row draws no rule above it.
  assert.deepEqual(rules([menuRow('delete-chat', { destructive: true })]), [false]);
  assert.deepEqual(rules([menuRow('settings')]), [false]);
  assert.equal(ruledAbove([menuRow('a')], 5), false);
});

test('the bar menu draws the rules and the space menu asks for one before Rename', () => {
  const menu = read('v2', 'shell', 'V2HeaderMenu.tsx');
  assert.match(
    menu,
    /<Fragment key=\{action\.id\}>\s*\{ruledAbove\(screenActions, index\) \? <DropdownMenuSeparator \/> : null\}/,
  );
  const context = read('v2', 'shell', 'screen-context.ts');
  // A change to the flag is a new snapshot, like every other field.
  assert.match(
    context,
    /\(action\.separatorBefore \?\? false\) === \(other\.separatorBefore \?\? false\)/,
  );
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(screen, /label: 'Rename',\s*icon: Pencil,\s*separatorBefore: true,/);
});

/* ── Round 0 #25: the header's faces are bigger on a desktop ─────────────── */

test('the space header shows 40px faces from md up', () => {
  const stack = read('v2', 'features', 'collab', 'kit', 'PresenceStack.tsx');
  assert.match(stack, /lg: \{ faces: 4, avatar: 'lg', text: 'text-sm' \},/);
  const header = read('v2', 'features', 'spaces', 'detail', 'SpacePlaceHeader.tsx');
  assert.match(header, /size="md"\s*withCount\s*onClick=\{onOpenRoster\}\s*className="md:hidden"/);
  assert.match(header, /size="lg"\s*withCount\s*onClick=\{onOpenRoster\}\s*className="hidden md:inline-flex"/);
});

/* ── NICE ────────────────────────────────────────────────────────────────── */

test('the links and waiting steps use plain verbs', () => {
  const links = read('v2', 'features', 'invites', 'InviteLinksPanel.tsx');
  assert.match(links, /<Trash2 aria-hidden className="size-4" \/> Stop link/);
  assert.doesNotMatch(links, /Stop it/);
  const requests = read('v2', 'features', 'invites', 'JoinRequestsPanel.tsx');
  assert.match(requests, /<UserX aria-hidden className="size-4" \/>\s*Decline\s*<\/Button>/);
});

test('a row under the Invited heading drops its Pending chip', () => {
  const rosterRow = read('v2', 'features', 'collab', 'membership', 'RosterRow.tsx');
  assert.match(rosterRow, /showPending = true,/);
  assert.match(rosterRow, /\{member\.is_pending && showPending && \(/);
  // The row is shared by the sheet and the People tab (people/use-roster-row.tsx).
  const row = read('v2', 'features', 'spaces', 'detail', 'people', 'use-roster-row.tsx');
  assert.match(row, /showPending=\{!underInvited\}/);
  const sheet = read('v2', 'features', 'spaces', 'detail', 'SpaceMembersSheet.tsx');
  assert.match(sheet, /const rosterRow = useSpaceRosterRow\(\{/);
  assert.match(sheet, /\{invited\.map\(\(member\) => rosterRow\(member, true\)\)\}/);
  assert.match(sheet, /\{joined\.map\(\(member\) => rosterRow\(member\)\)\}/);
});

test('the folder level bar keeps the word Open on a phone', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(
    panel,
    /<FolderOpen aria-hidden className="size-4" \/>[\s\S]*?<span>\s*Open<span className="sr-only sm:not-sr-only">\{' folder'\}<\/span>\s*<\/span>/,
  );
});

test('the add pill is 44px on the folders screen as on a space tab', () => {
  const browser = read('v2', 'features', 'folders', 'list', 'FoldersBrowser.tsx');
  assert.match(browser, /'v2-interactive inline-flex min-h-11 shrink-0 items-center gap-1\.5 rounded-full bg-primary px-4/);
  // Its skeleton reserves the same height, so nothing jumps when it lands.
  const fallback = read('v2', 'features', 'folders', 'list', 'FoldersFallback.tsx');
  assert.match(fallback, /<div className="h-11 w-11 rounded-full bg-primary\/60 sm:w-32" \/>/);
});

/* ── Round 2 critique NICE 3: one set of role words ──────────────────────── */

test('a team space maps its old role to the content role the server derives', () => {
  const team = (my_role: 'owner' | 'admin' | 'member' | null) =>
    viewerContentRole({ kind: 'team', my_role, my_content_role: null });
  assert.equal(team('owner'), 'owner');
  assert.equal(team('admin'), 'editor');
  assert.equal(team('member'), 'editor');
  assert.equal(team(null), null);
  // A stated content role wins over the old one.
  assert.equal(
    viewerContentRole({ kind: 'team', my_role: 'member', my_content_role: 'viewer' }),
    'viewer',
  );
});

test('a shared space never guesses its content role from the old role', () => {
  // Its Viewer has `my_role: member`; a guess would read "Contributor".
  assert.equal(viewerContentRole({ kind: 'shared', my_role: 'member', my_content_role: null }), null);
  assert.equal(spaceRoleWord({ kind: 'shared', my_role: 'member', my_content_role: null }), null);
});

test('the picker word and the list line name one person the same way', () => {
  const cases = [
    { kind: 'team', my_role: 'member', my_content_role: 'editor' },
    { kind: 'team', my_role: 'admin', my_content_role: null },
    { kind: 'team', my_role: 'owner', my_content_role: 'owner' },
    { kind: 'shared', my_role: 'member', my_content_role: 'viewer' },
    { kind: 'shared', my_role: 'member', my_content_role: 'editor' },
    { kind: 'shared', my_role: 'owner', my_content_role: 'owner' },
  ] as const;
  for (const space of cases) {
    const word = spaceRoleWord(space);
    assert.ok(word === 'Owner' || word === 'Contributor' || word === 'Viewer', word ?? 'null');
    const line = spaceRoleLabel(space);
    assert.ok(line?.endsWith(word.toLowerCase()), `${line} / ${word}`);
  }
  // Lawexa HQ in the round 2 shots: a team member, "Contributor" in both.
  assert.equal(spaceRoleWord(cases[0]), 'Contributor');
  assert.equal(spaceRoleLabel(cases[0]), 'You’re a contributor');
});

test('the move picker reads its role word from the spaces model', () => {
  const dialog = read('v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx');
  assert.match(dialog, /const role = spaceRoleWord\(space\);/);
  assert.doesNotMatch(dialog, /CONTENT_ROLE_LABELS/);
  assert.doesNotMatch(dialog, /my_content_role\]/);
});

/* ── Round 2 critique NICE 4: two whole channel names on a phone ─────────── */

test('the phone meta line shows two channel chips and says more for the rest', () => {
  const row = read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx');
  assert.match(row, /const PHONE_CHIP_LIMIT = 2;/);
  assert.match(row, /function ChannelChips\(\{ activity, max \}: \{ activity: SpaceActivity; max\?: number \}\)/);
  assert.match(
    row,
    /const chips = max === undefined \? activity\.chips : activity\.chips\.slice\(0, max\);/,
  );
  // "more" covers the names the cap held back, not only the server's overflow.
  assert.match(row, /const hasMore = activity\.hasMore \|\| chips\.length < activity\.chips\.length;/);
  assert.match(row, /\{hasMore \? \(/);
  assert.doesNotMatch(row, /activity\.chips\.map/);
});
