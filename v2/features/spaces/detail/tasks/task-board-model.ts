import type { SpaceTask, SpaceTaskPerson, SpaceTaskStage, ThreadStatusValue } from '@/types/collab';

/**
 * task-board-model — what a space's task board shows (thread 7aa0c6d8). Pure,
 * so every rule below is a unit test.
 *
 * STAY'S B (29 October 2026, 00:45Z: "B but cleaner and better"): one column
 * per stage, what is happening now first: Working, Paused, Waiting, Queued.
 * Done is kept for 14 days and folds into a thin strip at the board's right
 * edge until it is opened. A filter narrows the board to one owner, so "what
 * is Backend doing" is one choice.
 *
 * THE STAGE DOT BORROWS THE THREAD STATUS (techlead, 28 October 2026: no new
 * colours). Queued, Working and Done are the thread's own; Paused takes On
 * Hold's slate and Waiting takes Needs Action's amber, the two statuses they
 * mean. On the board the colour is only the small dot in a column's head.
 */

export const TASK_STAGES: readonly SpaceTaskStage[] = ['queued', 'working', 'paused', 'waiting', 'done'];

export const TASK_STAGE_LABELS: Readonly<Record<SpaceTaskStage, string>> = {
  queued: 'Queued',
  working: 'Working',
  paused: 'Paused',
  waiting: 'Waiting',
  done: 'Done',
};

/** The thread status whose dot each stage wears. */
export const TASK_STAGE_TONE: Readonly<Record<SpaceTaskStage, ThreadStatusValue>> = {
  queued: 'queued',
  working: 'working',
  paused: 'on_hold',
  waiting: 'needs_action',
  done: 'completed',
};

/** The board's columns, left to right: what is happening now first, the
 *  server's own board order (Backend, 28 October 2026). Done comes last,
 *  folded at the right edge. */
export const BOARD_STAGES: readonly SpaceTaskStage[] = ['working', 'paused', 'waiting', 'queued', 'done'];

/** How far back the board's done tasks reach: the server's default window. */
export const DONE_WINDOW_DAYS = 14;

/** Every stage's tasks, in each column's order, empty stages kept (a column
 *  never disappears). Working: longest-running first. Queued: by owner, then
 *  each owner's own order. Paused, Waiting and Done: newest move first. */
export function boardColumns(tasks: readonly SpaceTask[]): Record<SpaceTaskStage, SpaceTask[]> {
  const columns: Record<SpaceTaskStage, SpaceTask[]> = { queued: [], working: [], paused: [], waiting: [], done: [] };
  for (const task of tasks) columns[task.stage].push(task);
  columns.working.sort(oldestMoveFirst);
  columns.paused.sort(newestMoveFirst);
  columns.waiting.sort(newestMoveFirst);
  columns.queued.sort(queueByOwner);
  columns.done.sort(newestMoveFirst);
  return columns;
}

/** One choice in the owner filter. */
export interface OwnerOption {
  /** The owner's uuid, or {@link UNASSIGNED_KEY}. */
  key: string;
  name: string;
  isAgent: boolean;
  /** Their open tasks: everything but Done. */
  open: number;
}

export const UNASSIGNED_KEY = 'unassigned';

/** The owner filter's choices after "Everyone": people by name, then agents
 *  by name, then the tasks nobody has yet, each once. */
export function ownerOptions(tasks: readonly SpaceTask[]): OwnerOption[] {
  const options = new Map<string, OwnerOption>();
  for (const task of tasks) {
    const key = task.owner?.uuid ?? UNASSIGNED_KEY;
    let option = options.get(key);
    if (!option) {
      option = { key, name: task.owner?.name ?? 'Nobody yet', isAgent: task.owner?.is_agent ?? false, open: 0 };
      options.set(key, option);
    }
    if (task.stage !== 'done') option.open += 1;
  }
  return [...options.values()].sort((a, b) => {
    if (a.key === UNASSIGNED_KEY || b.key === UNASSIGNED_KEY) return a.key === UNASSIGNED_KEY ? 1 : -1;
    if (a.isAgent !== b.isAgent) return a.isAgent ? 1 : -1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.key.localeCompare(b.key);
  });
}

/** The board for one owner, or for everyone (`null`). */
export function filterByOwner(tasks: readonly SpaceTask[], ownerKey: string | null): readonly SpaceTask[] {
  if (ownerKey === null) return tasks;
  return tasks.filter((task) => (task.owner?.uuid ?? UNASSIGNED_KEY) === ownerKey);
}

/**
 * A card's second grey line: who it waits on, or why it is paused. "Waiting
 * on Stay", "Waiting on Stay · A or B for the header", "Switched to the
 * failed-answer fix". `null` for the other stages and when there is nothing
 * to say.
 */
export function taskNote(task: SpaceTask): string | null {
  const note = task.stage_note?.trim() || null;
  if (task.stage === 'waiting') {
    if (!task.waiting_on) return note;
    const waiting = `Waiting on ${task.waiting_on.name}`;
    return note ? `${waiting} · ${note}` : waiting;
  }
  return task.stage === 'paused' ? note : null;
}

/** A task's thread, inside the app. */
export function taskThreadHref(thread: NonNullable<SpaceTask['thread']>): string {
  return `/channels/${encodeURIComponent(thread.uuid)}`;
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

function compareOwners(a: SpaceTaskPerson | null, b: SpaceTaskPerson | null): number {
  // Nobody's tasks go last, under every named person.
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.uuid.localeCompare(b.uuid);
}

function queueByOwner(a: SpaceTask, b: SpaceTask): number {
  return compareOwners(a.owner, b.owner) || queueOrder(a, b);
}
