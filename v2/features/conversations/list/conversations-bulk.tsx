'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Blocks, Lock, Trash2 } from 'lucide-react';

import type { ConversationListItem } from '@/types/chat';
import { bulkApi } from '@/v2/features/bulk/api';
import { BulkBar, BulkBarAction } from '@/v2/features/bulk/BulkBar';
import { BulkConfirm } from '@/v2/features/bulk/BulkConfirm';
import { countOf, type BulkItemId, type BulkResult } from '@/v2/features/bulk/model';
import { useBulkAction, useBulkSelection } from '@/v2/features/bulk/use-bulk-selection';
import { MoveToSpaceDialog } from '@/v2/features/spaces/move/MoveToSpaceDialog';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { conversationsCache } from '../cache';
import { conversationsQueries } from '../queries';
import { conversationsBulkActions, isBulkSelectable } from './conversations-bulk-model';

/**
 * Bulk select on the chats list (Arthur, 20 October 2026; part 2 with My
 * notes): the reader's own chats, ticked together. A confidential chat is not
 * ticked (`isBulkSelectable`). The actions follow what is ticked
 * (`conversationsBulkActions`): Move to a space, Make private, Delete.
 *
 * One bulk request per action (`POST /bulk/conversations`), 50 chats at a
 * time; the answer is told as one sentence, and the chats that failed stay
 * ticked. Delete asks first, with the count.
 */

const NOUN = { one: 'chat', many: 'chats' };

type Dialog = 'delete' | 'space' | null;

/** The ids the server answered yes for. */
const doneIds = (result: BulkResult): string[] =>
  result.results.filter((item) => item.ok && typeof item.id === 'string').map((item) => item.id as string);

export function useConversationsBulk({ rows }: { rows: readonly ConversationListItem[] }) {
  const selectable = useMemo(() => rows.filter(isBulkSelectable), [rows]);
  const keys = useMemo(() => selectable.map((row) => row.id), [selectable]);
  const select = useBulkSelection<string>(keys);
  const [dialog, setDialog] = useState<Dialog>(null);
  const queryClient = useQueryClient();

  const ticked = [...select.selection];
  const byId = new Map(selectable.map((row) => [row.id, row]));
  const offered = new Set(
    conversationsBulkActions(ticked.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    })),
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: conversationsQueries.lists() });
    void queryClient.invalidateQueries({ queryKey: spacesQueries.all });
  };
  const keepFailed = (ids: ReadonlyArray<BulkItemId>) =>
    select.keepOnly(ids.filter((id): id is string => typeof id === 'string'));

  const remove = useBulkAction({ verb: { past: 'Deleted', pastLower: 'deleted' }, noun: NOUN, onSettled: refresh, keepFailed });
  const toSpace = useBulkAction({ verb: { past: 'Moved', pastLower: 'moved' }, noun: NOUN, onSettled: refresh, keepFailed });
  const privacy = useBulkAction({ verb: { past: 'Made', pastLower: 'made private', after: 'private' }, noun: NOUN, onSettled: refresh, keepFailed });
  const busy = remove.isPending || toSpace.isPending || privacy.isPending;
  const off = select.count === 0 || busy;

  const startButton = useCallback(
    (className: string): ReactNode => (
      <button type="button" onClick={select.start} className={className}>
        Select
      </button>
    ),
    [select.start],
  );

  const bar = select.active ? (
    <BulkBar
      count={select.count}
      total={keys.length}
      allState={select.allState}
      onToggleAll={select.toggleAll}
      onDone={select.stop}
      noun={NOUN}
    >
      {offered.has('space') ? (
        <BulkBarAction icon={Blocks} label="Move to a space" disabled={off} onClick={() => setDialog('space')} />
      ) : null}
      {offered.has('make_private') ? (
        <BulkBarAction
          icon={Lock}
          label="Make private"
          disabled={off}
          onClick={() =>
            privacy.mutate(() => bulkApi.conversations(ticked, { action: 'make_private' }), {
              // In place, as the share dialog writes it: a visibility change is not a message.
              onSuccess: (result) => {
                for (const id of doneIds(result)) conversationsCache.setVisibility(queryClient, id, true);
              },
            })
          }
        />
      ) : null}
      {offered.has('delete') ? (
        <BulkBarAction icon={Trash2} label="Delete" destructive disabled={off} onClick={() => setDialog('delete')} />
      ) : null}
    </BulkBar>
  ) : null;

  const dialogs = (
    <>
      <BulkConfirm
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        title={`Delete ${countOf(select.count, NOUN)}?`}
        description="The chats and their answers will be removed for good, and anyone they were shared with loses them."
        confirmLabel="Delete"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(() => bulkApi.conversations(ticked, { action: 'delete' }), {
            // As the one-chat delete does: out of every list now, and the
            // transcripts dropped rather than refetched (they no longer exist).
            onSuccess: (result) => {
              for (const id of doneIds(result)) {
                conversationsCache.remove(queryClient, id);
                queryClient.removeQueries({ queryKey: [...conversationsQueries.details(), id] });
              }
            },
            onSettled: () => setDialog(null),
          })
        }
      />
      {dialog === 'space' ? (
        <MoveToSpaceDialog
          item={{ type: 'conversation', id: '', name: '', space: null }}
          open
          onOpenChange={(open) => (open ? undefined : setDialog(null))}
          pick={{
            count: select.count,
            onPick: (to) =>
              toSpace.mutate(() => bulkApi.conversations(ticked, { action: 'space', spaceUuid: to?.uuid ?? null })),
          }}
        />
      ) : null}
    </>
  );

  return {
    selecting: select.active,
    isSelected: select.isSelected,
    toggle: select.toggle,
    hasSelectable: keys.length > 0,
    startButton,
    bar,
    dialogs,
  };
}
