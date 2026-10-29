'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { Channel, SpaceTask, SpaceTaskMove, SpaceTaskStage } from '@/types/collab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useSheetSide } from '@/v2/features/cases/cited-by/use-sheet-side';
import { channelsQueries } from '@/v2/features/channels/queries';
import { channelDisplayName } from '@/v2/features/channels/thread-model';
import { ThreadStatusDot } from '@/v2/features/collab/kit/ThreadStatusChip';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { spacesQueries } from '../../queries';
import { TASK_STAGE_LABELS, TASK_STAGE_TONE, TASK_STAGES, taskThreadHref } from './task-board-model';
import { reorderedQueue, type QueueDirection } from './task-cache';
import { useCreateTask, useDeleteTask, useReorderTasks, useUpdateTask } from './task-mutations';
import {
  checkDraft,
  createPayload,
  draftFromTask,
  hasErrors,
  moveLine,
  serverFieldErrors,
  stageTakesNote,
  TASK_NOTE_MAX,
  TASK_TITLE_MAX,
  updatePayload,
  withStage,
  type TaskDraft,
  type TaskField,
  type TaskFieldErrors,
} from './task-sheet-model';

/** Which task the sheet shows: one on the board, or a new one. */
export type TaskSheetTarget = { kind: 'task'; taskUuid: string } | { kind: 'new' };

/**
 * TaskSheet — one task, opened from its card or note (the techlead's brief, 29
 * October 2026, on the board Stay approved on thread 7aa0c6d8, "Yes" at
 * 10:01Z). From the right on a computer, from the bottom on a phone, as the
 * case page's "See all" panel does (`useSheetSide`).
 *
 * The owner and editors change it: the title, who has it, the stage (Paused
 * asks why, Waiting asks who), its thread, its place in the queue, and Delete.
 * Save sends the changed fields in one PATCH. A viewer reads the same fields
 * as plain text. Every reader sees the history, newest first.
 *
 * The same sheet, empty, is New task: a title, Queued, owned by the viewer.
 */
export function TaskSheet({
  spaceUuid,
  tasks,
  target,
  open,
  onOpenChange,
  canEdit,
  rooms,
  now,
}: {
  spaceUuid: string;
  tasks: readonly SpaceTask[];
  /** Kept after the sheet closes, so it slides away with its content. */
  target: TaskSheetTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  /** The space shows its channels to this reader: the Thread field lists them. */
  rooms: boolean;
  now: number;
}) {
  const side = useSheetSide();
  const task = target?.kind === 'task' ? (tasks.find((row) => row.uuid === target.taskUuid) ?? null) : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        // A saved task opens to be read: no field takes focus, so a phone's
        // keyboard stays down and the title is not selected. New task starts
        // in its title.
        onOpenAutoFocus={(event) => {
          if (target?.kind === 'task') event.preventDefault();
        }}
        // Width and height per side: the primitive sizes with `data-[side=*]`
        // selectors, which outrank a bare utility.
        className={cn(
          'flex flex-col gap-0 p-0 outline-none',
          'data-[side=right]:w-full data-[side=right]:sm:max-w-md',
          'v2-safe-bottom data-[side=bottom]:max-h-[92svh] data-[side=bottom]:rounded-t-2xl',
        )}
      >
        {target === null ? null : target.kind === 'task' && !task ? (
          <GoneBody />
        ) : (
          <TaskSheetBody
            // A new task, or another task, starts from its own fields.
            key={task?.uuid ?? 'new'}
            spaceUuid={spaceUuid}
            tasks={tasks}
            task={task}
            canEdit={canEdit}
            rooms={rooms}
            now={now}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** The task went while the sheet was open: someone deleted it. */
function GoneBody() {
  return (
    <SheetHeader className="pr-12">
      <SheetTitle>This task is gone</SheetTitle>
      <SheetDescription>Someone deleted it.</SheetDescription>
    </SheetHeader>
  );
}

function TaskSheetBody({
  spaceUuid,
  tasks,
  task,
  canEdit,
  rooms,
  now,
  onDone,
}: {
  spaceUuid: string;
  tasks: readonly SpaceTask[];
  task: SpaceTask | null;
  canEdit: boolean;
  rooms: boolean;
  now: number;
  onDone: () => void;
}) {
  const uid = useId();
  const session = useV2Session();
  const viewerId = session.userId;
  const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(task, session.userUuid));
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const createTask = useCreateTask(spaceUuid);
  const updateTask = useUpdateTask(spaceUuid);
  const deleteTask = useDeleteTask(spaceUuid);
  const saving = createTask.isPending || updateTask.isPending;

  const membersQuery = useQuery({
    ...spacesQueries.allMembers(spaceUuid, { viewerId }),
    enabled: canEdit,
  });
  const members = useMemo(
    () => personOptions(membersQuery.data ?? [], [task?.owner ?? null, task?.waiting_on ?? null]),
    [membersQuery.data, task],
  );

  const change = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K], field: TaskField) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };
  const chooseStage = (stage: SpaceTaskStage) => {
    setDraft((current) => withStage(current, stage, task));
    setErrors((current) => ({ ...current, stage: undefined, stage_note: undefined, waiting_on: undefined }));
  };

  const changes = task ? updatePayload(draft, task) : null;
  const canSave = canEdit && !saving && (task === null || changes !== null);

  const showServerErrors = (error: unknown) => {
    // The global error channel toasts the server's message; a 422's field
    // errors also go under their fields.
    const apiError = extractApiError(error);
    if (apiError.status === 422) setErrors(serverFieldErrors(apiError.errors));
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const found = checkDraft(draft);
    if (hasErrors(found)) {
      setErrors(found);
      return;
    }
    if (task === null) {
      createTask.mutate(createPayload(draft), {
        onSuccess: () => {
          toast.success('Task added');
          onDone();
        },
        onError: showServerErrors,
      });
      return;
    }
    if (changes === null) return;
    updateTask.mutate(
      { taskUuid: task.uuid, payload: changes },
      { onSuccess: onDone, onError: showServerErrors },
    );
  };

  const confirmDelete = (event: React.MouseEvent) => {
    // The dialog stays open until the request settles (ArchiveRadarDialog's
    // reasoning): the button shows its pending state, a failure keeps it.
    event.preventDefault();
    if (!task) return;
    deleteTask.mutate(task.uuid, {
      onSuccess: () => {
        toast.success('Task deleted');
        setConfirmingDelete(false);
        onDone();
      },
    });
  };

  return (
    <>
      <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
        <SheetHeader className="pr-12">
          <SheetTitle>{task ? 'Task' : 'New task'}</SheetTitle>
          <SheetDescription>
            {task
              ? stageSince(task, now)
              : 'Give it a title. You can change the rest later.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6">
          <FieldBlock label="Title" htmlFor={`${uid}-title`} error={errors.title} errorId={`${uid}-title-error`}>
            {canEdit ? (
              <Input
                id={`${uid}-title`}
                value={draft.title}
                onChange={(event) => change('title', event.target.value, 'title')}
                maxLength={TASK_TITLE_MAX}
                placeholder="What needs doing?"
                autoComplete="off"
                aria-invalid={!!errors.title || undefined}
                aria-describedby={errors.title ? `${uid}-title-error` : undefined}
              />
            ) : (
              <p className="text-sm font-medium text-foreground">{task?.title}</p>
            )}
          </FieldBlock>

          <FieldBlock label="Owner" htmlFor={`${uid}-owner`} error={errors.owner} errorId={`${uid}-owner-error`}>
            {canEdit ? (
              <PersonSelect
                id={`${uid}-owner`}
                value={draft.owner}
                options={members}
                emptyLabel="Nobody yet"
                invalid={!!errors.owner}
                describedBy={errors.owner ? `${uid}-owner-error` : undefined}
                onChange={(value) => change('owner', value, 'owner')}
              />
            ) : (
              <p className="text-sm text-foreground">{task?.owner?.name ?? 'Nobody yet'}</p>
            )}
          </FieldBlock>

          <FieldBlock label="Stage" error={errors.stage} errorId={`${uid}-stage-error`}>
            {canEdit ? (
              <StagePicker value={draft.stage} onChange={chooseStage} />
            ) : (
              <p className="flex items-center gap-2 text-sm text-foreground">
                <ThreadStatusDot value={TASK_STAGE_TONE[draft.stage]} />
                {TASK_STAGE_LABELS[draft.stage]}
              </p>
            )}
          </FieldBlock>

          {draft.stage === 'waiting' ? (
            <FieldBlock
              label="Waiting on"
              htmlFor={`${uid}-waiting`}
              error={errors.waiting_on}
              errorId={`${uid}-waiting-error`}
            >
              {canEdit ? (
                <PersonSelect
                  id={`${uid}-waiting`}
                  value={draft.waitingOn}
                  options={members}
                  emptyLabel={null}
                  placeholder="Choose a person"
                  invalid={!!errors.waiting_on}
                  describedBy={errors.waiting_on ? `${uid}-waiting-error` : undefined}
                  onChange={(value) => change('waitingOn', value, 'waiting_on')}
                />
              ) : (
                <p className="text-sm text-foreground">{task?.waiting_on?.name ?? 'Nobody named'}</p>
              )}
            </FieldBlock>
          ) : null}

          {stageTakesNote(draft.stage) && (canEdit || draft.stageNote) ? (
            <FieldBlock
              label={draft.stage === 'paused' ? 'Why is it paused?' : 'Note (optional)'}
              htmlFor={`${uid}-note`}
              error={errors.stage_note}
              errorId={`${uid}-note-error`}
            >
              {canEdit ? (
                <Input
                  id={`${uid}-note`}
                  value={draft.stageNote}
                  onChange={(event) => change('stageNote', event.target.value, 'stage_note')}
                  maxLength={TASK_NOTE_MAX}
                  placeholder={draft.stage === 'paused' ? 'Switched to the failed-answer fix' : 'A or B for the header'}
                  autoComplete="off"
                  aria-invalid={!!errors.stage_note || undefined}
                  aria-describedby={errors.stage_note ? `${uid}-note-error` : undefined}
                />
              ) : (
                <p className="text-sm text-foreground">{draft.stageNote}</p>
              )}
            </FieldBlock>
          ) : null}

          <FieldBlock label="Thread" htmlFor={`${uid}-thread`} error={errors.thread} errorId={`${uid}-thread-error`}>
            {canEdit && rooms ? (
              <ThreadSelect
                id={`${uid}-thread`}
                spaceUuid={spaceUuid}
                value={draft.thread}
                current={task?.thread ?? null}
                invalid={!!errors.thread}
                describedBy={errors.thread ? `${uid}-thread-error` : undefined}
                onChange={(value) => change('thread', value, 'thread')}
              />
            ) : (
              <p className="text-sm text-foreground">{task?.thread?.name ?? 'No thread'}</p>
            )}
            {task?.thread && draft.thread === task.thread.uuid ? (
              <Link
                href={taskThreadHref(task.thread)}
                className={cn('inline-flex w-fit items-center gap-1 rounded-sm text-xs text-primary hover:underline', FOCUS_RING)}
              >
                Open the thread
                <ExternalLink aria-hidden className="size-3" />
              </Link>
            ) : null}
          </FieldBlock>

          {task && canEdit && task.stage === 'queued' ? <QueueOrder spaceUuid={spaceUuid} tasks={tasks} task={task} /> : null}

          {task ? <History spaceUuid={spaceUuid} taskUuid={task.uuid} now={now} /> : null}
        </div>

        {canEdit ? (
          <SheetFooter className="flex-row items-center border-t border-border">
            {task ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
              >
                <Trash2 aria-hidden className="size-4" />
                Delete
              </Button>
            ) : null}
            <Button type="submit" className="ml-auto gap-1.5" disabled={!canSave}>
              {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              {task ? 'Save' : 'Add task'}
            </Button>
          </SheetFooter>
        ) : null}
      </form>

      {task && canEdit ? (
        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this task?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{task.title}&rdquo; leaves the board for everyone in the space.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={deleteTask.isPending}>
                {deleteTask.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

function FieldBlock({
  label,
  htmlFor,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      ) : (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      )}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The five stages, each with its thread-status dot. Gold marks the chosen one. */
function StagePicker({ value, onChange }: { value: SpaceTaskStage; onChange: (stage: SpaceTaskStage) => void }) {
  return (
    <div role="radiogroup" aria-label="Stage" className="flex flex-wrap gap-1.5">
      {TASK_STAGES.map((stage) => {
        const selected = stage === value;
        return (
          <button
            key={stage}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(stage)}
            className={cn(
              'v2-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
              selected
                ? 'border-primary font-medium text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <ThreadStatusDot value={TASK_STAGE_TONE[stage]} />
            {TASK_STAGE_LABELS[stage]}
          </button>
        );
      })}
    </div>
  );
}

interface PersonOption {
  uuid: string;
  name: string;
}

/** Radix Select refuses an empty value, so "nobody" has its own. */
const NONE = '__none__';

function PersonSelect({
  id,
  value,
  options,
  emptyLabel,
  placeholder,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  value: string | null;
  options: readonly PersonOption[];
  /** The "nobody" choice's words, or `null` for none. */
  emptyLabel: string | null;
  placeholder?: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <Select value={value ?? (emptyLabel ? NONE : '')} onValueChange={(next) => onChange(next === NONE ? null : next)}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel ? <SelectItem value={NONE}>{emptyLabel}</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.uuid} value={option.uuid}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The space's channels and threads that every member can read (the server's
 * rule for a task's thread), from the two reads the rail and the lobby
 * already keep. The task's own thread stays a choice even when neither list
 * has it.
 */
function ThreadSelect({
  id,
  spaceUuid,
  value,
  current,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  spaceUuid: string;
  value: string | null;
  current: SpaceTask['thread'];
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string | null) => void;
}) {
  const { userId: viewerId } = useV2Session();
  // The rail's own entry (`CollabFrame`, 50 a page), so the sheet reads nothing new.
  const channels = useQuery(channelsQueries.bySpace({ spaceUuid, viewerId, per_page: 50 }));
  const threads = useQuery(channelsQueries.threadsBySpace({ spaceUuid, viewerId, per_page: 50 }));
  const options = useMemo(
    () => roomOptions([...(channels.data?.data ?? []), ...(threads.data?.data ?? [])], current),
    [channels.data, threads.data, current],
  );
  return (
    <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No thread</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.uuid} value={option.uuid}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Move up and Move down in the owner's queue (or in the queue of tasks nobody
 * has). Each sends the owner's whole open list in the new order; the Queued
 * column moves at once and goes back if the server refuses.
 */
function QueueOrder({ spaceUuid, tasks, task }: { spaceUuid: string; tasks: readonly SpaceTask[]; task: SpaceTask }) {
  const reorder = useReorderTasks(spaceUuid);
  const up = reorderedQueue(tasks, task.uuid, 'up');
  const down = reorderedQueue(tasks, task.uuid, 'down');
  const move = (direction: QueueDirection) => {
    const payload = direction === 'up' ? up : down;
    if (payload) reorder.mutate(payload);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Queue order{task.owner ? ` for ${task.owner.name}` : ', tasks nobody has'}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!up || reorder.isPending}
          onClick={() => move('up')}
        >
          <ArrowUp aria-hidden className="size-3.5" />
          Move up
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!down || reorder.isPending}
          onClick={() => move('down')}
        >
          <ArrowDown aria-hidden className="size-3.5" />
          Move down
        </Button>
      </div>
    </div>
  );
}

/** Every move of the task, newest first, with who made it and when. */
function History({ spaceUuid, taskUuid, now }: { spaceUuid: string; taskUuid: string; now: number }) {
  const { userId: viewerId } = useV2Session();
  const query = useQuery(spacesQueries.taskMoves(spaceUuid, taskUuid, { viewerId }));
  const moves = query.data?.data ?? NO_MOVES;
  return (
    <section aria-label="History" className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">History</h3>
      {query.isPending ? (
        <div className="flex flex-col gap-3" aria-hidden>
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : query.isError && moves.length === 0 ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>The history did not load.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : moves.length === 0 ? (
        <p className="text-sm text-muted-foreground">No moves yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {moves.map((move, index) => (
            <MoveRow key={`${move.at}-${index}`} move={move} now={now} />
          ))}
        </ol>
      )}
    </section>
  );
}

function MoveRow({ move, now }: { move: SpaceTaskMove; now: number }) {
  const note = move.note?.trim();
  return (
    <li className="flex flex-col gap-0.5">
      <p className="text-sm leading-snug text-foreground">
        {moveLine(move)}
        <span className="text-muted-foreground"> · {formatRelativeTime(move.at, now) || 'now'}</span>
      </p>
      {note || move.via === 'agent' ? (
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {move.via === 'agent' ? (
            <span className="shrink-0 rounded-md bg-secondary px-1 py-px text-[10px] font-medium">Agent</span>
          ) : null}
          {note ? <span className="min-w-0">{note}</span> : null}
        </p>
      ) : null}
    </li>
  );
}

/** The space's active members by name, plus anyone already on the task who
 *  is not in that list (a person who left keeps their place until changed). */
function personOptions(
  members: readonly { user: { uuid: string; name: string }; is_active: boolean; is_pending: boolean }[],
  onTask: readonly ({ uuid: string; name: string } | null)[],
): PersonOption[] {
  const options = new Map<string, PersonOption>();
  for (const member of members) {
    if (!member.is_active || member.is_pending) continue;
    options.set(member.user.uuid, { uuid: member.user.uuid, name: member.user.name });
  }
  for (const person of onTask) {
    if (person && !options.has(person.uuid)) options.set(person.uuid, { uuid: person.uuid, name: person.name });
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** The rooms a task may point at: open to the whole space, each once, with
 *  the task's own thread kept. */
function roomOptions(rooms: readonly Channel[], current: SpaceTask['thread']): PersonOption[] {
  const options = new Map<string, PersonOption>();
  for (const room of rooms) {
    if (room.visibility !== 'space_public' || options.has(room.uuid)) continue;
    options.set(room.uuid, { uuid: room.uuid, name: channelDisplayName(room) });
  }
  if (current && !options.has(current.uuid)) options.set(current.uuid, { uuid: current.uuid, name: current.name });
  return [...options.values()];
}

/** The sheet's subtitle: "Waiting for 12m", or "Queued just now" inside the
 *  first minute (the local run read "Queued for now"). */
function stageSince(task: SpaceTask, now: number): string {
  // The helper says "now" inside the first minute, and "" before the clock is read.
  const time = formatRelativeTime(task.stage_changed_at, now);
  return time && time !== 'now' ? `${TASK_STAGE_LABELS[task.stage]} for ${time}` : `${TASK_STAGE_LABELS[task.stage]} just now`;
}

const NO_MOVES: readonly SpaceTaskMove[] = [];
