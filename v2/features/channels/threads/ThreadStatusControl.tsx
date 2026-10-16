'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { useAuthStore } from '@/lib/stores/authStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ThreadStatus, ThreadStatusPerson, ThreadStatusValue } from '@/types/collab';
import {
  ThreadStatusChip,
  ThreadStatusDot,
} from '@/v2/features/collab/kit/ThreadStatusChip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  THREAD_STATUS_OPTIONS,
  isSameThreadStatus,
  knownThreadStatus,
  threadStatusErrorText,
  threadStatusFooter,
  threadStatusPerson,
  threadStatusQuiet,
  threadStatusTriggerLabel,
  type ThreadStatusChoice,
  type ThreadStatusOption,
} from '../thread-status-model';
import { useMinuteNow } from '../use-minute-now';
import { useSetThreadStatus } from './mutations';
import { NeedsActionStep } from './NeedsActionStep';
import { moveRadioFocus } from './radio-focus';

/**
 * ThreadStatusControl — a thread's status in its header, and the way to set it
 * (Stay, 15-16 October 2026: thread status, "locked in" from the mock's
 * option B; revised by Arthur the same day).
 *
 * ── WHO GETS A BUTTON ──────────────────────────────────────────────────────
 * The PATCH is authorized like posting (`403` for anyone who cannot post), so
 * the button is offered on the thread's own can-post ruling, `canSet`, and on
 * nothing else. Everyone else sees the chip alone, or nothing when there is no
 * status.
 *
 * ── FIVE CHOICES, NO WAY BACK TO NONE ──────────────────────────────────────
 * A status, once set, cannot be cleared (the server refuses `null`), so the
 * menu offers the five and ticks the current one. A thread without a status
 * shows "Set status".
 *
 * ── NEEDS ACTION ASKS FIRST ────────────────────────────────────────────────
 * The other four save on a tap. Needs Action opens a second step in the same
 * surface ({@link NeedsActionStep}): who needs to act and a short note, both
 * optional, then Save.
 *
 * ── ONE CONTROL, TWO SURFACES ──────────────────────────────────────────────
 * `surface="menu"` opens a shadcn `Popover` beside the name on a wide pane
 * (a dialog, not a menu, because the Needs Action step is a form); `surface="sheet"` opens a bottom sheet on a phone, the channel
 * screen's own pattern for phone choices (`MessageActionsSheet`), and stands
 * in the subtitle's line with the note after it. The header mounts one of
 * each and shows exactly one by breakpoint, so no media query runs in render.
 *
 * ── THE SURFACE STAYS OPEN UNTIL THE SERVER ANSWERS ────────────────────────
 * The choice is optimistic: the tick and the chip move on the press. The menu
 * or sheet closes on success. On a refusal the thread is re-read and the
 * server's sentence shows inside the surface, where the press was, with no
 * toast. Choosing what the thread already holds only closes the surface.
 */
export function ThreadStatusControl({
  threadUuid,
  parentUuid,
  viewerId,
  status: rawStatus,
  lastMessageAt,
  canSet,
  surface,
}: {
  threadUuid: string;
  parentUuid: string | null;
  /** The session's viewer, the cache partition of the members roster. */
  viewerId: number | null;
  /** The thread's status; the caller mounts this only when the field exists. */
  status: ThreadStatus | null;
  lastMessageAt: string | null;
  canSet: boolean;
  surface: 'menu' | 'sheet';
}) {
  const now = useMinuteNow();
  // A value this app does not know reads as no status: no chip, no crash.
  const status = knownThreadStatus(rawStatus);
  const quiet = threadStatusQuiet({ status, last_message_at: lastMessageAt }, now);

  if (!canSet) {
    // The prefix says what the chip is to a screen reader; sighted readers
    // have the header around it. On a phone it sits in the subtitle's line,
    // so it takes the row's size and the note follows it.
    return status ? (
      <>
        <span className="inline-flex min-w-0 shrink-0 items-center">
          <span className="sr-only">Status: </span>
          <ThreadStatusChip
            size={surface === 'sheet' ? 'sm' : 'md'}
            value={status.value}
            person={threadStatusPerson(status)}
            quiet={quiet}
          />
        </span>
        {surface === 'sheet' && <PhoneNote status={status} />}
      </>
    ) : null;
  }

  const shared = { threadUuid, parentUuid, viewerId, status, quiet, now };
  return surface === 'menu' ? <StatusMenu {...shared} /> : <StatusSheet {...shared} />;
}

interface SurfaceProps {
  threadUuid: string;
  parentUuid: string | null;
  viewerId: number | null;
  status: ThreadStatus | null;
  quiet: string | null;
  now: number;
}

/** The phone line's note, after the chip; nothing when there is none. */
function PhoneNote({ status }: { status: ThreadStatus | null }) {
  const note = status?.note?.trim() || null;
  if (!note) return null;
  return (
    <span className="ml-1.5 min-w-0 truncate text-[11px] leading-tight text-muted-foreground">
      {note}
    </span>
  );
}

/** The press, the optimistic write, the close on success, the inline error. */
function useStatusChoice(
  threadUuid: string,
  parentUuid: string | null,
  status: ThreadStatus | null,
  close: () => void,
) {
  const mutation = useSetThreadStatus(threadUuid, parentUuid);
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);
  const viewerName = useAuthStore((state) => state.user?.name ?? null);
  const [error, setError] = useState<string | null>(null);

  const choose = (choice: ThreadStatusChoice) => {
    // Choosing what the thread already holds changes nothing, so it sends
    // nothing and writes no "Set to … · just now" for a change nobody made.
    if (isSameThreadStatus(choice, status)) {
      close();
      return;
    }
    setError(null);
    mutation.mutate(
      {
        choice,
        viewer:
          viewerUuid && viewerName ? { uuid: viewerUuid, name: viewerName } : null,
      },
      {
        onSuccess: close,
        onError: (failure) => setError(threadStatusErrorText(extractApiError(failure))),
      },
    );
  };

  return { choose, error, clearError: () => setError(null), pending: mutation.isPending };
}

/**
 * The trigger: the chip plus a chevron, or a quiet "Set status". `compact` is
 * the phone's, standing in the subtitle's line under the title (techlead, 16
 * October 2026): the row chip and a smaller chevron, so the line keeps the
 * subtitle's height.
 */
function TriggerFace({
  status,
  quiet,
  compact = false,
}: {
  status: ThreadStatus | null;
  quiet: string | null;
  compact?: boolean;
}) {
  const chevron = (
    <ChevronDown
      aria-hidden
      className={cn('shrink-0 text-muted-foreground', compact ? 'size-3' : 'size-3.5')}
    />
  );
  return status ? (
    <>
      <ThreadStatusChip
        size={compact ? 'sm' : 'md'}
        value={status.value}
        person={threadStatusPerson(status)}
        quiet={quiet}
      />
      {chevron}
    </>
  ) : (
    <>
      <span
        className={cn(
          'font-medium text-muted-foreground',
          compact ? 'text-[11px] leading-tight' : 'text-xs',
        )}
      >
        Set status
      </span>
      {chevron}
    </>
  );
}

const TRIGGER_BASE = cn(
  'v2-interactive inline-flex shrink-0 items-center gap-1 rounded-full pr-1.5',
  'transition-colors duration-150 hover:bg-secondary/60 motion-reduce:transition-none',
  FOCUS_RING,
);
const TRIGGER = cn(TRIGGER_BASE, 'min-h-8');
/** The phone's, in the subtitle line: no taller than the chip it holds. */
const TRIGGER_COMPACT = cn(TRIGGER_BASE, 'min-h-5');

/** The footer, the note, and a refusal — the same three lines on both surfaces. */
function StatusFooter({
  status,
  now,
  error,
}: {
  status: ThreadStatus | null;
  now: number;
  error: string | null;
}) {
  const note = status?.note?.trim() || null;
  if (!status && !error) return null;
  return (
    <div className="space-y-1 px-3 py-2 text-xs text-muted-foreground">
      {status && <p>{threadStatusFooter(status, now)}</p>}
      {note && <p className="text-foreground/80">{note}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function OptionText({ option }: { option: ThreadStatusOption }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium text-foreground">{option.label}</span>
      <span className="text-xs text-muted-foreground">{option.hint}</span>
    </span>
  );
}

/** One tap on an option: Needs Action asks first, the others save. */
function optionPress(
  choose: (choice: ThreadStatusChoice) => void,
  openNeedsAction: () => void,
) {
  return (value: ThreadStatusValue) => {
    if (value === 'needs_action') openNeedsAction();
    else choose({ status: value });
  };
}

/** The step's Save: Needs Action, with whoever and whatever was given. */
function saveNeedsAction(choose: (choice: ThreadStatusChoice) => void) {
  return (person: ThreadStatusPerson | null, note: string | null) =>
    choose({ status: 'needs_action', needsActionFrom: person, note });
}

/**
 * The five statuses as ONE radio group: the checked option is the single tab
 * stop (the first when there is no status), arrows move focus, and a click,
 * Enter or Space chooses. `aria-disabled`, not `disabled`, while a request is
 * out, so focus is not thrown off the option it is on.
 */
function StatusRadioGroup({
  current,
  pending,
  onPress,
  dense = false,
}: {
  current: ThreadStatusValue | null;
  pending: boolean;
  onPress: (value: ThreadStatusValue) => void;
  /** The desktop popover's tighter rows; the phone keeps its 56px targets. */
  dense?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Thread status"
      onKeyDown={moveRadioFocus}
      className="flex flex-col"
    >
      {THREAD_STATUS_OPTIONS.map((option, index) => {
        const selected = option.value === current;
        const tabStop = current === null ? index === 0 : selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabStop ? 0 : -1}
            aria-disabled={pending}
            onClick={() => {
              if (!pending) onPress(option.value);
            }}
            className={cn(
              'v2-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm',
              dense ? 'min-h-11' : 'min-h-14',
              'transition-colors duration-150 motion-reduce:transition-none',
              selected ? 'bg-secondary' : 'hover:bg-secondary/60',
              pending && 'opacity-60',
              FOCUS_RING,
            )}
          >
            <ThreadStatusDot value={option.value} className="size-2" />
            <span className="min-w-0 flex-1">
              <OptionText option={option} />
            </span>
            {selected && <Check aria-hidden className="size-4 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The desktop control: a shadcn `Popover`, not a menu (checker, 16 October
 * 2026). The Needs Action step is a form, and a form inside `role="menu"` is
 * invalid ARIA; worse, Radix's menu content swallowed Tab once Enter had
 * unmounted the focused item, so the step could not be reached by keyboard.
 * The popover is modal, so Tab wraps inside it, and Escape closes it. Its
 * first view is the status radio group; choosing Needs Action swaps the body
 * to the step, which takes focus itself (see `NeedsActionStep`).
 */
function StatusMenu({ threadUuid, parentUuid, viewerId, status, quiet, now }: SurfaceProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'list' | 'needs_action'>('list');
  const { choose, error, clearError, pending } = useStatusChoice(
    threadUuid,
    parentUuid,
    status,
    () => setOpen(false),
  );
  const press = optionPress(choose, () => {
    clearError();
    setStep('needs_action');
  });

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          clearError();
          setStep('list');
        }
      }}
    >
      <PopoverTrigger
        className={TRIGGER}
        aria-label={threadStatusTriggerLabel(status, quiet)}
      >
        <TriggerFace status={status} quiet={quiet} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={step === 'needs_action' ? 'Needs Action' : 'Status'}
        className="w-80 gap-0 p-1"
      >
        {step === 'needs_action' ? (
          <NeedsActionStep
            parentUuid={parentUuid}
            viewerId={viewerId}
            initialPerson={status?.needs_action_from ?? null}
            initialNote={status?.value === 'needs_action' ? status.note : null}
            pending={pending}
            error={error}
            onBack={() => {
              clearError();
              setStep('list');
            }}
            onSave={saveNeedsAction(choose)}
          />
        ) : (
          <>
            <p className="px-3 py-2 text-xs text-muted-foreground">Status</p>
            <StatusRadioGroup
              current={status?.value ?? null}
              pending={pending}
              onPress={press}
              dense
            />
            {(status || error) && <div className="mx-1 my-1 h-px bg-border" />}
            <StatusFooter status={status} now={now} error={error} />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatusSheet({ threadUuid, parentUuid, viewerId, status, quiet, now }: SurfaceProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'list' | 'needs_action'>('list');
  const { choose, error, clearError, pending } = useStatusChoice(
    threadUuid,
    parentUuid,
    status,
    () => setOpen(false),
  );
  const press = optionPress(choose, () => {
    clearError();
    setStep('needs_action');
  });

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={threadStatusTriggerLabel(status, quiet)}
        onClick={() => {
          clearError();
          setStep('list');
          setOpen(true);
        }}
        className={TRIGGER_COMPACT}
      >
        <TriggerFace status={status} quiet={quiet} compact />
      </button>
      <PhoneNote status={status} />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="v2-safe-bottom rounded-t-2xl">
          <SheetHeader className="pb-0">
            <SheetTitle>
              {step === 'needs_action' ? 'Needs Action' : 'Status'}
            </SheetTitle>
          </SheetHeader>
          {step === 'needs_action' ? (
            <div className="px-3 pb-3">
              <NeedsActionStep
                parentUuid={parentUuid}
                viewerId={viewerId}
                initialPerson={status?.needs_action_from ?? null}
                initialNote={status?.value === 'needs_action' ? status.note : null}
                pending={pending}
                error={error}
                onBack={() => {
                  clearError();
                  setStep('list');
                }}
                onSave={saveNeedsAction(choose)}
              />
            </div>
          ) : (
            <div className="flex flex-col px-2 pb-2">
              <StatusRadioGroup
                current={status?.value ?? null}
                pending={pending}
                onPress={press}
              />
              {(status || error) && <div className="mx-1 my-1 h-px bg-border" />}
              <StatusFooter status={status} now={now} error={error} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
