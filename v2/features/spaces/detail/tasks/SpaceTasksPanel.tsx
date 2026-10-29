'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, ListChecks, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { getInitials } from '@/lib/utils/collab';
import type { SpaceTask, SpaceTaskPerson, SpaceTaskStage } from '@/types/collab';
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
 */
export function SpaceTasksPanel({ spaceUuid }: { spaceUuid: string }) {
  const session = useV2Session();
  const query = useQuery({
    ...spacesQueries.tasks(spaceUuid, { viewerId: session.userId }),
    enabled: collabAccessState(session) === 'eligible',
  });
  const tasks = query.data ?? NO_TASKS;
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());
  const [owner, setOwner] = useState<string | null>(null);
  const owners = useMemo(() => ownerOptions(tasks), [tasks]);
  const shown = useMemo(() => filterByOwner(tasks, owner), [tasks, owner]);
  const columns = useMemo(() => boardColumns(shown), [shown]);
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
      <CollabEmpty
        icon={ListChecks}
        title="No tasks in this space yet"
        description="A task shows who has it, what stage it is at and how long it has been there. People and agents move their own."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <OwnerFilter owners={owners} value={owner} onChange={setOwner} />
      <Board columns={columns} now={now} />
    </div>
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
function Board({ columns, now }: { columns: Record<SpaceTaskStage, SpaceTask[]>; now: number }) {
  const [doneOpen, setDoneOpen] = useState(false);
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

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Stage" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:hidden">
        {BOARD_STAGES.map((stage, index) => {
          const selected = index === phoneStage;
          return (
            <button
              key={stage}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => showStage(index)}
              className={cn(
                'v2-interactive relative inline-flex min-h-10 shrink-0 items-center gap-1.5 px-2.5 text-sm transition-colors',
                selected ? 'font-medium text-primary' : 'text-muted-foreground',
                FOCUS_RING,
              )}
            >
              <ThreadStatusDot value={TASK_STAGE_TONE[stage]} />
              {TASK_STAGE_LABELS[stage]}
              <span className="tabular-nums opacity-70">{columns[stage].length}</span>
              {selected ? <span aria-hidden className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
            </button>
          );
        })}
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
              onToggle={() => setDoneOpen((value) => !value)}
            />
          ) : (
            <StageColumn key={stage} stage={stage} tasks={columns[stage]} now={now} />
          ),
        )}
      </div>
    </div>
  );
}

const COLUMN =
  'flex min-w-0 flex-col gap-2 rounded-2xl p-1.5 max-md:w-full max-md:shrink-0 max-md:snap-start md:flex-1';

/**
 * Each column is a lane in a faint wash of its stage's colour (Stay, 29
 * October 2026, 02:49Z: "some kind of low opacity thin back colour"), the
 * same hue as its dot at about a twentieth of its strength, so the lanes read
 * apart while the white cards on them stay the strongest thing on the board.
 */
const STAGE_LANE: Readonly<Record<SpaceTaskStage, string>> = {
  working: 'bg-blue-500/5 dark:bg-blue-400/8',
  paused: 'bg-slate-500/6 dark:bg-slate-400/8',
  waiting: 'bg-amber-500/6 dark:bg-amber-400/8',
  queued: 'bg-violet-500/5 dark:bg-violet-400/8',
  done: 'bg-emerald-500/5 dark:bg-emerald-400/8',
};

function StageColumn({ stage, tasks, now }: { stage: SpaceTaskStage; tasks: SpaceTask[]; now: number }) {
  return (
    <section aria-label={`${TASK_STAGE_LABELS[stage]}, ${tasks.length}`} className={cn(COLUMN, STAGE_LANE[stage])}>
      <ColumnHead stage={stage} count={tasks.length} />
      <CardList tasks={tasks} now={now} empty={EMPTY_WORDS[stage]} />
    </section>
  );
}

/** Done: a strip at a computer's right edge until opened; on a phone, a column like the rest. */
function DoneColumn({
  tasks,
  now,
  open,
  onToggle,
}: {
  tasks: SpaceTask[];
  now: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        aria-label={`Show Done, the last ${DONE_WINDOW_DAYS} days: ${tasks.length}`}
        className={cn(
          'v2-interactive hidden w-11 shrink-0 flex-col items-center gap-2 self-stretch rounded-2xl py-3 text-xs text-muted-foreground transition-colors hover:text-foreground',
          STAGE_LANE.done,
          !open && 'md:flex',
          FOCUS_RING,
        )}
      >
        <ThreadStatusDot value={TASK_STAGE_TONE.done} />
        <span className="font-medium [writing-mode:vertical-rl]">Done</span>
        <span className="tabular-nums">{tasks.length}</span>
      </button>
      <section
        aria-label={`Done, the last ${DONE_WINDOW_DAYS} days, ${tasks.length}`}
        className={cn(COLUMN, STAGE_LANE.done, !open && 'md:hidden')}
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
        <CardList tasks={tasks} now={now} empty={EMPTY_WORDS.done} />
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

function CardList({ tasks, now, empty }: { tasks: SpaceTask[]; now: number; empty: string }) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskCard key={task.uuid} task={task} now={now} />
      ))}
    </ul>
  );
}

function TaskCard({ task, now }: { task: SpaceTask; now: number }) {
  const note = taskNote(task);
  return (
    <li className="rounded-xl border border-border bg-card px-3 py-3 shadow-xs">
      {/* The time in the stage rides the title's line, so the owner's line
          keeps a whole name in a computer's narrow column (the first B
          pictures cut "Frontend Cl…"). */}
      <div className="flex items-start gap-2">
        <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">{task.title}</p>
        <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatRelativeTime(task.stage_changed_at, now)}
        </span>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Initials person={task.owner} />
        <span className="min-w-0 truncate">{task.owner?.name ?? 'Nobody yet'}</span>
        {task.owner?.is_agent ? <AgentTag /> : null}
      </div>
      {note ? <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{note}</p> : null}
    </li>
  );
}

/** An owner's mark: small initials, never a face (the techlead's brief for B). */
function Initials({ person }: { person: SpaceTaskPerson | null }) {
  return (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-muted-foreground"
    >
      {person ? getInitials(person.name) : <UserRound className="size-3" />}
    </span>
  );
}

/** The agent mark (Stay, 28 October 2026, 23:17Z: yes to the eight agent accounts). */
function AgentTag() {
  return (
    <span className="shrink-0 rounded-md bg-secondary px-1 py-px text-[10px] font-medium text-muted-foreground">
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
