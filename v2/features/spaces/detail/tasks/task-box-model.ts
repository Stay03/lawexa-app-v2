import type { Channel, Space, SpaceTask } from '@/types/collab';
import { channelDisplayName } from '@/v2/features/channels/thread-model';
import { canAddContent } from '@/v2/features/spaces/model';

import { TASK_TITLE_MAX, type TaskDraft } from './task-sheet-model';

/**
 * task-box-model — what the task box's chat pane shows, and which tab a phone
 * opens on (Arthur's choice 1 + 2, thread 7aa0c6d8, 19:51Z; the combined
 * design 1805492d, approved 11aefe48).
 *
 * The pane is the task's linked thread. Whether the reader may read it and
 * post in it is the thread's own answer, read when the pane opens
 * (`GET /channels/{uuid}`: `can_read`, `can_post`; Backend 8cd4dfe6), not a
 * flag on the task, which every member receives as one shared copy. Reading
 * needs the researcher role, and a reader without it gets a 403 there.
 * Posting needs membership of the thread's channel, as on the thread's own
 * page; the board role does not decide it.
 *
 *   concealed the task has a thread this reader may not read (Backend
 *             5a1b7543: `has_hidden_thread`): no pane, no tab and no Thread
 *             field, and no line about it (Stay, through the techlead, 05:06Z).
 *   closed    the reader may not open channels at all (Stay's choice A, 20:24Z:
 *             task chat is for Researchers): a line saying so, nothing asked.
 *   new       a task not saved yet: nothing to chat about.
 *   none      no thread linked: "Start a thread" for those who may edit the task.
 *   loading   the thread's answer is on its way.
 *   hidden    the reader may not read the thread (a 403, or `can_read` false).
 *   failed    the thread's answer did not come: Try again.
 *   read      the reader may read but not post: the messages, and Join to reply.
 *   post      the messages and the composer.
 */

export type TaskThread = NonNullable<SpaceTask['thread']>;

/** The thread's own answer about this reader, as the pane has it. */
export type ThreadAccess =
  | { status: 'pending' }
  | { status: 'forbidden' }
  | { status: 'failed' }
  | { status: 'read'; canRead: boolean; canPost: boolean };

export type TaskChatState =
  | { kind: 'concealed' }
  | { kind: 'closed' }
  | { kind: 'new' }
  | { kind: 'none'; canStart: boolean }
  | { kind: 'loading'; thread: TaskThread }
  | { kind: 'hidden'; thread: TaskThread }
  | { kind: 'failed'; thread: TaskThread }
  | { kind: 'read'; thread: TaskThread }
  | { kind: 'post'; thread: TaskThread };

/**
 * `canChat` is the server's own flag for channels (`canAccessTeamChannels`
 * from `/auth/me`, Researchers and above): every channel door reads it.
 */
export function taskChatState(
  task: SpaceTask | null,
  { canEdit, canChat }: { canEdit: boolean; canChat: boolean },
  access: ThreadAccess,
): TaskChatState {
  if (task && !task.thread && task.has_hidden_thread) return { kind: 'concealed' };
  if (!canChat) return { kind: 'closed' };
  if (!task) return { kind: 'new' };
  const thread = task.thread;
  if (!thread) return { kind: 'none', canStart: canEdit };
  switch (access.status) {
    case 'pending':
      return { kind: 'loading', thread };
    case 'forbidden':
      return { kind: 'hidden', thread };
    case 'failed':
      return { kind: 'failed', thread };
    default:
      if (!access.canRead) return { kind: 'hidden', thread };
      return access.canPost ? { kind: 'post', thread } : { kind: 'read', thread };
  }
}

/**
 * The thread's answer from its query: a 403 is a refusal to this reader, any
 * other failure is worth a retry. The flags read as the thread's own page
 * reads them (`threadAccess` in collab/access.tsx): only a `true` opens.
 */
export function taskThreadAccess(query: {
  isPending: boolean;
  data?: { can_read?: boolean; can_post?: boolean } | undefined;
  errorStatus: number | null;
}): ThreadAccess {
  if (query.data) return { status: 'read', canRead: query.data.can_read === true, canPost: query.data.can_post === true };
  if (query.isPending) return { status: 'pending' };
  return query.errorStatus === 403 ? { status: 'forbidden' } : { status: 'failed' };
}

/** The line the pane shows where it has no messages to show. */
export function taskChatLine(state: TaskChatState): string | null {
  switch (state.kind) {
    case 'closed':
      return 'Task chat is for Researchers, so it isn’t open to you.';
    case 'new':
      return 'Save the task first to chat about it.';
    case 'none':
      return 'No chat for this task yet.';
    case 'hidden':
      return 'You can’t see this task’s thread.';
    case 'failed':
      return 'The chat didn’t load.';
    default:
      return null;
  }
}

/** The box's two tabs on a computer, under the task's head. */
export type TaskBoxTab = 'details' | 'history';

/** A phone's box is full screen, with the details and the chat as two tabs. */
export type TaskPhoneTab = 'details' | 'chat';

/**
 * The tab a phone opens on: the chat when the box was opened to reply (a
 * notification), else the details. A new task has no chat, so always details.
 */
export function initialPhoneTab(task: SpaceTask | null, openTo: TaskPhoneTab | null): TaskPhoneTab {
  return task && openTo === 'chat' ? 'chat' : 'details';
}

/**
 * INLINE RENAME ON THE CARD (design 1805492d, item 2 of Arthur's choice): a
 * click on a card's title text renames it in place, on a computer, for those
 * who may edit; any other click opens the box. Enter on a focused card is a
 * keyboard click (`detail` 0) and always opens the box, as the drag plan pins
 * (Space lifts, Enter opens). A phone renames in the box only: there a press
 * and hold is the drag (Frontend's review, f8e0bb68).
 */
export function cardClickRenames(click: {
  canEdit: boolean;
  computer: boolean;
  onTitle: boolean;
  /** The click's `detail`: 0 for a keyboard's Enter or Space. */
  detail: number;
}): boolean {
  return click.canEdit && click.computer && click.onTitle && click.detail > 0;
}

/** What a typed title sends: nothing when unchanged, an error when empty, else the patch and the card as shown. */
export type RenameOutcome =
  | { kind: 'unchanged' }
  | { kind: 'invalid'; message: string }
  | { kind: 'save'; payload: { title: string }; shown: SpaceTask };

export function renameOutcome(task: SpaceTask, typed: string, max: number): RenameOutcome {
  const title = typed.trim();
  if (title === task.title) return { kind: 'unchanged' };
  if (title === '') return { kind: 'invalid', message: 'A task needs a title.' };
  if (title.length > max) return { kind: 'invalid', message: `A title is at most ${max} characters.` };
  return { kind: 'save', payload: { title }, shown: { ...task, title } };
}

/** A channel a task's thread may start in. */
export interface StartChannel {
  uuid: string;
  name: string;
}

/** Whether the task box shows a chat at all: not on a card whose thread this reader may not read. */
export function taskChatShown(state: TaskChatState): boolean {
  return state.kind !== 'concealed';
}

/**
 * Where "Start a thread" may put the task's thread (Stay, 30 October 2026,
 * 22:40Z; Backend 45842ebc, 5a1b7543). The Space's top-level channels the
 * starter may post in: every open one, and the private ones they are in
 * (`is_member` is real membership on a channel, unlike on a thread), in name
 * order, from the rail's list. The preselected one is the oldest open
 * channel, the server's own default (its first `space_public` channel by id),
 * read from the data rather than the list's order, so leaving the picker
 * alone starts the thread where it always has; in a Space whose channels the
 * starter may post in are all private, the oldest of those (Frontend's
 * review, 05:26Z), since the start always names the channel shown.
 */
export function startThreadChannels(rooms: readonly Channel[]): { options: StartChannel[]; preselected: string | null } {
  const postable = new Map<string, Channel>();
  for (const room of rooms) {
    if (room.is_thread || postable.has(room.uuid)) continue;
    if (room.visibility !== 'space_public' && room.is_member !== true) continue;
    postable.set(room.uuid, room);
  }
  const rows = [...postable.values()];
  const oldestOf = (list: readonly Channel[]) =>
    list.reduce<Channel | null>((first, room) => (first === null || room.created_at < first.created_at ? room : first), null);
  const oldest = oldestOf(rows.filter((room) => room.visibility === 'space_public')) ?? oldestOf(rows);
  return {
    options: rows.map((room) => ({ uuid: room.uuid, name: room.name })).sort((a, b) => a.name.localeCompare(b.name)),
    preselected: oldest?.uuid ?? null,
  };
}

/** A room the Thread field offers: its uuid and the name it shows. */
export interface ThreadChoice {
  uuid: string;
  name: string;
}

/**
 * The rooms a task may point at (Backend 5a1b7543: any thread of the Space
 * the person linking can read): open channels and the private ones they are
 * in, and threads they can read (`can_read`, stamped per viewer on the
 * threads list), each once, with the task's own thread kept.
 */
export function threadChoices(rooms: readonly Channel[], current: SpaceTask['thread']): ThreadChoice[] {
  const choices = new Map<string, ThreadChoice>();
  for (const room of rooms) {
    if (choices.has(room.uuid)) continue;
    const readable = room.is_thread ? room.can_read === true : room.visibility === 'space_public' || room.is_member === true;
    if (readable) choices.set(room.uuid, { uuid: room.uuid, name: channelDisplayName(room) });
  }
  if (current && !choices.has(current.uuid)) choices.set(current.uuid, { uuid: current.uuid, name: current.name });
  return [...choices.values()];
}

/**
 * The start's body: always the channel the picker shows (Frontend's review,
 * 23:05Z), so what is shown is what happens even where two channels share a
 * date and the server's "first by id" would part from it. Nothing only while
 * the list is on its way: then the server picks, as before.
 */
export function startThreadPayload(shown: string | null): { channel_uuid?: string } {
  return shown !== null ? { channel_uuid: shown } : {};
}

/** What a refused start says: the server's word on the channel, else its message. */
export function startThreadError(failure: { message: string; errors: Record<string, string[]> | null }): string {
  return failure.errors?.channel_uuid?.[0] ?? failure.message;
}

/** What "Make a task" in a thread hands New task: that thread, and its title. */
export interface TaskSeed {
  thread: TaskThread;
  title: string;
}

/**
 * Whether a thread offers "Make a task" (Stay, 31 October 2026, a284e4fe):
 * any thread, private ones included, since whoever has its page open can
 * read it and that is the link rule (Backend 5a1b7543), seen by someone who
 * may make tasks there (the board's own New task rule: the Space's owner and
 * editors).
 */
export function canMakeTaskFrom(
  channel: Pick<Channel, 'is_thread'>,
  space: Pick<Space, 'my_content_role'> | null | undefined,
): boolean {
  return channel.is_thread && !!space && canAddContent(space);
}

/** New task from a thread: the thread in its Thread field, its title as the task's (cut to fit). */
export function taskSeedFromThread(channel: Pick<Channel, 'uuid' | 'is_thread' | 'title' | 'name' | 'parent_channel_uuid'>): TaskSeed {
  const name = channelDisplayName(channel);
  return {
    thread: { uuid: channel.uuid, name, channel_uuid: channel.parent_channel_uuid ?? '' },
    title: name.trim().slice(0, TASK_TITLE_MAX),
  };
}

/** The New task form with a seed's thread and title in it. */
export function seededDraft(draft: TaskDraft, seed: TaskSeed | undefined): TaskDraft {
  return seed ? { ...draft, title: seed.title, thread: seed.thread.uuid } : draft;
}
