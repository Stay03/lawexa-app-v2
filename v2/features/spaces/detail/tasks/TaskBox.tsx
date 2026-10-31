'use client';

import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Loader2, MessagesSquare, Trash2, XIcon } from 'lucide-react';
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
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogSurface, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSheetSide } from '@/v2/features/cases/cited-by/use-sheet-side';
import { channelsQueries } from '@/v2/features/channels/queries';
import { ThreadStatusDot } from '@/v2/features/collab/kit/ThreadStatusChip';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { revealAfterKeyboard, takesKeyboard } from '@/v2/shell/reveal-in-scroller';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { spacesQueries } from '../../queries';
import { TASK_STAGE_LABELS, TASK_STAGE_TONE, TASK_STAGES, taskThreadHref } from './task-board-model';
import {
  seededDraft,
  startThreadChannels,
  startThreadError,
  startThreadPayload,
  taskChatLine,
  taskChatShown,
  taskChatState,
  threadChoices,
  taskThreadAccess,
  type StartChannel,
  type TaskBoxTab,
  type TaskSeed,
  type TaskChatState,
  type TaskPhoneTab,
} from './task-box-model';
import { TaskChatThread } from './TaskChatThread';
import { reorderedQueue, type QueueDirection } from './task-cache';
import { useCreateTask, useDeleteTask, useReorderTasks, useStartTaskThread, useUpdateTask } from './task-mutations';
import {
  checkDraft,
  createPayload,
  draftFromTask,
  hasErrors,
  moveLine,
  personOptions,
  pickerChoices,
  serverFieldErrors,
  stageTakesNote,
  TASK_NOTE_MAX,
  TASK_TITLE_MAX,
  updatePayload,
  withStage,
  type PersonOption,
  type TaskDraft,
  type TaskField,
  type TaskFieldErrors,
} from './task-sheet-model';

/** Which task the box shows: one on the board, or a new one. */
/** A saved task, or New task; New task from a thread carries that thread and its title. */
export type TaskBoxTarget = { kind: 'task'; taskUuid: string } | { kind: 'new'; seed?: TaskSeed };

/**
 * TaskBox — one task, opened from its card (Arthur's choice 1 + 2, thread
 * 7aa0c6d8, 19:51Z: "the centred box with task chat", after Microsoft Planner;
 * the combined design 1805492d, approved 11aefe48). It replaces the side sheet.
 *
 * On a computer, a centred box over the board: the task's details on the left
 * (Details and History as two tabs) and its Task chat on the right. On a phone,
 * the whole screen, with Details and Chat as two tabs.
 *
 * The details keep the sheet's fields and rules (task-sheet-model.ts): the
 * owner and editors change the title, who has it, the stage (Paused asks why,
 * Waiting asks who, the same `withStage` and `checkDraft` the drag dialog
 * uses), its thread and its place in the queue, and Delete. Save sends the
 * changed fields in one PATCH. A viewer reads the same fields as plain text.
 * The same box, empty, is New task.
 *
 * ON A PHONE, ABOVE THE KEYBOARD (Arthur, 29 October 2026, 21:13Z, thread
 * 7aa0c6d8: "The keyboard covers the entry form"). The box is placed from the
 * visible rectangle the keyboard hook publishes (`--visual-top`,
 * `--visual-height`, use-keyboard-inset.ts), so with the keyboard up its foot
 * (Save, Add task) sits on the keyboard; a focused field is scrolled into view
 * inside the body once the keyboard settles, and the pickers are the phone's
 * own (`native`). A saved task opens to be read there, so no field takes focus
 * and the keyboard stays down. On a computer the title takes focus.
 */
export function TaskBox({
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
  /** Kept after the box closes, so it fades away with its content. */
  target: TaskBoxTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  /** The space shows its channels to this reader: the Thread field lists them. */
  rooms: boolean;
  now: number;
}) {
  const phone = useSheetSide() === 'bottom';
  const task = target?.kind === 'task' ? (tasks.find((row) => row.uuid === target.taskUuid) ?? null) : null;
  const surfaceRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogSurface
          ref={surfaceRef}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            // A phone keeps its keyboard down for a saved task; elsewhere the title takes focus.
            if (phone && target?.kind === 'task') return;
            surfaceRef.current?.querySelector<HTMLElement>('[data-task-title]')?.focus();
          }}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-background text-sm text-foreground outline-none',
            'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 duration-150',
            phone ? PHONE_BOX : COMPUTER_BOX,
          )}
        >
          {target === null ? null : target.kind === 'task' && !task ? (
            <GoneBody />
          ) : (
            <TaskBoxBody
              // A new task, or another task, starts from its own fields.
              key={task?.uuid ?? 'new'}
              spaceUuid={spaceUuid}
              tasks={tasks}
              task={task}
              seed={target.kind === 'new' ? target.seed : undefined}
              canEdit={canEdit}
              rooms={rooms}
              phone={phone}
              now={now}
              onDone={() => onOpenChange(false)}
            />
          )}
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-10">
              <XIcon aria-hidden />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogSurface>
      </DialogPortal>
    </Dialog>
  );
}

/** A computer's box: centred, as wide as Planner's, never taller than the screen. */
const COMPUTER_BOX =
  'left-1/2 top-1/2 h-[min(640px,calc(100dvh-6rem))] w-[min(1000px,calc(100vw-4rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl ring-1 ring-foreground/5 shadow-2xl data-open:zoom-in-95 data-closed:zoom-out-95';

/** A phone's box: the visible screen, so the keyboard never covers its foot. */
const PHONE_BOX = 'inset-x-0 top-[var(--visual-top,0px)] h-[var(--visual-height,100dvh)] w-full v2-safe-bottom';

/** The task went while the box was open: someone deleted it. */
function GoneBody() {
  return (
    <div className="flex flex-col gap-1.5 p-6 pr-12">
      <DialogTitle>This task is gone</DialogTitle>
      <DialogDescription>Someone deleted it.</DialogDescription>
    </div>
  );
}

function TaskBoxBody({
  spaceUuid,
  tasks,
  task,
  seed,
  canEdit,
  rooms,
  phone,
  now,
  onDone,
}: {
  spaceUuid: string;
  tasks: readonly SpaceTask[];
  task: SpaceTask | null;
  /** New task from a thread: its Thread and Title start filled in. */
  seed?: TaskSeed;
  canEdit: boolean;
  rooms: boolean;
  /** A phone: the whole screen, two tabs, and the phone's own pickers. */
  phone: boolean;
  now: number;
  onDone: () => void;
}) {
  const uid = useId();
  const native = phone;
  const session = useV2Session();
  const viewerId = session.userId;
  const [draft, setDraft] = useState<TaskDraft>(() => seededDraft(draftFromTask(task, session.userUuid), seed));
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [tab, setTab] = useState<TaskBoxTab>('details');
  const [phoneTab, setPhoneTab] = useState<TaskPhoneTab>('details');
  const createTask = useCreateTask(spaceUuid);
  const updateTask = useUpdateTask(spaceUuid);
  const deleteTask = useDeleteTask(spaceUuid);
  const saving = createTask.isPending || updateTask.isPending;
  // The thread's own answer about this reader: may they read it, and post in it
  // (Backend 8cd4dfe6). A 403 is a refusal, so it is not asked again.
  // Task chat is for Researchers (Stay's choice A, 20:24Z): nobody else's box asks for the thread.
  const canChat = session.canAccessTeamChannels;
  const threadUuid = task?.thread?.uuid ?? null;
  const threadQuery = useQuery({
    ...channelsQueries.detail(threadUuid ?? '', { viewerId }),
    enabled: canChat && threadUuid !== null,
    retry: (failures, error) => extractApiError(error).status !== 403 && failures < 1,
  });
  const chat = taskChatState(
    task,
    { canEdit, canChat },
    taskThreadAccess({
      isPending: threadQuery.isPending,
      data: threadQuery.data?.data,
      errorStatus: threadQuery.error ? extractApiError(threadQuery.error).status : null,
    }),
  );
  const chatShown = taskChatShown(chat);
  const retryChat = () => void threadQuery.refetch();
  // Start a thread for a task with none, in the channel picked (Stay, 22:40Z):
  // the board's copy takes it, and the pane opens on it. The channels are the
  // rail's own read (`CollabFrame`, 50 a page), so the pane reads nothing new.
  const startThread = useStartTaskThread(spaceUuid);
  const mayStart = chat.kind === 'none' && chat.canStart;
  const channelList = useQuery({ ...channelsQueries.bySpace({ spaceUuid, viewerId, per_page: 50 }), enabled: mayStart });
  const startRooms = useMemo(() => startThreadChannels(channelList.data?.data ?? []), [channelList.data]);
  const [pickedChannel, setPickedChannel] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const startIn = pickedChannel ?? startRooms.preselected;
  const chatStart: ChatStart = {
    pending: startThread.isPending,
    channels: channelList.isSuccess ? startRooms.options : null,
    channel: startIn,
    onChannel: (uuid) => {
      setPickedChannel(uuid);
      setStartError(null);
    },
    error: startError,
    onStart: task
      ? () => {
          setStartError(null);
          startThread.mutate(
            { taskUuid: task.uuid, payload: startThreadPayload(startIn) },
            {
              // The form takes the new thread too, so Save never sends "no thread" and unlinks it.
              onSuccess: (response) => setDraft((current) => ({ ...current, thread: response.data.thread?.uuid ?? current.thread })),
              onError: (failure) => setStartError(startThreadError(extractApiError(failure))),
            },
          );
        }
      : null,
  };
  const threadChannel = threadQuery.data?.data ?? null;

  // A focused field is scrolled into view inside the body once the keyboard
  // settles: the body shrinks as the box sits on the keyboard, and a field low
  // in it would sit under the foot (Arthur, 29 October 2026).
  const bodyRef = useRef<HTMLDivElement>(null);
  const cancelReveal = useRef<(() => void) | null>(null);
  const revealFocused = (event: FocusEvent<HTMLDivElement>) => {
    const box = bodyRef.current;
    if (!box || !takesKeyboard(event.target)) return;
    cancelReveal.current?.();
    cancelReveal.current = revealAfterKeyboard(box, event.target);
  };
  useEffect(() => () => cancelReveal.current?.(), []);

  const membersQuery = useQuery({
    ...spacesQueries.allMembers(spaceUuid, { viewerId }),
    enabled: canEdit,
  });
  // New task names the viewer as owner before the member list has loaded, so
  // the viewer is a choice from the start: the Owner box never opens empty
  // (the local run against the task board server, 29 October 2026).
  const viewerUuid = task ? null : session.userUuid;
  const viewerName = session.name;
  // Only owners and editors may own a task (the techlead's decision on
  // Tester's note, 29 October 2026); anyone in the space may be waited on.
  const owners = useMemo(() => {
    const viewer = viewerUuid && viewerName ? { uuid: viewerUuid, name: viewerName } : null;
    return personOptions(membersQuery.data ?? [], [task?.owner ?? null, viewer], { movers: true });
  }, [membersQuery.data, task, viewerUuid, viewerName]);
  const waitable = useMemo(
    () => personOptions(membersQuery.data ?? [], [task?.waiting_on ?? null], { movers: false }),
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
      setTab('details');
      setPhoneTab('details');
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

  const titleField = (
    <FieldBlock label="Title" htmlFor={`${uid}-title`} error={errors.title} errorId={`${uid}-title-error`}>
      {canEdit ? (
        <Input
          id={`${uid}-title`}
          data-task-title
          value={draft.title}
          onChange={(event) => change('title', event.target.value, 'title')}
          maxLength={TASK_TITLE_MAX}
          placeholder="What needs doing?"
          autoComplete="off"
          aria-invalid={!!errors.title || undefined}
          aria-describedby={errors.title ? `${uid}-title-error` : undefined}
        />
      ) : (
        <p className="text-base font-medium text-foreground">{task?.title}</p>
      )}
    </FieldBlock>
  );

  const details = (
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
      <div className="sm:col-span-2">{titleField}</div>

      <div className="sm:col-span-2">
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
      </div>

      <FieldBlock label="Owner" htmlFor={`${uid}-owner`} error={errors.owner} errorId={`${uid}-owner-error`}>
        {canEdit ? (
          <ChoiceSelect
            id={`${uid}-owner`}
            native={native}
            value={draft.owner}
            options={owners}
            emptyLabel="Nobody yet"
            invalid={!!errors.owner}
            describedBy={errors.owner ? `${uid}-owner-error` : undefined}
            onChange={(value) => change('owner', value, 'owner')}
          />
        ) : (
          <p className="text-sm text-foreground">{task?.owner?.name ?? 'Nobody yet'}</p>
        )}
      </FieldBlock>

      {/* A thread this reader may not read: nothing of it, the field included (Stay, 05:06Z). */}
      {chatShown ? (
      <FieldBlock label="Thread" htmlFor={`${uid}-thread`} error={errors.thread} errorId={`${uid}-thread-error`}>
        {canEdit && rooms ? (
          <ThreadSelect
            id={`${uid}-thread`}
            native={native}
            spaceUuid={spaceUuid}
            value={draft.thread}
            current={task?.thread ?? seed?.thread ?? null}
            invalid={!!errors.thread}
            describedBy={errors.thread ? `${uid}-thread-error` : undefined}
            onChange={(value) => change('thread', value, 'thread')}
          />
        ) : (
          <p className="text-sm text-foreground">{task?.thread?.name ?? 'No thread'}</p>
        )}
      </FieldBlock>
      ) : null}

      {draft.stage === 'waiting' ? (
        <FieldBlock label="Waiting on" htmlFor={`${uid}-waiting`} error={errors.waiting_on} errorId={`${uid}-waiting-error`}>
          {canEdit ? (
            <ChoiceSelect
              id={`${uid}-waiting`}
              native={native}
              value={draft.waitingOn}
              options={waitable}
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
        <div className="sm:col-span-2">
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
        </div>
      ) : null}

      {task && canEdit && task.stage === 'queued' ? (
        <div className="sm:col-span-2">
          <QueueOrder spaceUuid={spaceUuid} tasks={tasks} task={task} />
        </div>
      ) : null}
    </div>
  );

  const history = task ? <History spaceUuid={spaceUuid} taskUuid={task.uuid} now={now} /> : null;

  // The words above the fields: which task, and how long at its stage.
  const head = (
    <div className="flex flex-col gap-1 px-6 pt-5 pr-14">
      <DialogTitle className="truncate text-base font-semibold">{task ? task.title : 'New task'}</DialogTitle>
      <DialogDescription className="text-xs">
        {task ? stageSince(task, now) : 'Give it a title. You can change the rest later.'}
      </DialogDescription>
    </div>
  );

  const foot = canEdit ? (
    <div className="flex items-center gap-2 border-t border-border px-6 py-3">
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
    </div>
  ) : null;

  return (
    <>
      {phone ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {head}
          {task && chatShown ? (
            <BoxTabs
              label="Task"
              value={phoneTab}
              onChange={setPhoneTab}
              tabs={[
                { value: 'details', label: 'Details' },
                { value: 'chat', label: 'Chat' },
              ]}
            />
          ) : null}
          {phoneTab === 'chat' && task && chatShown ? (
            // Outside the details form, so the composer's Enter sends a message and never saves the task.
            <TaskChatPane state={chat} channel={threadChannel} onRetry={retryChat} start={chatStart} />
          ) : (
            <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
              <div
                ref={bodyRef}
                onFocus={revealFocused}
                className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain px-4 py-5"
              >
                {details}
                {history}
              </div>
              {foot}
            </form>
          )}
        </div>
      ) : (
        <div className={cn('grid min-h-0 flex-1', chatShown ? 'grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1')}>
          <form onSubmit={save} noValidate className="flex min-h-0 flex-col">
            {head}
            {task ? (
              <BoxTabs
                label="Task"
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: 'details', label: 'Details' },
                  { value: 'history', label: 'History' },
                ]}
              />
            ) : null}
            <div
              ref={bodyRef}
              onFocus={revealFocused}
              className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain px-6 py-5"
            >
              {tab === 'history' && task ? history : details}
            </div>
            {foot}
          </form>
          {chatShown ? (
            <aside aria-label="Task chat" className="flex min-h-0 flex-col border-l border-border bg-secondary/40">
              <TaskChatPane state={chat} channel={threadChannel} onRetry={retryChat} start={chatStart} />
            </aside>
          ) : null}
        </div>
      )}

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

/** Two tabs under the box's head: Details and History, or on a phone Details and Chat. */
function BoxTabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  tabs: readonly { value: T; label: string }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1.5 px-6 pt-3">
      {tabs.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              'v2-interactive inline-flex h-8 items-center rounded-full px-3.5 text-sm transition-colors',
              selected ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The task's chat: its linked thread (task-box-model.ts decides what shows),
 * as its own feed and composer (TaskChatThread), with a way to its own page.
 */
function TaskChatPane({
  state,
  channel,
  onRetry,
  start,
}: {
  state: TaskChatState;
  /** The thread, once its own answer has come. */
  channel: Channel | null;
  onRetry: () => void;
  /** Start a thread, where the task has none and the reader may edit it. */
  start: ChatStart;
}) {
  const line = taskChatLine(state);
  const thread = 'thread' in state ? state.thread : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-5 pt-5 pr-12 pb-3">
        <MessagesSquare aria-hidden className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Task chat</h3>
        {thread && state.kind !== 'hidden' ? (
          <Link
            href={taskThreadHref(thread)}
            className={cn('ml-auto inline-flex items-center gap-1 rounded-sm text-xs text-primary hover:underline', FOCUS_RING)}
          >
            Open the thread
            <ExternalLink aria-hidden className="size-3" />
          </Link>
        ) : null}
      </div>
      {(state.kind === 'read' || state.kind === 'post') && channel ? (
        <TaskChatThread channel={channel} canPost={state.kind === 'post'} threadHref={taskThreadHref(state.thread)} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 px-5 pb-5">
          {state.kind === 'loading' ? (
            <div className="flex flex-col gap-3" aria-hidden>
              <Skeleton className="h-12 w-4/5 rounded-2xl" />
              <Skeleton className="ml-auto h-10 w-3/5 rounded-2xl" />
            </div>
          ) : null}
          {line ? <p className="text-sm text-muted-foreground">{line}</p> : null}
          {state.kind === 'failed' ? (
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          {state.kind === 'none' && state.canStart && start.onStart ? <StartThread start={start} onStart={start.onStart} /> : null}
        </div>
      )}
    </div>
  );
}

/** "Start a thread" and where it starts: the pane's way in for a task with none. */
interface ChatStart {
  pending: boolean;
  /** The open channels it may start in, once the list has come; `null` before. */
  channels: readonly StartChannel[] | null;
  channel: string | null;
  onChannel: (uuid: string | null) => void;
  error: string | null;
  onStart: (() => void) | null;
}

/**
 * The channel picker over the button (Stay, 30 October 2026, 22:40Z; plan
 * 0fba5ec3). Several open channels: a picker, the server's own default
 * preselected. One: a line naming it. None: a line saying so, and no button,
 * since the server would refuse. While the list is on its way, the button
 * starts the thread where the server puts it.
 */
function StartThread({ start, onStart }: { start: ChatStart; onStart: () => void }) {
  const uid = useId();
  const native = useSheetSide() === 'bottom';
  const channels = start.channels;
  if (channels && channels.length === 0) {
    return <p className="text-sm text-muted-foreground">This Space has no open channel to start a thread in.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {channels && channels.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-channel`} className="text-xs font-medium text-muted-foreground">
            Start a thread in
          </Label>
          <ChoiceSelect
            id={`${uid}-channel`}
            native={native}
            value={start.channel}
            options={channels.map((channel) => ({ uuid: channel.uuid, name: `#${channel.name}` }))}
            emptyLabel={null}
            invalid={!!start.error}
            describedBy={start.error ? `${uid}-error` : undefined}
            onChange={start.onChannel}
          />
        </div>
      ) : channels && channels.length === 1 ? (
        <p className="text-sm text-muted-foreground">Starts in #{channels[0].name}</p>
      ) : null}
      <Button type="button" size="sm" className="w-fit gap-1.5" disabled={start.pending} onClick={onStart}>
        {start.pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <MessagesSquare aria-hidden className="size-4" />}
        Start a thread
      </Button>
      {start.error ? (
        <p id={`${uid}-error`} role="alert" className="text-xs text-destructive">
          {start.error}
        </p>
      ) : null}
    </div>
  );
}

export function FieldBlock({
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

/** Radix Select refuses an empty value, so "nobody" has its own. */
const NONE = '__none__';

/**
 * A person or a thread to pick. On a computer, the house Radix list. On a
 * phone (`native`), the phone's own picker: iOS shows its wheel and Android
 * its dialog, both outside the page, so the list cannot open under the
 * keyboard or run off the screen as the Radix list did over the task sheet's
 * footer (Arthur, 29 October 2026, 21:13Z, thread 7aa0c6d8). The same
 * choices either way: each shows its name and sends its uuid, the empty
 * choice ("Nobody yet", "No thread") or the placeholder comes first, and the
 * field keeps its id, `aria-invalid` and `aria-describedby`.
 */
export function ChoiceSelect({
  id,
  native,
  value,
  options,
  emptyLabel,
  placeholder,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  native: boolean;
  value: string | null;
  options: readonly PersonOption[];
  /** The "nobody" choice's words, or `null` for none. */
  emptyLabel: string | null;
  placeholder?: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string | null) => void;
}) {
  if (native) {
    return (
      <div className="relative">
        <select
          id={id}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          // The house input's look, and 16px text so iOS does not zoom in.
          className={cn(
            'h-9 w-full min-w-0 appearance-none truncate rounded-4xl border border-input bg-input/30 py-1 pl-3 pr-9 text-base text-foreground outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
            value === null && emptyLabel === null && 'text-muted-foreground',
          )}
        >
          {pickerChoices(options, emptyLabel, placeholder).map((choice) => (
            <option key={choice.value} value={choice.value} disabled={choice.disabled}>
              {choice.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    );
  }
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
  native,
  spaceUuid,
  value,
  current,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  native: boolean;
  spaceUuid: string;
  value: string | null;
  current: SpaceTask['thread'];
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string | null) => void;
}) {
  const { userId: viewerId } = useV2Session();
  // The rail's own entry (`CollabFrame`, 50 a page), so the box reads nothing new.
  const channels = useQuery(channelsQueries.bySpace({ spaceUuid, viewerId, per_page: 50 }));
  const threads = useQuery(channelsQueries.threadsBySpace({ spaceUuid, viewerId, per_page: 50 }));
  const options = useMemo(
    () => threadChoices([...(channels.data?.data ?? []), ...(threads.data?.data ?? [])], current),
    [channels.data, threads.data, current],
  );
  return (
    <ChoiceSelect
      id={id}
      native={native}
      value={value}
      options={options}
      emptyLabel="No thread"
      invalid={invalid}
      describedBy={describedBy}
      onChange={onChange}
    />
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

/** The box's subtitle: "Waiting for 12m", or "Queued just now" inside the
 *  first minute (the local run read "Queued for now"). */
function stageSince(task: SpaceTask, now: number): string {
  // The helper says "now" inside the first minute, and "" before the clock is read.
  const time = formatRelativeTime(task.stage_changed_at, now);
  return time && time !== 'now' ? `${TASK_STAGE_LABELS[task.stage]} for ${time}` : `${TASK_STAGE_LABELS[task.stage]} just now`;
}

const NO_MOVES: readonly SpaceTaskMove[] = [];
