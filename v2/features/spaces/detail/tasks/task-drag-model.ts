import type { SpaceTask, SpaceTaskPerson, SpaceTaskStage, SpaceTaskWritePayload } from '@/types/collab';
import { BOARD_STAGES, TASK_STAGE_LABELS } from './task-board-model';
import { draftFromTask, updatePayload, withStage, type TaskDraft } from './task-sheet-model';

/**
 * task-drag-model — dragging a card to another column changes its stage
 * (Arthur, 30 October 2026, 18:38Z, thread 7aa0c6d8; the plan d589d99c the
 * techlead approved with the task box, 11aefe48). Pure, so every rule is a
 * unit test; the board only wires it to dnd-kit.
 *
 * A drop on Paused or Waiting asks first (the reason, or the person waited
 * on), with the task sheet's own rules (`withStage`, `checkDraft`,
 * `updatePayload`), so the sheet, the task box and a drop can never ask
 * different things. Any other stage moves at once.
 */

/** Where a card can be dropped: a column, a phone's stage tab, or Done's folded strip. */
export type DropPlace = 'column' | 'tab' | 'strip';

export function dropId(place: DropPlace, stage: SpaceTaskStage): string {
  return `${place}:${stage}`;
}

/** The stage a drop target stands for, or `null` for anything else. */
export function stageOfDrop(id: string | number | null | undefined): SpaceTaskStage | null {
  if (typeof id !== 'string') return null;
  const [place, stage] = id.split(':');
  if (place !== 'column' && place !== 'tab' && place !== 'strip') return null;
  return (BOARD_STAGES as readonly string[]).includes(stage) ? (stage as SpaceTaskStage) : null;
}

/** What a drop does: nothing, ask first, or move at once with this PATCH. */
export type DropOutcome =
  | { kind: 'none' }
  | { kind: 'ask'; stage: 'paused' | 'waiting'; draft: TaskDraft }
  | { kind: 'move'; stage: SpaceTaskStage; payload: SpaceTaskWritePayload };

export function dropOutcome(task: SpaceTask, stage: SpaceTaskStage): DropOutcome {
  if (stage === task.stage) return { kind: 'none' };
  const draft = withStage(draftFromTask(task, null), stage, task);
  if (stage === 'paused' || stage === 'waiting') return { kind: 'ask', stage, draft };
  const payload = updatePayload(draft, task);
  return payload ? { kind: 'move', stage, payload } : { kind: 'none' };
}

/**
 * The card as the board shows it the moment it is dropped, before the server
 * answers: the new stage, its note and the person waited on, and "now" as the
 * time it moved. Leaving Paused or Waiting clears both, as the server does.
 * The server's answer replaces it; an error puts the task back as it was.
 */
export function movedTask(
  task: SpaceTask,
  payload: SpaceTaskWritePayload,
  at: string,
  waitingOn: SpaceTaskPerson | null = null,
): SpaceTask {
  const stage = payload.stage ?? task.stage;
  const keepsNote = stage === 'paused' || stage === 'waiting';
  return {
    ...task,
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    stage,
    stage_note: keepsNote ? (payload.stage_note !== undefined ? payload.stage_note : task.stage_note) : null,
    waiting_on: stage === 'waiting' ? (waitingOn ?? task.waiting_on) : null,
    stage_changed_at: payload.stage !== undefined && payload.stage !== task.stage ? at : task.stage_changed_at,
  };
}

/**
 * Whether someone else changed or deleted the dragged card while it was in
 * the air (the board follows `.task.changed`). Then the drop does nothing and
 * says why, so a drop never overwrites a move the reader never saw.
 */
export function changedWhileDragged(atStart: SpaceTask, now: SpaceTask | undefined): boolean {
  if (!now) return true;
  return now.stage !== atStart.stage || now.stage_changed_at !== atStart.stage_changed_at || now.title !== atStart.title;
}

/** The board's columns in reading order, for the keyboard: Left and Right move one column. */
export function stageBeside(stage: SpaceTaskStage, step: -1 | 1): SpaceTaskStage {
  const index = BOARD_STAGES.indexOf(stage);
  const next = Math.min(BOARD_STAGES.length - 1, Math.max(0, index + step));
  return BOARD_STAGES[next];
}

/** What a screen reader hears through a drag (dnd-kit's announcements). */
export const DRAG_WORDS = {
  instructions:
    'To move a task to another stage, press Space to pick it up, Left or Right to choose the stage, Space to drop it, or Escape to put it back.',
  start: (title: string) => `Picked up “${title}”.`,
  over: (title: string, stage: SpaceTaskStage | null) =>
    stage ? `“${title}” is over ${TASK_STAGE_LABELS[stage]}.` : `“${title}” is not over a stage.`,
  end: (title: string, stage: SpaceTaskStage | null) =>
    stage ? `Dropped “${title}” in ${TASK_STAGE_LABELS[stage]}.` : `“${title}” was put back.`,
  cancel: (title: string) => `Put “${title}” back.`,
} as const;

/** Said when the dragged card moved under the reader's hand. */
export const MOVED_BY_SOMEONE_ELSE = 'Someone else just changed this task, so it stays where they put it.';

/** How long a finger holds a phone's note before it lifts (a shorter touch scrolls). */
export const HOLD_TO_DRAG_MS = 300;
/** How far a mouse moves before a drag starts, so a click still opens the task. */
export const POINTER_DRAG_DISTANCE = 8;
