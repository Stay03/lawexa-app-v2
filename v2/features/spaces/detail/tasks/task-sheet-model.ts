import type {
  CreateSpaceTaskPayload,
  Member,
  SpaceTask,
  SpaceTaskMove,
  SpaceTaskStage,
  SpaceTaskWritePayload,
} from '@/types/collab';
import { contentRoleOf } from '@/v2/features/collab/membership/content-role';
import { TASK_STAGE_LABELS } from './task-board-model';

/**
 * task-sheet-model — what the task sheet edits and what it sends (the
 * techlead's brief, 29 October 2026: the sheet, New task, reorder and live
 * updates on the board Stay approved on thread 7aa0c6d8, "Yes" at 10:01Z).
 * Pure, so the checks and the words are unit tests.
 *
 * The checks mirror the server's (Backend's task-board branch 439e6020): a
 * title of at most 200 characters, a note of at most 140, a reason when
 * paused, a person when waiting. The server checks again and its 422 field
 * errors show under the same fields, keyed by the same names.
 */

export const TASK_TITLE_MAX = 200;
export const TASK_NOTE_MAX = 140;

/** The sheet's fields while they are edited. People and the thread by uuid. */
export interface TaskDraft {
  title: string;
  stage: SpaceTaskStage;
  /** The reason when paused, the optional note when waiting. */
  stageNote: string;
  waitingOn: string | null;
  owner: string | null;
  thread: string | null;
}

/** The server's field names: its 422 errors and the sheet's checks share them. */
export type TaskField = 'title' | 'stage' | 'stage_note' | 'waiting_on' | 'owner' | 'thread';

export type TaskFieldErrors = Partial<Record<TaskField, string>>;

/** A stage that shows the note field. */
export function stageTakesNote(stage: SpaceTaskStage): boolean {
  return stage === 'paused' || stage === 'waiting';
}

/** The sheet's starting fields: the task as it is, or a new task in Queued,
 *  owned by `defaultOwner` (the viewer, when they are a member). */
export function draftFromTask(task: SpaceTask | null, defaultOwner: string | null): TaskDraft {
  if (!task) {
    return { title: '', stage: 'queued', stageNote: '', waitingOn: null, owner: defaultOwner, thread: null };
  }
  return {
    title: task.title,
    stage: task.stage,
    stageNote: task.stage_note ?? '',
    waitingOn: task.waiting_on?.uuid ?? null,
    owner: task.owner?.uuid ?? null,
    thread: task.thread?.uuid ?? null,
  };
}

/**
 * The draft after a stage is chosen. A note belongs to one stage (the
 * techlead's review, 29 October 2026): a waiting note must not become the
 * pause reason, so a new stage starts with an empty note. Going back to the
 * task's saved stage brings its saved note back; choosing the stage already
 * chosen changes nothing.
 */
export function withStage(draft: TaskDraft, stage: SpaceTaskStage, task: SpaceTask | null): TaskDraft {
  if (stage === draft.stage) return draft;
  const stageNote = task && stage === task.stage ? (task.stage_note ?? '') : '';
  return { ...draft, stage, stageNote };
}

/** What is wrong with the fields, in the words shown under each. Empty when
 *  the draft may be saved. */
export function checkDraft(draft: TaskDraft): TaskFieldErrors {
  const errors: TaskFieldErrors = {};
  const title = draft.title.trim();
  if (!title) errors.title = 'Give the task a title.';
  else if (title.length > TASK_TITLE_MAX) errors.title = `Keep the title to ${TASK_TITLE_MAX} characters.`;
  const note = draft.stageNote.trim();
  if (draft.stage === 'paused' && !note) errors.stage_note = 'Say why it is paused.';
  else if (stageTakesNote(draft.stage) && note.length > TASK_NOTE_MAX) {
    errors.stage_note = `Keep the note to ${TASK_NOTE_MAX} characters.`;
  }
  if (draft.stage === 'waiting' && !draft.waitingOn) errors.waiting_on = 'Choose who it is waiting on.';
  return errors;
}

export function hasErrors(errors: TaskFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** The first server message for each field the sheet shows, from a 422's
 *  `errors`. Fields the sheet does not know are left for the toast. */
export function serverFieldErrors(errors: Record<string, string[]> | null): TaskFieldErrors {
  const result: TaskFieldErrors = {};
  if (!errors) return result;
  for (const field of TASK_FIELDS) {
    const message = errors[field]?.[0];
    if (message) result[field] = message;
  }
  return result;
}

const TASK_FIELDS: readonly TaskField[] = ['title', 'stage', 'stage_note', 'waiting_on', 'owner', 'thread'];

/** A new task's body: the title, the stage, and only the fields that say
 *  something. */
export function createPayload(draft: TaskDraft): CreateSpaceTaskPayload {
  const note = draft.stageNote.trim();
  return {
    title: draft.title.trim(),
    stage: draft.stage,
    ...(stageTakesNote(draft.stage) && note ? { stage_note: note } : {}),
    ...(draft.stage === 'waiting' && draft.waitingOn ? { waiting_on: draft.waitingOn } : {}),
    ...(draft.owner ? { owner: draft.owner } : {}),
    ...(draft.thread ? { thread: draft.thread } : {}),
  };
}

/**
 * One PATCH with only the fields that changed. The note and the person waited
 * on go only while the stage shows them; leaving Paused or Waiting clears both
 * on the server, so nothing is sent for them then. `null` when nothing
 * changed.
 */
export function updatePayload(draft: TaskDraft, task: SpaceTask): SpaceTaskWritePayload | null {
  const payload: SpaceTaskWritePayload = {};
  const title = draft.title.trim();
  if (title !== task.title) payload.title = title;
  const stageChanged = draft.stage !== task.stage;
  if (stageChanged) payload.stage = draft.stage;
  if (stageTakesNote(draft.stage)) {
    const note = draft.stageNote.trim() || null;
    if (stageChanged || note !== (task.stage_note ?? null)) payload.stage_note = note;
  }
  if (draft.stage === 'waiting' && (stageChanged || draft.waitingOn !== (task.waiting_on?.uuid ?? null))) {
    payload.waiting_on = draft.waitingOn;
  }
  if (draft.owner !== (task.owner?.uuid ?? null)) payload.owner = draft.owner;
  if (draft.thread !== (task.thread?.uuid ?? null)) payload.thread = draft.thread;
  return Object.keys(payload).length > 0 ? payload : null;
}

/**
 * One line of a task's history, in plain words. "Backend Claude moved it from
 * Queued to Working", "Ada Obi gave it to Backend Claude", "Stay added it to
 * Queued". The time and the Agent tag sit beside the line; the note goes
 * under it. A move carries no `waiting_on`, so a move to Waiting cannot name
 * the person; the note, when there is one, says more.
 */
export function moveLine(move: SpaceTaskMove): string {
  const by = move.by?.name ?? 'Lawexa';
  const to = stageWithPerson(move);
  if (move.from === null) {
    const owner = move.to_owner ? ` for ${move.to_owner.name}` : '';
    return `${by} added it to ${to}${owner}`;
  }
  const parts: string[] = [];
  if (move.from !== move.to) {
    parts.push(`moved it from ${TASK_STAGE_LABELS[move.from]} to ${to}`);
  }
  const ownerChanged = (move.from_owner?.uuid ?? null) !== (move.to_owner?.uuid ?? null);
  if (ownerChanged) {
    if (!move.to_owner) parts.push('made it nobody’s');
    else if (move.by && move.to_owner.uuid === move.by.uuid) parts.push('took it');
    else parts.push(`gave it to ${move.to_owner.name}`);
  }
  if (parts.length === 0) parts.push(`changed it in ${TASK_STAGE_LABELS[move.to]}`);
  return `${by} ${parts.join(' and ')}`;
}

/** "Waiting on Stay" for a move into Waiting that names the person (the
 *  techlead's decision on Tester's note, 29 October 2026); the stage alone
 *  otherwise. */
function stageWithPerson(move: SpaceTaskMove): string {
  const stage = TASK_STAGE_LABELS[move.to];
  return move.to === 'waiting' && move.waiting_on ? `${stage} on ${move.waiting_on.name}` : stage;
}

/** One choice in the sheet's Owner or Waiting on list. */
export interface PersonOption {
  uuid: string;
  name: string;
}

/**
 * The people the sheet offers, by name: the space's active members, plus
 * anyone already on the task who is not among them (a person who left, or a
 * viewer who owned a task before the rule below, keeps their place until
 * changed).
 *
 * `movers`: only the members who may move tasks, the space's owners and
 * editors. The Owner list takes only them (the techlead's decision on
 * Tester's note, 29 October 2026: a viewer cannot move the task they would
 * own); anyone may be waited on.
 */
export function personOptions(
  members: readonly Pick<Member, 'user' | 'role' | 'content_role' | 'is_active' | 'is_pending'>[],
  keep: readonly ({ uuid: string; name: string } | null)[],
  { movers }: { movers: boolean },
): PersonOption[] {
  const options = new Map<string, PersonOption>();
  for (const member of members) {
    if (!member.is_active || member.is_pending) continue;
    if (movers && contentRoleOf(member) === 'viewer') continue;
    options.set(member.user.uuid, { uuid: member.user.uuid, name: member.user.name });
  }
  for (const person of keep) {
    if (person && !options.has(person.uuid)) options.set(person.uuid, { uuid: person.uuid, name: person.name });
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** One line in a phone's own picker (a native `<select>`). */
export interface PickerChoice {
  /** What the field sends: a uuid, or '' for the empty choice. */
  value: string;
  /** What the reader sees: a name, never a uuid. */
  label: string;
  /** The placeholder line: shown while nothing is picked, not pickable. */
  disabled: boolean;
}

/**
 * The lines of a phone's own picker for Owner, Waiting on or Thread (Arthur,
 * 29 October 2026, 21:13Z, thread 7aa0c6d8: the list opened under the
 * keyboard and off the screen). The same choices as the computer's list:
 * first the empty choice ("Nobody yet", "No thread"), or, where there is
 * none, the placeholder ("Choose a person"); then each option by its name,
 * sending its uuid.
 */
export function pickerChoices(
  options: readonly PersonOption[],
  emptyLabel: string | null,
  placeholder?: string,
): PickerChoice[] {
  const first: PickerChoice =
    emptyLabel !== null
      ? { value: '', label: emptyLabel, disabled: false }
      : { value: '', label: placeholder ?? '', disabled: true };
  return [first, ...options.map((option) => ({ value: option.uuid, label: option.name, disabled: false }))];
}
