'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, ListChecks, Plus, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { getInitials } from '@/lib/utils/collab';
import type { SpaceTask, SpaceTaskPerson, SpaceTaskStage, SpaceTaskWritePayload } from '@/types/collab';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { ThreadStatusDot } from '@/v2/features/collab/kit/ThreadStatusChip';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { SpaceContentErrorState, SpaceContentSkeleton } from '../content/states';
import { spacesQueries } from '../../queries';
import {
  BOARD_STAGES,
  boardColumns,
  DONE_WINDOW_DAYS,
  filterByOwner,
  ownerOptions,
  TASK_STAGE_LABELS,
  TASK_STAGE_TONE,
  taskNote,
  type OwnerOption,
} from './task-board-model';
import { TaskSheet, type TaskSheetTarget } from './TaskSheet';
import { TaskMoveDialog, type PendingMove } from './TaskMoveDialog';
import { taskCollision, useTaskBoardSensors } from './board-dnd';
import {
  DRAG_WORDS,
  MOVED_BY_SOMEONE_ELSE,
  changedWhileDragged,
  dropId,
  dropOutcome,
  movedTask,
  stageOfDrop,
} from './task-drag-model';
import { usePatchTask } from './task-mutations';
import { useTaskBoardLive } from './use-task-board-live';

/**
 * SpaceTasksPanel — the Tasks pill (thread 7aa0c6d8): who is doing what in
 * the space, from `GET /spaces/{uuid}/tasks`.
 *
 * STAY'S B (29 October 2026, 00:45Z: "B but cleaner and better"), drawn to
 * the techlead's brief:
 * - One column per stage: Working, Paused, Waiting, Queued. A column's head
 *   is its name and count after the stage's small dot, and the column is a
 *   lane in a faint wash of that colour (Stay, 02:49Z). No bars, no limits.
 * - A card is the title (two lines at most), then one grey line: the owner's
 *   initials and name, a grey "Agent" tag for an agent, and the time in the
 *   stage at the right. Paused adds the reason, Waiting "Waiting on Stay", as
 *   a second grey line. No badges or chips.
 * - Done keeps 14 days and folds into a thin strip at the right edge; a
 *   click opens it as a column.
 * - "Everyone" narrows the board to one owner.
 * - Gold marks only what is chosen: the owner filter's tick, a phone's stage.
 * - A phone shows one column at a time: the stage switcher at the top, with
 *   counts, and a swipe moves between the columns.
 *
 * THE BOARD IS WORKED FROM HERE TOO (the techlead's brief after Stay's "Yes",
 * 29 October 2026, 10:01Z): a tap on a card or a note opens the task sheet;
 * the owner and editors (`canEdit`) get "New task" beside the owner filter;
 * and the board follows `.task.changed` on the space's channel, so a move by
 * anyone, person or agent, shows without a reload.
 *
 * A CARD DRAGS TO ANOTHER COLUMN (Arthur, 30 October 2026, 18:38Z; the plan
 * d589d99c): the owner and editors drag a card onto a column, or on a phone
 * hold a note and drop it on a stage tab. Paused and Waiting ask first
 * (`TaskMoveDialog`); the rest move at once and go back if the server
 * refuses (`usePatchTask`). The rules are `task-drag-model.ts`; the sensors
 * are `board-dnd.ts`.
 */
export function SpaceTasksPanel({
  spaceUuid,
  canEdit,
  rooms,
}: {
  spaceUuid: string;
  /** The owner or an editor of the space's content: may add, change and delete tasks. */
  canEdit: boolean;
  /** The space shows its channels to this reader: a task's Thread lists them. */
  rooms: boolean;
}) {
  const session = useV2Session();
  const eligible = collabAccessState(session) === 'eligible';
  const query = useQuery({
    ...spacesQueries.tasks(spaceUuid, { viewerId: session.userId }),
    enabled: eligible,
  });
  useTaskBoardLive(spaceUuid, session.userId, eligible);
  const tasks = query.data ?? NO_TASKS;
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());
  const [owner, setOwner] = useState<string | null>(null);
  const owners = useMemo(() => ownerOptions(tasks), [tasks]);
  const shown = useMemo(() => filterByOwner(tasks, owner), [tasks, owner]);
  const columns = useMemo(() => boardColumns(shown), [shown]);
  // The target stays after the sheet closes, so its content slides out with it.
  const [sheetTarget, setSheetTarget] = useState<TaskSheetTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = (target: TaskSheetTarget) => {
    setSheetTarget(target);
    setSheetOpen(true);
  };
  const openTask = (taskUuid: string) => openSheet({ kind: 'task', taskUuid });
  const newTask = canEdit ? () => openSheet({ kind: 'new' }) : null;

  // A drop: Paused and Waiting ask first, the rest move at once.
  const patch = usePatchTask(spaceUuid);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const moveTask = (task: SpaceTask, payload: SpaceTaskWritePayload, waitingOn: SpaceTaskPerson | null) => {
    patch.mutate({ task, payload, shown: movedTask(task, payload, new Date().toISOString(), waitingOn) });
  };
  const dropTask = (task: SpaceTask, stage: SpaceTaskStage) => {
    const outcome = dropOutcome(task, stage);
    if (outcome.kind === 'move') moveTask(task, outcome.payload, null);
    else if (outcome.kind === 'ask') setPending({ task, stage: outcome.stage, draft: outcome.draft });
  };
  const sheet = (
    <TaskSheet
      spaceUuid={spaceUuid}
      tasks={tasks}
      target={sheetTarget}
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      canEdit={canEdit}
      rooms={rooms}
      now={now}
    />
  );
  // A refusal the server explained (403) is worth its own sentence.
  const apiError = query.error ? extractApiError(query.error) : null;

  if (query.isPending) return <SpaceContentSkeleton />;
  if (query.isError && tasks.length === 0) {
    return (
      <SpaceContentErrorState
        tab="tasks"
        message={apiError?.status === 403 ? apiError.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (tasks.length === 0) {
    return (
      <>
        <CollabEmpty
          icon={ListChecks}
          title="No tasks in this space yet"
          description="A task shows who has it, what stage it is at and how long it has been there. People and agents move their own."
          action={newTask ? <NewTaskButton onClick={newTask} /> : undefined}
        />
        {sheet}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <OwnerFilter owners={owners} value={owner} onChange={setOwner} />
        {newTask ? <NewTaskButton onClick={newTask} /> : null}
      </div>
      {/* The board takes the page column's width, as every pill does (Arthur's
          C, 30 October 2026): nothing reaches past the header's margins. */}
      <Board
        columns={columns}
        tasks={tasks}
        now={now}
        canDrag={canEdit}
        onOpenTask={openTask}
        onDrop={dropTask}
      />
      {sheet}
      <TaskMoveDialog
        spaceUuid={spaceUuid}
        pending={pending}
        onCancel={() => setPending(null)}
        onMove={(move, payload, waitingOn) => {
          setPending(null);
          moveTask(move.task, payload, waitingOn);
        }}
      />
    </div>
  );
}

function NewTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={onClick}>
      <Plus aria-hidden className="size-3.5" />
      New task
    </Button>
  );
}

function OwnerFilter({
  owners,
  value,
  onChange,
}: {
  owners: readonly OwnerOption[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const chosen = owners.find((option) => option.key === value) ?? null;
  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
            {chosen ? chosen.name : 'Everyone'}
            <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <OwnerItem label="Everyone" selected={value === null} onSelect={() => onChange(null)} />
          <DropdownMenuSeparator />
          {owners.map((option) => (
            <OwnerItem
              key={option.key}
              label={option.name}
              agent={option.isAgent}
              open={option.open}
              selected={value === option.key}
              onSelect={() => onChange(option.key)}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function OwnerItem({
  label,
  agent = false,
  open,
  selected,
  onSelect,
}: {
  label: string;
  agent?: boolean;
  /** Their open tasks; absent on "Everyone". */
  open?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="gap-2">
      <Check aria-hidden className={cn('size-4 shrink-0 text-primary', !selected && 'invisible')} />
      <span className="min-w-0 truncate">{label}</span>
      {agent ? <AgentTag /> : null}
      {open !== undefined ? (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{open}</span>
      ) : null}
    </DropdownMenuItem>
  );
}

/**
 * The columns. On a computer, side by side, with Done as a strip at the
 * right edge until opened. On a phone, one column the width of the screen,
 * scroll-snapped, with the stage switcher above: a tap scrolls to that
 * column, a swipe moves the switcher.
 */
function Board({
  columns,
  tasks,
  now,
  canDrag,
  onOpenTask,
  onDrop,
}: {
  columns: Record<SpaceTaskStage, SpaceTask[]>;
  /** Every task, as the board has it now: a drop reads the card as it is at that moment. */
  tasks: readonly SpaceTask[];
  now: number;
  /** The owner and editors may drag; others only open tasks. */
  canDrag: boolean;
  onOpenTask: (taskUuid: string) => void;
  onDrop: (task: SpaceTask, stage: SpaceTaskStage) => void;
}) {
  const [doneOpen, setDoneOpen] = useState(false);
  const sensors = useTaskBoardSensors();
  // The card as it was when lifted: a change by someone else meanwhile cancels the drop.
  const [dragged, setDragged] = useState<SpaceTask | null>(null);
  const [phoneStage, setPhoneStage] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const showStage = (index: number) => {
    const element = track.current;
    if (!element) return;
    element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' });
  };
  const followSwipe = () => {
    const element = track.current;
    if (!element || element.clientWidth === 0) return;
    setPhoneStage(Math.round(element.scrollLeft / element.clientWidth));
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragged(tasks.find((task) => task.uuid === active.id) ?? null);
  };
  const onDragEnd = ({ over }: DragEndEvent) => {
    const start = dragged;
    setDragged(null);
    const stage = stageOfDrop(over?.id);
    if (!start || !stage || stage === start.stage) return;
    const current = tasks.find((task) => task.uuid === start.uuid);
    if (!current || changedWhileDragged(start, current)) {
      toast(MOVED_BY_SOMEONE_ELSE);
      return;
    }
    onDrop(current, stage);
    // A phone's drop on a stage tab follows the note to its new column.
    if (String(over?.id).startsWith('tab:')) showStage(BOARD_STAGES.indexOf(stage));
  };
  const titleOf = (id: string | number) => tasks.find((task) => task.uuid === id)?.title ?? 'The task';
  const announcements: Announcements = {
    onDragStart: ({ active }) => DRAG_WORDS.start(titleOf(active.id)),
    onDragOver: ({ active, over }) => DRAG_WORDS.over(titleOf(active.id), stageOfDrop(over?.id)),
    onDragEnd: ({ active, over }) => DRAG_WORDS.end(titleOf(active.id), stageOfDrop(over?.id)),
    onDragCancel: ({ active }) => DRAG_WORDS.cancel(titleOf(active.id)),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={taskCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragged(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: DRAG_WORDS.instructions } }}
    >
      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label="Stage" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:hidden">
          {BOARD_STAGES.map((stage, index) => (
            <PhoneStageTab
              key={stage}
              stage={stage}
              count={columns[stage].length}
              selected={index === phoneStage}
              droppable={canDrag}
              onSelect={() => showStage(index)}
            />
          ))}
        </div>

        <div
          ref={track}
          onScroll={followSwipe}
          className="flex items-start max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto md:gap-3"
        >
          {BOARD_STAGES.map((stage) =>
            stage === 'done' ? (
              <DoneColumn
                key={stage}
                tasks={columns.done}
                now={now}
                open={doneOpen}
                canDrag={canDrag}
                onToggle={() => setDoneOpen((value) => !value)}
                onOpenTask={onOpenTask}
              />
            ) : (
              <StageColumn
                key={stage}
                stage={stage}
                tasks={columns[stage]}
                now={now}
                canDrag={canDrag}
                onOpenTask={onOpenTask}
              />
            ),
          )}
        </div>
      </div>
      {/* The lifted card follows the pointer; its place in the column stays, faded. */}
      <DragOverlay dropAnimation={null}>
        {dragged ? <CardFace task={dragged} stage={dragged.stage} now={now} lifted /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/** A phone's stage tab: a tap shows that column, and a held note dropped on it moves there. */
function PhoneStageTab({
  stage,
  count,
  selected,
  droppable,
  onSelect,
}: {
  stage: SpaceTaskStage;
  count: number;
  selected: boolean;
  droppable: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId('tab', stage), disabled: !droppable });
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'v2-interactive relative inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors',
        selected ? 'font-medium text-primary' : 'text-muted-foreground',
        isOver && DROP_TARGET,
        FOCUS_RING,
      )}
    >
      <ThreadStatusDot value={TASK_STAGE_TONE[stage]} />
      {TASK_STAGE_LABELS[stage]}
      <span className="tabular-nums opacity-70">{count}</span>
      {selected ? <span aria-hidden className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
    </button>
  );
}

/** Where a lifted card would land: a soft gold ring, as the board marks only what is chosen in gold. */
const DROP_TARGET = 'ring-2 ring-inset ring-primary/45';

const COLUMN =
  'flex min-w-0 flex-col gap-2 rounded-2xl p-1.5 max-md:w-full max-md:shrink-0 max-md:snap-start md:flex-1';

/**
 * Each column is a lane in a faint wash of its stage's colour (Stay, 29
 * October 2026, 02:49Z: "some kind of low opacity thin back colour"), the
 * same hue as its dot at about a twentieth of its strength, so the lanes read
 * apart while the white cards on them stay the strongest thing on the board.
 */
const STAGE_LANE: Readonly<Record<SpaceTaskStage, string>> = {
  // A computer's lanes only: on a phone the notes carry the colour themselves.
  working: 'md:bg-blue-500/5 md:dark:bg-blue-400/8',
  paused: 'md:bg-slate-500/6 md:dark:bg-slate-400/8',
  waiting: 'md:bg-amber-500/6 md:dark:bg-amber-400/8',
  queued: 'md:bg-violet-500/5 md:dark:bg-violet-400/8',
  done: 'md:bg-emerald-500/5 md:dark:bg-emerald-400/8',
};

/**
 * A phone's sticky note (Stay, 29 October 2026, 04:18Z: "it should look like
 * stick it notes cleanly done"): the lane's tint, stronger, as the note's own
 * fill, the way Google Keep and FigJam colour a note rather than its column.
 * No tilt, no tape, no handwriting: a flat square note with a soft shadow.
 */
const NOTE_FILL: Readonly<Record<SpaceTaskStage, string>> = {
  working: 'max-md:bg-blue-100 max-md:dark:bg-blue-400/15',
  paused: 'max-md:bg-slate-100 max-md:dark:bg-slate-400/15',
  waiting: 'max-md:bg-amber-100 max-md:dark:bg-amber-400/15',
  queued: 'max-md:bg-violet-100 max-md:dark:bg-violet-400/15',
  done: 'max-md:bg-emerald-100 max-md:dark:bg-emerald-400/15',
};

function StageColumn({
  stage,
  tasks,
  now,
  canDrag,
  onOpenTask,
}: {
  stage: SpaceTaskStage;
  tasks: SpaceTask[];
  now: number;
  canDrag: boolean;
  onOpenTask: (taskUuid: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId('column', stage), disabled: !canDrag });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${TASK_STAGE_LABELS[stage]}, ${tasks.length}`}
      className={cn(COLUMN, STAGE_LANE[stage], isOver && DROP_TARGET)}
    >
      <ColumnHead stage={stage} count={tasks.length} />
      <CardList
        stage={stage}
        tasks={tasks}
        now={now}
        empty={EMPTY_WORDS[stage]}
        canDrag={canDrag}
        onOpenTask={onOpenTask}
      />
    </section>
  );
}

/** Done: a strip at a computer's right edge until opened; on a phone, a column like the rest. */
function DoneColumn({
  tasks,
  now,
  open,
  canDrag,
  onToggle,
  onOpenTask,
}: {
  tasks: SpaceTask[];
  now: number;
  open: boolean;
  canDrag: boolean;
  onToggle: () => void;
  onOpenTask: (taskUuid: string) => void;
}) {
  // The folded strip takes a drop too, so Done needs no opening first.
  const { setNodeRef: setStripRef, isOver: overStrip } = useDroppable({
    id: dropId('strip', 'done'),
    disabled: !canDrag || open,
  });
  const { setNodeRef: setColumnRef, isOver: overColumn } = useDroppable({
    id: dropId('column', 'done'),
    disabled: !canDrag,
  });
  return (
    <>
      <button
        ref={setStripRef}
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        aria-label={`Show Done, the last ${DONE_WINDOW_DAYS} days: ${tasks.length}`}
        className={cn(
          'v2-interactive hidden w-11 shrink-0 flex-col items-center gap-2 self-stretch rounded-2xl py-3 text-xs text-muted-foreground transition-colors hover:text-foreground',
          STAGE_LANE.done,
          !open && 'md:flex',
          overStrip && DROP_TARGET,
          FOCUS_RING,
        )}
      >
        <ThreadStatusDot value={TASK_STAGE_TONE.done} />
        <span className="font-medium [writing-mode:vertical-rl]">Done</span>
        <span className="tabular-nums">{tasks.length}</span>
      </button>
      <section
        ref={setColumnRef}
        aria-label={`Done, the last ${DONE_WINDOW_DAYS} days, ${tasks.length}`}
        className={cn(COLUMN, STAGE_LANE.done, !open && 'md:hidden', overColumn && DROP_TARGET)}
      >
        <ColumnHead
          stage="done"
          count={tasks.length}
          action={
            <button
              type="button"
              onClick={onToggle}
              aria-expanded
              aria-label="Fold Done away"
              className={cn('v2-interactive ml-auto hidden rounded-md p-1 text-muted-foreground hover:text-foreground md:inline-flex', FOCUS_RING)}
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          }
        />
        <CardList
          stage="done"
          tasks={tasks}
          now={now}
          empty={EMPTY_WORDS.done}
          canDrag={canDrag}
          onOpenTask={onOpenTask}
        />
      </section>
    </>
  );
}

function ColumnHead({ stage, count, action }: { stage: SpaceTaskStage; count: number; action?: ReactNode }) {
  // A phone names the column in the switcher above it.
  return (
    <div className="flex min-h-8 items-center gap-2 px-1 max-md:hidden">
      <ThreadStatusDot value={TASK_STAGE_TONE[stage]} />
      <h3 className="text-sm font-medium text-foreground">{TASK_STAGE_LABELS[stage]}</h3>
      <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
      {action}
    </div>
  );
}

function CardList({
  stage,
  tasks,
  now,
  empty,
  canDrag,
  onOpenTask,
}: {
  stage: SpaceTaskStage;
  tasks: SpaceTask[];
  now: number;
  empty: string;
  canDrag: boolean;
  onOpenTask: (taskUuid: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    // A phone lays the notes two to a row, as a sticky-note board does.
    <ul className="flex flex-col gap-2 max-md:grid max-md:grid-cols-2 max-md:gap-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.uuid}
          task={task}
          stage={stage}
          now={now}
          canDrag={canDrag}
          onOpen={() => onOpenTask(task.uuid)}
        />
      ))}
    </ul>
  );
}

/**
 * One task. On a computer, a white card: the title with the time in the stage
 * at its right, then the owner's line, then the reason when paused or waiting.
 * On a phone, a square sticky note in the stage's colour: the title (up to
 * four lines), the reason, and the owner and the time pinned to the foot.
 *
 * The card is a button that opens the task sheet (the techlead's brief, 29
 * October 2026), so it takes a tab and Enter. Its look is the approved one:
 * the lines are spans, as a button holds no paragraphs.
 */
function TaskCard({
  task,
  stage,
  now,
  canDrag,
  onOpen,
}: {
  task: SpaceTask;
  stage: SpaceTaskStage;
  now: number;
  canDrag: boolean;
  onOpen: () => void;
}) {
  // Keyed by the task, with the card itself in the data so a drop reads it.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.uuid,
    data: { task },
    disabled: !canDrag,
  });
  return (
    <li className="flex">
      <button
        ref={setNodeRef}
        type="button"
        onClick={onOpen}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
        className={cn(
          CARD,
          NOTE_FILL[stage],
          // A held note must not open the phone's text menu or select its words.
          canDrag && 'select-none [-webkit-touch-callout:none]',
          // Its place stays in the column, faded, while the lifted copy moves.
          isDragging && 'opacity-40',
          FOCUS_RING,
        )}
      >
        <CardBody task={task} now={now} />
      </button>
    </li>
  );
}

const CARD = cn(
  'v2-interactive block w-full rounded-xl border border-border bg-card px-3 py-3 text-left shadow-xs transition-colors hover:border-foreground/20',
  'max-md:flex max-md:aspect-square max-md:flex-col max-md:rounded-lg max-md:border-transparent max-md:p-3.5',
  'max-md:shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.10)]',
);

/** The lifted copy that follows the pointer: the same card, raised. */
function CardFace({ task, stage, now, lifted }: { task: SpaceTask; stage: SpaceTaskStage; now: number; lifted: boolean }) {
  return (
    <div className={cn(CARD, NOTE_FILL[stage], lifted && 'cursor-grabbing shadow-lg ring-1 ring-primary/30')}>
      <CardBody task={task} now={now} />
    </div>
  );
}

/** What a card says, the same on the board and when lifted. */
function CardBody({ task, now }: { task: SpaceTask; now: number }) {
  const note = taskNote(task);
  const time = formatRelativeTime(task.stage_changed_at, now);
  return (
    <>
      {/* The time in the stage rides the title's line on a computer, so the
          owner's line keeps a whole name in a narrow column (the first B
          pictures cut "Frontend Cl…"). */}
      <span className="flex items-start gap-2">
        <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug text-foreground max-md:line-clamp-4 max-md:text-[15px]">
          {task.title}
        </span>
        <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground max-md:hidden">{time}</span>
      </span>
      {/* A phone's note is narrow: the name takes its own line, with the
          Agent tag and the time on the line under it, so the name is whole
          (the first sticky pictures cut "Fron…"). */}
      <span className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground max-md:order-3 max-md:mt-auto max-md:flex-wrap max-md:gap-y-1.5 max-md:pt-2">
        <Initials person={task.owner} />
        <span className="min-w-0 truncate max-md:flex-1">{task.owner?.name ?? 'Nobody yet'}</span>
        <span className="contents max-md:flex max-md:w-full max-md:items-center">
          {task.owner?.is_agent ? <AgentTag /> : null}
          <span className="ml-auto shrink-0 pl-1 tabular-nums md:hidden">{time}</span>
        </span>
      </span>
      {note ? (
        <span className="mt-1.5 line-clamp-2 text-xs text-muted-foreground max-md:order-2 max-md:line-clamp-3">
          {note}
        </span>
      ) : null}
    </>
  );
}

/** An owner's mark: small initials, never a face (the techlead's brief for B). */
function Initials({ person }: { person: SpaceTaskPerson | null }) {
  return (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-muted-foreground max-md:bg-background/70"
    >
      {person ? getInitials(person.name) : <UserRound className="size-3" />}
    </span>
  );
}

/** The agent mark (Stay, 28 October 2026, 23:17Z: yes to the eight agent accounts). */
function AgentTag() {
  return (
    <span className="shrink-0 rounded-md bg-secondary px-1 py-px text-[10px] font-medium text-muted-foreground max-md:bg-background/70">
      Agent
    </span>
  );
}

/** What an empty column says: a quiet dashed box, never a blank. */
const EMPTY_WORDS: Readonly<Record<SpaceTaskStage, string>> = {
  working: 'Nothing in progress',
  paused: 'Nothing paused',
  waiting: 'Nothing waiting on anyone',
  queued: 'Nothing queued',
  done: `Nothing done in the last ${DONE_WINDOW_DAYS} days`,
};

/** Stable empty rows, so a pending board does not mint a new array per render. */
const NO_TASKS: readonly SpaceTask[] = [];
