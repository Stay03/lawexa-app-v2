'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ListChecks, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { SpaceTask } from '@/types/collab';
import { CollabEmpty } from '@/v2/features/collab/kit/CollabEmpty';
import { ThreadStatusChip } from '@/v2/features/collab/kit/ThreadStatusChip';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { collabAccessState } from '@/v2/features/collab/model';
import { RadarTabs, type RadarTab } from '@/v2/features/radars/RadarTabs';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { FeedLine } from '../content/feed-rows';
import { SpaceContentErrorState, SpaceContentSkeleton } from '../content/states';
import { spacesQueries } from '../../queries';
import {
  doneFoldLabel,
  groupByPerson,
  groupByStage,
  openTasks,
  overCommitted,
  personSummary,
  TASK_STAGE_LABELS,
  TASK_STAGE_TONE,
  taskNote,
  type PersonGroup,
} from './task-board-model';

/**
 * SpaceTasksPanel — the Tasks pill (thread 7aa0c6d8; Stay, 27 October 2026:
 * "A but in a clean UI/UX in the space that both humans and agent can use").
 * Who is doing what in the space, from `GET /spaces/{uuid}/tasks`.
 *
 * BY PERSON (the default): one block per owner under their face and name,
 * with a head line of what they have ("1 working · 3 next"). Their task in
 * progress comes first, then what is paused (with the reason), what waits on
 * someone (and on whom), and the queue in order. Their done tasks of the last
 * 14 days fold away under the block. Two tasks in progress at once turn the
 * head line amber, Needs Action's word colour; nothing moves on its own.
 *
 * BY STAGE: one block per stage under its chip, each row with the owner's
 * face. Done folds the same way.
 *
 * Every row is the feed's own row (`FeedLine`), so a task reads like
 * everything else in the space. The stage chip is the thread status chip in
 * that status's colours (techlead, 28 October 2026: no new colours, tiles or
 * badges). The time is how long the task has been in its stage.
 */
export function SpaceTasksPanel({ spaceUuid }: { spaceUuid: string }) {
  const session = useV2Session();
  const [view, setView] = useState<TaskView>('person');
  const query = useQuery({
    ...spacesQueries.tasks(spaceUuid, { viewerId: session.userId }),
    enabled: collabAccessState(session) === 'eligible',
  });
  const tasks = query.data ?? NO_TASKS;
  // Captured once, so no clock read runs in render (React Compiler purity).
  const [now] = useState(() => Date.now());
  // A refusal the server explained (403) is worth its own sentence.
  const apiError = query.error ? extractApiError(query.error) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* The strip is as wide as its two choices, like the space's pills. */}
      <div className="self-start">
        <RadarTabs
          tabs={VIEW_TABS}
          value={view}
          onChange={setView}
          ariaLabel="Show the space's tasks by person or by stage"
          panelId={PANEL_ID}
        />
      </div>
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${view}`}>
        {query.isPending ? (
          <SpaceContentSkeleton />
        ) : query.isError && tasks.length === 0 ? (
          <SpaceContentErrorState
            tab="tasks"
            message={apiError?.status === 403 ? apiError.message : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : tasks.length === 0 ? (
          <CollabEmpty
            icon={ListChecks}
            title="No tasks in this space yet"
            description="A task shows who has it, what stage it is at and its thread. People and agents move their own."
          />
        ) : view === 'person' ? (
          <ByPerson tasks={tasks} now={now} />
        ) : (
          <ByStage tasks={tasks} now={now} />
        )}
      </div>
    </div>
  );
}

function ByPerson({ tasks, now }: { tasks: readonly SpaceTask[]; now: number }) {
  return (
    <div className="flex flex-col gap-5">
      {groupByPerson(tasks).map((group) => (
        <PersonBlock key={group.key} group={group} now={now} />
      ))}
    </div>
  );
}

function PersonBlock({ group, now }: { group: PersonGroup; now: number }) {
  const headingId = useId();
  const open = openTasks(group);
  const busy = overCommitted(group);
  const name = group.owner?.name ?? 'Nobody yet';
  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      {/* A phone puts the head line under the name, so the name keeps its
          whole width (the 390px pictures cut "Frontend Cl…"). */}
      <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-x-3 px-3 max-md:py-1">
        {group.owner ? <MemberAvatar user={group.owner} size="sm" /> : <NobodyMark />}
        <h3 id={headingId} className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">{name}</span>
          {group.owner?.is_agent ? <AgentWord /> : null}
        </h3>
        <span
          className={cn(
            'text-xs tabular-nums max-md:basis-full max-md:pl-9 md:ml-auto md:shrink-0',
            busy ? 'font-medium text-amber-800 dark:text-amber-300' : 'text-muted-foreground',
          )}
        >
          {personSummary(group)}
          {busy ? <span className="sr-only">, more than one task in progress</span> : null}
        </span>
      </div>
      {open.length > 0 ? (
        <ul className="flex flex-col">
          {open.map((task) => (
            <TaskLine key={task.uuid} task={task} now={now} showOwner={false} />
          ))}
        </ul>
      ) : null}
      {group.done.length > 0 ? <DoneFold tasks={group.done} now={now} showOwner={false} /> : null}
    </section>
  );
}

function ByStage({ tasks, now }: { tasks: readonly SpaceTask[]; now: number }) {
  return (
    <div className="flex flex-col gap-5">
      {groupByStage(tasks).map((group) =>
        group.stage === 'done' ? (
          <DoneFold key={group.stage} tasks={group.tasks} now={now} showOwner />
        ) : (
          <StageBlock key={group.stage} stage={group.stage} tasks={group.tasks} now={now} />
        ),
      )}
    </div>
  );
}

function StageBlock({ stage, tasks, now }: { stage: SpaceTask['stage']; tasks: SpaceTask[]; now: number }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <h3 id={headingId} className="flex min-h-9 items-center gap-2 px-3">
        <ThreadStatusChip value={TASK_STAGE_TONE[stage]} label={TASK_STAGE_LABELS[stage]} />
        <span className="text-xs tabular-nums text-muted-foreground">{tasks.length}</span>
      </h3>
      <ul className="flex flex-col">
        {tasks.map((task) => (
          <TaskLine key={task.uuid} task={task} now={now} showOwner />
        ))}
      </ul>
    </section>
  );
}

/** A block's done tasks, folded under one quiet line until asked for. */
function DoneFold({ tasks, now, showOwner }: { tasks: readonly SpaceTask[]; now: number; showOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'v2-interactive inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-90')}
        />
        {doneFoldLabel(tasks.length)}
      </button>
      {open ? (
        <ul id={listId} className="flex flex-col">
          {tasks.map((task) => (
            <TaskLine key={task.uuid} task={task} now={now} showOwner={showOwner} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * One task: its title, then its stage chip on the by-person view (the
 * by-stage view's block head already names the stage), and how long it has
 * been there. Under it, who it waits on or why it is paused, then its
 * thread. On the by-stage view the owner's face leads the row and their
 * name leads the second line.
 */
function TaskLine({ task, now, showOwner }: { task: SpaceTask; now: number; showOwner: boolean }) {
  const meta = [showOwner ? ownerWords(task.owner) : null, taskNote(task), task.thread?.name ?? null]
    .filter(Boolean)
    .join(' · ');
  return (
    <FeedLine
      line={{
        lead: showOwner ? task.owner ? <MemberAvatar user={task.owner} size="sm" /> : <NobodyMark /> : undefined,
        title: task.title,
        quiet: task.stage === 'done',
        status: showOwner ? undefined : (
          <ThreadStatusChip value={TASK_STAGE_TONE[task.stage]} label={TASK_STAGE_LABELS[task.stage]} />
        ),
        meta: meta || undefined,
        time: formatRelativeTime(task.stage_changed_at, now),
      }}
      render={(className, content) => <div className={className}>{content}</div>}
    />
  );
}

/** The agent mark (Stay, 28 October 2026, 23:17Z: yes to the eight agent
 *  accounts): one quiet word after the name, no badge. */
function AgentWord() {
  return <span className="shrink-0 text-xs text-muted-foreground">Agent</span>;
}

/** The owner on a by-stage row's second line: "Backend Claude (agent)". */
function ownerWords(owner: SpaceTask['owner']): string {
  if (!owner) return 'Nobody yet';
  return owner.is_agent ? `${owner.name} (agent)` : owner.name;
}

/** The face for the tasks nobody has yet. */
function NobodyMark() {
  return (
    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary">
      <UserRound className="size-3.5 text-muted-foreground" />
    </span>
  );
}

type TaskView = 'person' | 'stage';

const VIEW_TABS: readonly RadarTab<TaskView>[] = [
  { id: 'person', label: 'By person' },
  { id: 'stage', label: 'By stage' },
];

const PANEL_ID = 'space-tasks-panel';

/** Stable empty rows, so a pending board does not mint a new array per render. */
const NO_TASKS: readonly SpaceTask[] = [];
