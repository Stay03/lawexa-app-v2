'use client';

import { useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ThreadStatus, ThreadStatusValue } from '@/types/collab';
import {
  ThreadStatusChip,
  ThreadStatusDot,
} from '@/v2/features/collab/kit/ThreadStatusChip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  THREAD_STATUS_OPTIONS,
  isSameThreadStatus,
  isThreadStatusValue,
  nextRadioIndex,
  threadStatusErrorText,
  threadStatusFooter,
  threadStatusQuiet,
  threadStatusTriggerLabel,
  type ThreadStatusOption,
} from '../thread-status-model';
import { useMinuteNow } from '../use-minute-now';
import { useSetThreadStatus } from './mutations';

/**
 * ThreadStatusControl — a thread's status in its header, and the way to set it
 * (Stay, 15-16 October 2026: thread status, "locked in" from the mock's
 * option B).
 *
 * ── WHO GETS A BUTTON ──────────────────────────────────────────────────────
 * The PATCH is authorized like posting (`403` for anyone who cannot post), so
 * the button is offered on the thread's own can-post ruling, `canSet`, and on
 * nothing else. Everyone else sees the chip alone, or nothing when there is no
 * status.
 *
 * ── ONE CONTROL, TWO SURFACES ──────────────────────────────────────────────
 * `surface="menu"` opens a shadcn `DropdownMenu` beside the name on a wide
 * pane; `surface="sheet"` opens a bottom sheet on a phone, the channel
 * screen's own pattern for phone choices (`MessageActionsSheet`). The header
 * mounts one of each and shows exactly one by breakpoint, the two-triggers
 * idiom it already uses, so no media query runs in render.
 *
 * ── THE SURFACE STAYS OPEN UNTIL THE SERVER ANSWERS ────────────────────────
 * The choice is optimistic: the tick and the chip move on the press. The menu
 * or sheet closes on success. On a refusal the thread is re-read and the
 * server's sentence shows inside the surface, where the press was, with no
 * toast. A reader who dismisses the surface first still sees the chip go back.
 * Picking the status the thread already has only closes the surface.
 *
 * The note is read-only in this first pass: there is no note field, but a note
 * the server holds is shown under the footer.
 */
export function ThreadStatusControl({
  threadUuid,
  parentUuid,
  status,
  lastMessageAt,
  canSet,
  surface,
}: {
  threadUuid: string;
  parentUuid: string | null;
  /** The thread's status; the caller mounts this only when the field exists. */
  status: ThreadStatus | null;
  lastMessageAt: string | null;
  canSet: boolean;
  surface: 'menu' | 'sheet';
}) {
  const now = useMinuteNow();
  const quiet = threadStatusQuiet({ status, last_message_at: lastMessageAt }, now);

  if (!canSet) {
    // The prefix says what the chip is to a screen reader; sighted readers
    // have the header around it.
    return status ? (
      <span className="inline-flex shrink-0 items-center">
        <span className="sr-only">Status: </span>
        <ThreadStatusChip size="md" value={status.value} quiet={quiet} />
      </span>
    ) : null;
  }

  return surface === 'menu' ? (
    <StatusMenu
      threadUuid={threadUuid}
      parentUuid={parentUuid}
      status={status}
      quiet={quiet}
      now={now}
    />
  ) : (
    <StatusSheet
      threadUuid={threadUuid}
      parentUuid={parentUuid}
      status={status}
      quiet={quiet}
      now={now}
    />
  );
}

interface SurfaceProps {
  threadUuid: string;
  parentUuid: string | null;
  status: ThreadStatus | null;
  quiet: string | null;
  now: number;
}

/** The menu's value for "No status"; a radio group needs a string. */
const NONE = 'none';

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

  const choose = (next: ThreadStatusValue | null) => {
    // Picking the status it already has changes nothing, so it sends nothing
    // and writes no "Set to … · just now" for a change nobody made.
    if (isSameThreadStatus(next, status)) {
      close();
      return;
    }
    setError(null);
    mutation.mutate(
      {
        status: next,
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

/** The trigger: the chip plus a chevron, or a quiet "Set status". */
function TriggerFace({
  status,
  quiet,
}: {
  status: ThreadStatus | null;
  quiet: string | null;
}) {
  return status ? (
    <>
      <ThreadStatusChip size="md" value={status.value} quiet={quiet} />
      <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
    </>
  ) : (
    <>
      <span className="text-xs font-medium text-muted-foreground">Set status</span>
      <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
    </>
  );
}

const TRIGGER = cn(
  'v2-interactive inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full pr-1.5',
  'transition-colors duration-150 hover:bg-secondary/60 motion-reduce:transition-none',
  FOCUS_RING,
);

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

/** The leading mark of one option: the status dot, or a hollow ring for none. */
function OptionMark({ value }: { value: ThreadStatusValue | null }) {
  return value === null ? (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full border border-muted-foreground/70"
    />
  ) : (
    <ThreadStatusDot value={value} className="size-2" />
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

function StatusMenu({ threadUuid, parentUuid, status, quiet, now }: SurfaceProps) {
  const [open, setOpen] = useState(false);
  const { choose, error, clearError, pending } = useStatusChoice(
    threadUuid,
    parentUuid,
    status,
    () => setOpen(false),
  );

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) clearError();
      }}
    >
      <DropdownMenuTrigger
        className={TRIGGER}
        aria-label={threadStatusTriggerLabel(status, quiet)}
      >
        <TriggerFace status={status} quiet={quiet} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={status?.value ?? NONE}
          onValueChange={(next) => choose(isThreadStatusValue(next) ? next : null)}
        >
          {THREAD_STATUS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value ?? NONE}
              value={option.value ?? NONE}
              disabled={pending}
              // Held open: the surface closes when the server agrees, and a
              // refusal is shown inside it (see the docblock).
              onSelect={(event) => event.preventDefault()}
              className="items-start"
            >
              <span className="mt-1.5 flex">
                <OptionMark value={option.value} />
              </span>
              <OptionText option={option} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {(status || error) && <DropdownMenuSeparator />}
        <StatusFooter status={status} now={now} error={error} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusSheet({ threadUuid, parentUuid, status, quiet, now }: SurfaceProps) {
  const [open, setOpen] = useState(false);
  const { choose, error, clearError, pending } = useStatusChoice(
    threadUuid,
    parentUuid,
    status,
    () => setOpen(false),
  );
  const current = status?.value ?? null;

  /* A REAL RADIO GROUP: one tab stop (the checked option), ArrowUp/ArrowDown
     move focus and wrap, Home/End jump. Arrows move FOCUS ONLY. Choosing sends
     a request, so it stays on tap, Enter and Space, never on an arrow press.
     The options are read off the group in the handler, never in render. */
  const onRadioKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    if (radios.length === 0) return;
    event.preventDefault();
    const at = radios.findIndex((radio) => radio === document.activeElement);
    const target = nextRadioIndex(event.key, at, radios.length);
    radios[target]?.focus();
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={threadStatusTriggerLabel(status, quiet)}
        onClick={() => {
          clearError();
          setOpen(true);
        }}
        className={TRIGGER}
      >
        <TriggerFace status={status} quiet={quiet} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="v2-safe-bottom rounded-t-2xl">
          <SheetHeader className="pb-0">
            <SheetTitle>Status</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col px-2 pb-2">
            <div
              role="radiogroup"
              aria-label="Thread status"
              onKeyDown={onRadioKeyDown}
              className="flex flex-col"
            >
              {THREAD_STATUS_OPTIONS.map((option) => {
                const selected = option.value === current;
                return (
                  <button
                    key={option.value ?? NONE}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    // Roving tab stop: the checked option alone is in the tab
                    // order. `aria-disabled`, not `disabled`, while a request
                    // is out, so focus is not thrown off the option it is on.
                    tabIndex={selected ? 0 : -1}
                    aria-disabled={pending}
                    onClick={() => {
                      if (!pending) choose(option.value);
                    }}
                    className={cn(
                      'v2-interactive flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      selected ? 'bg-secondary' : 'hover:bg-secondary/60',
                      pending && 'opacity-60',
                      FOCUS_RING,
                    )}
                  >
                    <OptionMark value={option.value} />
                    <span className="min-w-0 flex-1">
                      <OptionText option={option} />
                    </span>
                    {selected && (
                      <Check aria-hidden className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
            {(status || error) && <div className="mx-1 my-1 h-px bg-border" />}
            <StatusFooter status={status} now={now} error={error} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
