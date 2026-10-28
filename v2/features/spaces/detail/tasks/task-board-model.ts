import type { SpaceTask, SpaceTaskPerson, SpaceTaskStage, ThreadStatusValue } from '@/types/collab';

/**
 * task-board-model — what a space's task board shows (thread 7aa0c6d8, Stay's
 * A, 27 October 2026: "A but in a clean UI/UX in the space that both humans
 * and agent can use"). Pure, so every rule below is a unit test.
 *
 * TWO VIEWS OF ONE LIST. By person (the default) answers "what is Backend
 * doing, and what's next": one group per owner, their task in progress first,
 * then what is paused, what waits on someone, the queue in order, and their
 * done tasks folded at the end. By stage answers "what is waiting on Stay":
 * one group per stage, each row naming its owner.
 *
 * THE STAGE CHIP BORROWS THE THREAD STATUS (techlead, 28 October 2026:
 * exactly the thread-status chip style, no new colours). Queued, Working and
 * Done are the thread's own; Paused takes On Hold's slate and Waiting takes
 * Needs Action's amber, the two thread statuses they mean.
 */

export const TASK_STAGES: readonly SpaceTaskStage[] = ['queued', 'working', 'paused', 'waiting', 'done'];

export const TASK_STAGE_LABELS: Readonly<Record<SpaceTaskStage, string>> = {
  queued: 'Queued',
  working: 'Working',
  paused: 'Paused',
  waiting: 'Waiting',
  done: 'Done',
};

/** The thread status whose chip colours each stage wears. */
export const TASK_STAGE_TONE: Readonly<Record<SpaceTaskStage, ThreadStatusValue>> = {
  queued: 'queued',
  working: 'working',
  paused: 'on_hold',
  waiting: 'needs_action',
  done: 'completed',
};

/** How far back the board's done tasks reach: the server's default window. */
export const DONE_WINDOW_DAYS = 14;

/** The fold over a group's done tasks: "Done, last 14 days (3)". */
export function doneFoldLabel(count: number): string {
  return `Done, last ${DONE_WINDOW_DAYS} days (${count})`;
}

/** One owner's tasks, in the order the board reads them. */
export interface PersonGroup {
  /** The owner's uuid, or `unassigned`. */
  key: string;
  /** `null`: the tasks nobody has yet. */
  owner: SpaceTaskPerson | null;
  /** Longest-running first. More than one is allowed, and warned about. */
  working: SpaceTask[];
  paused: SpaceTask[];
  waiting: SpaceTask[];
  /** The queue, in the owner's order. */
  next: SpaceTask[];
  /** Newest first. */
  done: SpaceTask[];
}

export const UNASSIGNED_KEY = 'unassigned';

/**
 * The board by person: one group per owner, by name, and the tasks nobody has
 * last. A person with only done tasks still has a group, so a finished week
 * does not vanish.
 */
export function groupByPerson(tasks: readonly SpaceTask[]): PersonGroup[] {
  const groups = new Map<string, PersonGroup>();
  for (const task of tasks) {
    const key = task.owner?.uuid ?? UNASSIGNED_KEY;
    let group = groups.get(key);
    if (!group) {
      group = { key, owner: task.owner, working: [], paused: [], waiting: [], next: [], done: [] };
      groups.set(key, group);
    }
    bucketOf(group, task.stage).push(task);
  }
  for (const group of groups.values()) {
    group.working.sort(oldestMoveFirst);
    group.paused.sort(newestMoveFirst);
    group.waiting.sort(newestMoveFirst);
    group.next.sort(queueOrder);
    group.done.sort(newestMoveFirst);
  }
  return [...groups.values()].sort(byOwnerName);
}

/** The by-stage view's order: what is happening now first, the server's
 *  own board order (Backend, 28 October 2026). */
export const BOARD_STAGE_ORDER: readonly SpaceTaskStage[] = ['working', 'paused', 'waiting', 'queued', 'done'];

/** One stage's tasks, for the by-stage view. */
export interface StageGroup {
  stage: SpaceTaskStage;
  tasks: SpaceTask[];
}

/**
 * The board by stage, in the board's order, leaving out a stage with no
 * tasks. Inside a stage: the queue by owner, then each owner's order; Working
 * longest-running first; Paused, Waiting and Done newest move first.
 */
export function groupByStage(tasks: readonly SpaceTask[]): StageGroup[] {
  return BOARD_STAGE_ORDER.map((stage) => {
    const rows = tasks.filter((task) => task.stage === stage);
    rows.sort(stage === 'queued' ? queueByOwner : stage === 'working' ? oldestMoveFirst : newestMoveFirst);
    return { stage, tasks: rows };
  }).filter((group) => group.tasks.length > 0);
}

/**
 * The line under a task's title: who it waits on or why it is paused, then
 * its thread. "Waiting on Stay · A or B for the header", "Switched to the
 * failed-answer fix · Task board". `null` when there is nothing to say.
 */
export function taskNote(task: SpaceTask): string | null {
  const note = task.stage_note?.trim() || null;
  if (task.stage !== 'waiting' || !task.waiting_on) return note;
  const waiting = `Waiting on ${task.waiting_on.name}`;
  return note ? `${waiting} · ${note}` : waiting;
}

/** "1 working · 3 next · 1 waiting": a group's head line. */
export function personSummary(group: PersonGroup): string {
  const words = [
    group.working.length > 0 ? `${group.working.length} working` : 'Nothing in progress',
    group.paused.length > 0 ? `${group.paused.length} paused` : null,
    group.waiting.length > 0 ? `${group.waiting.length} waiting` : null,
    group.next.length > 0 ? `${group.next.length} next` : null,
  ];
  return words.filter(Boolean).join(' · ');
}

/** More than one task in progress for one person: the board says so, and
 *  changes nothing (Backend and Frontend, 28 October 2026: no automatic pause). */
export function overCommitted(group: Pick<PersonGroup, 'working'>): boolean {
  return group.working.length > 1;
}

/** A group's open tasks, in reading order: what the person's block lists
 *  before the done fold. */
export function openTasks(group: PersonGroup): SpaceTask[] {
  return [...group.working, ...group.paused, ...group.waiting, ...group.next];
}

/** A task's thread, inside the app. */
export function taskThreadHref(thread: NonNullable<SpaceTask['thread']>): string {
  return `/channels/${encodeURIComponent(thread.uuid)}`;
}

function bucketOf(group: PersonGroup, stage: SpaceTaskStage): SpaceTask[] {
  switch (stage) {
    case 'working':
      return group.working;
    case 'paused':
      return group.paused;
    case 'waiting':
      return group.waiting;
    case 'done':
      return group.done;
    case 'queued':
      return group.next;
  }
}

const movedAt = (task: SpaceTask): number => Date.parse(task.stage_changed_at) || 0;

function oldestMoveFirst(a: SpaceTask, b: SpaceTask): number {
  return movedAt(a) - movedAt(b) || a.uuid.localeCompare(b.uuid);
}

function newestMoveFirst(a: SpaceTask, b: SpaceTask): number {
  return movedAt(b) - movedAt(a) || a.uuid.localeCompare(b.uuid);
}

function queueOrder(a: SpaceTask, b: SpaceTask): number {
  return a.position - b.position || a.created_at.localeCompare(b.created_at) || a.uuid.localeCompare(b.uuid);
}

function ownerName(owner: SpaceTaskPerson | null): string {
  return owner?.name ?? '';
}

function compareNames(a: SpaceTaskPerson | null, b: SpaceTaskPerson | null): number {
  // Nobody's tasks go last, under every named person.
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return ownerName(a).localeCompare(ownerName(b), undefined, { sensitivity: 'base' }) || a.uuid.localeCompare(b.uuid);
}

function byOwnerName(a: PersonGroup, b: PersonGroup): number {
  return compareNames(a.owner, b.owner);
}

function queueByOwner(a: SpaceTask, b: SpaceTask): number {
  return compareNames(a.owner, b.owner) || queueOrder(a, b);
}
