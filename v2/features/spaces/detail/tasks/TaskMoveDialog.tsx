'use client';

import { useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import type { SpaceTask, SpaceTaskPerson } from '@/types/collab';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSheetSide } from '@/v2/features/cases/cited-by/use-sheet-side';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { useV2Session } from '@/v2/runtime/session-context';
import { spacesQueries } from '../../queries';
import { TASK_STAGE_LABELS } from './task-board-model';
import { ChoiceSelect, FieldBlock } from './TaskBox';
import {
  checkDraft,
  hasErrors,
  personOptions,
  TASK_NOTE_MAX,
  updatePayload,
  type TaskDraft,
  type TaskFieldErrors,
} from './task-sheet-model';
import type { SpaceTaskWritePayload } from '@/types/collab';

/** A drop on Paused or Waiting, waiting for its answer. */
export interface PendingMove {
  task: SpaceTask;
  stage: 'paused' | 'waiting';
  draft: TaskDraft;
}

/**
 * A card dropped on Paused asks why; one dropped on Waiting asks who it waits
 * on (and takes an optional note). The task sheet's own fields and checks, so
 * the two never ask different things (the task box design 1805492d). Cancel
 * leaves the card where it was and sends nothing; Move hands the PATCH and the
 * person picked back to the board, which moves the card at once.
 */
export function TaskMoveDialog({
  spaceUuid,
  pending,
  onCancel,
  onMove,
}: {
  spaceUuid: string;
  pending: PendingMove | null;
  onCancel: () => void;
  onMove: (move: PendingMove, payload: SpaceTaskWritePayload, waitingOn: SpaceTaskPerson | null) => void;
}) {
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className={cn('sm:max-w-md', COLLAB_DIALOG_SURFACE)}>
        {pending ? (
          // Keyed by the drop, so each one starts from its own empty answer.
          <MoveForm key={`${pending.task.uuid}:${pending.stage}`} spaceUuid={spaceUuid} pending={pending} onCancel={onCancel} onMove={onMove} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MoveForm({
  spaceUuid,
  pending,
  onCancel,
  onMove,
}: {
  spaceUuid: string;
  pending: PendingMove;
  onCancel: () => void;
  onMove: (move: PendingMove, payload: SpaceTaskWritePayload, waitingOn: SpaceTaskPerson | null) => void;
}) {
  const uid = useId();
  const { userId: viewerId } = useV2Session();
  const native = useSheetSide() === 'bottom';
  const [draft, setDraft] = useState<TaskDraft>(pending.draft);
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const waiting = pending.stage === 'waiting';
  const membersQuery = useQuery({ ...spacesQueries.allMembers(spaceUuid, { viewerId }), enabled: waiting });
  // Anyone in the space may be waited on, as in the sheet.
  const people = useMemo(
    () => personOptions(membersQuery.data ?? [], [pending.task.waiting_on], { movers: false }),
    [membersQuery.data, pending.task.waiting_on],
  );

  const submit = () => {
    const found = checkDraft(draft);
    setErrors(found);
    if (hasErrors(found)) return;
    const payload = updatePayload(draft, pending.task);
    if (!payload) return onCancel();
    const person = waiting ? (membersQuery.data ?? []).find((member) => member.user.uuid === draft.waitingOn)?.user : undefined;
    onMove(
      pending,
      payload,
      // Only for the card shown at once; the server's answer replaces it.
      person ? { uuid: person.uuid, name: person.name, username: person.username ?? null, avatar_url: null, is_agent: false } : null,
    );
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>Move to {TASK_STAGE_LABELS[pending.stage]}</DialogTitle>
        <DialogDescription className="line-clamp-2">“{pending.task.title}”</DialogDescription>
      </DialogHeader>

      {waiting ? (
        <FieldBlock label="Waiting on" htmlFor={`${uid}-waiting`} error={errors.waiting_on} errorId={`${uid}-waiting-error`}>
          <ChoiceSelect
            id={`${uid}-waiting`}
            native={native}
            value={draft.waitingOn}
            options={people}
            emptyLabel={null}
            placeholder={membersQuery.isPending ? 'Loading people…' : 'Choose a person'}
            invalid={!!errors.waiting_on}
            describedBy={errors.waiting_on ? `${uid}-waiting-error` : undefined}
            onChange={(value) => {
              setDraft((current) => ({ ...current, waitingOn: value }));
              setErrors((current) => ({ ...current, waiting_on: undefined }));
            }}
          />
        </FieldBlock>
      ) : null}

      <FieldBlock
        label={waiting ? 'Note (optional)' : 'Why is it paused?'}
        htmlFor={`${uid}-note`}
        error={errors.stage_note}
        errorId={`${uid}-note-error`}
      >
        <Input
          id={`${uid}-note`}
          // Paused asks for its reason at once; Waiting starts on the person.
          autoFocus={!waiting}
          value={draft.stageNote}
          onChange={(event) => {
            setDraft((current) => ({ ...current, stageNote: event.target.value }));
            setErrors((current) => ({ ...current, stage_note: undefined }));
          }}
          maxLength={TASK_NOTE_MAX}
          placeholder={waiting ? 'A or B for the header' : 'Switched to the failed-answer fix'}
          autoComplete="off"
          aria-invalid={!!errors.stage_note || undefined}
          aria-describedby={errors.stage_note ? `${uid}-note-error` : undefined}
        />
      </FieldBlock>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Move</Button>
      </DialogFooter>
    </form>
  );
}
