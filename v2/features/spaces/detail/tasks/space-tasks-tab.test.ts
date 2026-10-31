import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

test('the Tasks pill draws the task board, with no feed read, no file drop and no message box', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  // The owner and editors work the board; the Thread field lists rooms only
  // where the space shows them.
  assert.match(
    panel,
    /tab === 'tasks' \? \(\s*<SpaceTasksPanel spaceUuid=\{space\.uuid\} canEdit=\{access\.canAdd\} rooms=\{rooms\} \/>/,
  );
  assert.match(panel, /const OWN_LIST_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>\(\['people', 'radars', 'tasks'\]\);/);
  assert.match(panel, /enabled: enabled && !ownList,/);
  assert.match(panel, /access\.canAdd && !ownList \?/);
  // The message box is for chats, folders and Radars, not for the board.
  assert.match(panel, /const DOCK_TABS: ReadonlySet<SpaceTab> = new Set<SpaceTab>\(\['all', 'conversations', 'folders', 'radars'\]\);/);
});

test('the board reads one list, and its only colour is each stage’s thread-status dot', () => {
  const queries = read('v2', 'features', 'spaces', 'queries.ts');
  assert.match(queries, /queryKey: \[\.\.\.spacesQueries\.tasksOf\(spaceUuid\), \{ viewerId \}\] as const,/);
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /`\/spaces\/\$\{encodeURIComponent\(spaceUuid\)\}\/tasks`/);
  // Stay's B (29 October 2026): no chips, badges or coloured fills; the stage
  // colour is the small dot in a column's head and the phone's switcher.
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  assert.doesNotMatch(board, /<ThreadStatusChip\b/);
  const dots = board.match(/<ThreadStatusDot [^>]*\/>/g) ?? [];
  assert.equal(dots.length, 3);
  for (const tag of dots) assert.match(tag, /value=\{TASK_STAGE_TONE(\[[\w.]+\]|\.done)\}/);
});

test('every pill keeps the same page column, as wide as the board, so the pills never jump and nothing reaches past the header', () => {
  // Arthur, 29 October 2026, 19:11Z: on Tasks the whole page moved ~90px left
  // and his next click landed on the wrong pill.
  const screen = read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx');
  assert.match(screen, /<div className=\{SPACE_PANE\}>\s*<div className=\{SPACE_PAGE_COLUMN\}>/);
  assert.doesNotMatch(screen, /tab === 'tasks' \?/);
  assert.doesNotMatch(screen, /SPACE_BOARD_COLUMN/);
  const parts = read('v2', 'features', 'spaces', 'detail', 'lobby-parts.tsx');
  assert.match(parts, /export const SPACE_PANE = '@container /);
  // Arthur's C, 30 October 2026, 19:03Z: the column is the board's width, and the board has no wider band.
  assert.match(parts, /export const SPACE_PAGE_COLUMN =\s*'mx-auto flex min-h-full w-full max-w-6xl /);
  assert.doesNotMatch(parts, /SPACE_BOARD_BLEED/);
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  assert.doesNotMatch(board, /SPACE_BOARD_BLEED|mx-\[calc/);
  assert.match(board, /\{\/\* The board takes the page column's width[^}]*\*\/\}\s*<TaskRenameContext value=\{renameTask\}>\s*<Board\s+columns=\{columns\}/);
  // The rows keep a readable preview line in the wider column.
  const rows = read('v2', 'features', 'spaces', 'detail', 'content', 'feed-rows.tsx');
  assert.match(rows, /<span className="block max-w-2xl truncate">\{line\.meta\}<\/span>/);
});

test('the board follows .task.changed on the space channel, and the last board to unmount leaves it', () => {
  const protocol = read('v2', 'runtime', 'realtime', 'protocol.ts');
  assert.match(protocol, /export function spaceChannelName\(spaceUuid: string\): string \{\s*return `spaces\.\$\{spaceUuid\}`;/);
  assert.match(protocol, /export const EVT_TASK_CHANGED = '\.task\.changed';/);
  const live = read('v2', 'features', 'spaces', 'detail', 'tasks', 'use-task-board-live.ts');
  assert.match(live, /const echo = getV2Echo\(\);\s*if \(!echo\) return;/);
  assert.match(
    live,
    /const name = spaceChannelName\(spaceUuid\);\s*const channel = echo\.private\(name\);\s*channel\.listen\(EVT_TASK_CHANGED, onChanged\);\s*retainChannel\(name\);/,
  );
  // The uuids seen deleted go with every event, so a late update cannot revive one.
  assert.match(live, /if \(event\.action === 'deleted'\) deleted\.add\(event\.task\.uuid\);/);
  assert.match(live, /applyTaskChanged\(list, event, deleted\)/);
  // The techlead's review and recheck: stop this listener, and leave only when no board listens.
  assert.match(
    live,
    /return \(\) => \{\s*channel\.stopListening\(EVT_TASK_CHANGED, onChanged\);\s*if \(releaseChannel\(name\) === 0\) echo\.leave\(name\);\s*\};/,
  );
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  assert.match(board, /useTaskBoardLive\(spaceUuid, session\.userId, eligible\);/);
});

test('a card opens the task box, and only the owner and editors get New task', () => {
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  assert.match(board, /<button\s+ref=\{\(node\) => \{\s*setNodeRef\(node\);[\s\S]*?type="button"\s+onClick=\{\(event\) => \{[\s\S]*?onOpen\(\);\s*\}\}/);
  assert.match(board, /const newTask = canEdit \? \(\) => openSheet\(\{ kind: 'new' \}\) : null;/);
  const sheet = read('v2', 'features', 'spaces', 'detail', 'tasks', 'TaskBox.tsx');
  // A viewer gets no Save, Delete or queue moves.
  assert.match(sheet, /const foot = canEdit \? \(/);
  assert.match(sheet, /\{task && canEdit && task\.stage === 'queued' \? \(\s*<div className="sm:col-span-2">\s*<QueueOrder/);
  // Centred on a computer, the whole screen on a phone, at the breakpoint the case page's panel uses.
  assert.match(sheet, /const phone = useSheetSide\(\) === 'bottom';/);
});

test('a click on a card’s title renames it in place on a computer; Enter on the card still opens the box', () => {
  const board = read('v2', 'features', 'spaces', 'detail', 'tasks', 'SpaceTasksPanel.tsx');
  // The click's own detail: 0 for a keyboard's Enter or Space, which opens the box.
  assert.match(board, /cardClickRenames\(\{ canEdit: rename !== null, computer, onTitle, detail: event\.detail \}\)/);
  assert.match(board, /const COMPUTER = '\(min-width: 768px\)';/);
  // While renaming the card is no button, and no drag starts from it or its field.
  assert.match(board, /disabled: !canDrag \|\| renaming,/);
  assert.match(board, /<div className=\{cn\(CARD, NOTE_FILL\[stage\], 'ring-2 ring-ring\/40'\)\}>/);
  assert.match(board, /<span data-no-dnd className="flex min-w-0 flex-1 flex-col gap-1">\s*<Input/);
  // The field's blur as it unmounts never saves twice, nor saves what Escape dropped.
  assert.match(board, /const commit = \(byKey: boolean\) => \{\s*if \(ended\.current\) return;/);
  // Enter and Escape give focus back to the card; a click away leaves it where the click put it.
  assert.match(board, /commit\(true\);[\s\S]*?end\(true\);[\s\S]*?onBlur=\{\(\) => \(error \? end\(false\) : commit\(false\)\)\}/);
  assert.match(board, /if \(node && refocus\.current\) \{\s*refocus\.current = false;\s*node\.focus\(\);/);
  // The rename is the drop's own optimistic patch, for those who may edit.
  assert.match(board, /const renameTask: RenameTask \| null = canEdit \? \(change\) => patch\.mutate\(change\) : null;/);
});

test('the task chat is the thread’s own feed and composer, asked for only by those who may open channels', () => {
  const chat = read('v2', 'features', 'spaces', 'detail', 'tasks', 'TaskChatThread.tsx');
  assert.match(chat, /<ChannelFeed\b/);
  // A thread started from the box has no first message: the feed shows no line saying so.
  assert.match(chat, /hideMissingRoot\r?\n/);
  const feed = read('v2', 'features', 'channels', 'feed', 'ChannelFeed.tsx');
  assert.match(feed, /const quietHead = channel\.is_thread && hideMissingRoot && !channel\.root_message;/);
  // Neither the missing-root line nor a channel's own intro, empty or at the head of history.
  assert.equal(feed.match(/quietHead \? null : \(threadOpening \?\? \(/g)?.length, 2);
  assert.match(chat, /<ChannelComposer\b/);
  assert.match(chat, /useChannelRoom\(channel\.uuid, \{ enabled: canPost \}\)/);
  assert.match(chat, /useChannelReadPointer\(channel\.uuid, \{ enabled: threadAccess\(channel\)\.isFollowing \}\)/);
  const box = read('v2', 'features', 'spaces', 'detail', 'tasks', 'TaskBox.tsx');
  assert.match(box, /const canChat = session\.canAccessTeamChannels;/);
  assert.match(box, /enabled: canChat && threadUuid !== null,/);
  // On a phone the chat sits outside the details form: Enter in the composer sends, never saves.
  assert.match(box, /\{phoneTab === 'chat' && task \? \(\s*\/\/ Outside the details form/);
});

test('New task offers the Thread field, and Start a thread picks its channel from the rail’s own list', () => {
  const box = read('v2', 'features', 'spaces', 'detail', 'tasks', 'TaskBox.tsx');
  // New task is the same box, empty: its Thread field is the saved task's, for every editor who sees the rooms.
  assert.match(box, /<FieldBlock label="Thread"[^]*?\{canEdit && rooms \? \(\s*<ThreadSelect\b/);
  assert.match(box, /createTask\.mutate\(createPayload\(draft\)/);
  // The channels come from the rail's read, asked for only where a thread may start.
  assert.match(box, /useQuery\(\{ \.\.\.channelsQueries\.bySpace\(\{ spaceUuid, viewerId, per_page: 50 \}\), enabled: mayStart \}\)/);
  assert.match(box, /payload: startThreadPayload\(startIn\) \}/);
  // A refusal shows under the picker, and once: no toast says it again.
  assert.match(box, /onError: \(failure\) => setStartError\(startThreadError\(extractApiError\(failure\)\)\)/);
  const mutations = read('v2', 'features', 'spaces', 'detail', 'tasks', 'task-mutations.ts');
  assert.match(mutations, /spaceTasksApi\.startThread\(spaceUuid, taskUuid, payload\),\s*\/\/[^\n]*\n\s*meta: \{ silentError: true \},/);
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /`\/spaces\/\$\{encodeURIComponent\(spaceUuid\)\}\/tasks\/\$\{encodeURIComponent\(taskUuid\)\}\/thread`,\s*payload,/);
});

test('a thread’s More menu offers Make a task, which opens New task with the thread in it', () => {
  const screen = read('v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx');
  assert.match(screen, /const makeTask = useMakeTaskFromThread\(channel\);/);
  assert.match(screen, /\{makeTask\.offered && \(\s*<DropdownMenuItem onClick=\{makeTask\.open\}>[^]*?Make a task/);
  assert.match(screen, /\{makeTask\.box\}/);
  const make = read('v2', 'features', 'spaces', 'detail', 'tasks', 'MakeTaskFromThread.tsx');
  assert.match(make, /canMakeTaskFrom\(channel, space\.data\?\.data\)/);
  assert.match(make, /setTarget\(\{ kind: 'new', seed: taskSeedFromThread\(channel\) \}\)/);
  const box = read('v2', 'features', 'spaces', 'detail', 'tasks', 'TaskBox.tsx');
  assert.match(box, /seededDraft\(draftFromTask\(task, session\.userUuid\), seed\)/);
  // The thread stays a choice even when the list's first page does not carry it.
  assert.match(box, /current=\{task\?\.thread \?\? seed\?\.thread \?\? null\}/);
});

test('a task’s thread page opens on no missing-first-message line, and a new task linking it says so at once', () => {
  const screen = read('v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx');
  // The thread's own show names its task (Backend's `task`); without it the page draws as before.
  assert.match(screen, /hideMissingRoot=\{channel\.task != null\}/);
  const types = read('types', 'collab.ts');
  assert.match(types, /task\?: \{ uuid: string; title: string \} \| null;/);
  const mutations = read('v2', 'features', 'spaces', 'detail', 'tasks', 'task-mutations.ts');
  assert.match(mutations, /if \(thread\) void queryClient\.invalidateQueries\(\{ queryKey: channelsQueries\.detailsOf\(thread\.uuid\) \}\);/);
});
