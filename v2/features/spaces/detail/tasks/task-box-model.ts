import type { SpaceTask } from '@/types/collab';

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
  | { kind: 'new' }
  | { kind: 'none'; canStart: boolean }
  | { kind: 'loading'; thread: TaskThread }
  | { kind: 'hidden'; thread: TaskThread }
  | { kind: 'failed'; thread: TaskThread }
  | { kind: 'read'; thread: TaskThread }
  | { kind: 'post'; thread: TaskThread };

export function taskChatState(task: SpaceTask | null, canEdit: boolean, access: ThreadAccess): TaskChatState {
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
