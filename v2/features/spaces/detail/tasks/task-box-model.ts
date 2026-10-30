import type { SpaceTask } from '@/types/collab';

/**
 * task-box-model — what the task box's chat pane shows, and which tab a phone
 * opens on (Arthur's choice 1 + 2, thread 7aa0c6d8, 19:51Z; the combined
 * design 1805492d, approved 11aefe48).
 *
 * The pane is the task's linked thread. The server says, per task, whether the
 * reader may read it and post in it (`can_read`, `can_post` on `task.thread`,
 * Backend's half 98f03c46): reading needs the researcher role, and posting
 * needs membership of the thread's channel, as on the thread's own page. The
 * board role does not decide it.
 *
 *   new       a task not saved yet: nothing to chat about.
 *   none      no thread linked: "Start a thread" for those who may edit the task.
 *   hidden    the reader may not read the thread.
 *   read      the reader may read but not post: the messages, and Join to reply.
 *   post      the messages and the composer.
 *
 * A server from before the flags sends neither: the thread then reads as the
 * thread page reads it, readable and open to post, and a refused post shows the
 * server's message.
 */

export type TaskThread = NonNullable<SpaceTask['thread']>;

export type TaskChatState =
  | { kind: 'new' }
  | { kind: 'none'; canStart: boolean }
  | { kind: 'hidden'; thread: TaskThread }
  | { kind: 'read'; thread: TaskThread }
  | { kind: 'post'; thread: TaskThread };

export function taskChatState(task: SpaceTask | null, canEdit: boolean): TaskChatState {
  if (!task) return { kind: 'new' };
  const thread = task.thread;
  if (!thread) return { kind: 'none', canStart: canEdit };
  if (thread.can_read === false) return { kind: 'hidden', thread };
  if (thread.can_post === false) return { kind: 'read', thread };
  return { kind: 'post', thread };
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
