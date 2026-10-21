'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookmarkMinus } from 'lucide-react';

import type { BookmarkType } from '@/types/bookmark';
import { bulkApi } from '@/v2/features/bulk/api';
import { BulkBar, BulkBarAction } from '@/v2/features/bulk/BulkBar';
import { BulkConfirm } from '@/v2/features/bulk/BulkConfirm';
import { countOf, type BulkItemId, type BulkResult } from '@/v2/features/bulk/model';
import { useBulkAction, useBulkSelection } from '@/v2/features/bulk/use-bulk-selection';
import { writeStatuteBookmarkEverywhere } from '@/v2/features/statutes/bookmark/cache';
import type { BookmarkRowModel } from '../bookmark-row-model';
import { writeBookmarkEverywhere } from '../cache';
import { removeBookmarkFromLists } from '../list-cache';
import { bookmarksQueries } from '../queries';
import { savedItem, savedKey, type SavedKey } from './bookmarks-bulk-model';

/**
 * Bulk select on Saved (Arthur, 20 October 2026; part 3 with a Space's Files
 * tab): the saved items on the current tab, ticked together, and one action,
 * Remove from Saved. It asks first, with the count, though nothing is deleted:
 * Arthur's rule is a count before any removal.
 *
 * One bulk request (`POST /bulk/bookmarks`), 50 items at a time, each by its
 * kind and its content's id. What the server took out leaves every cached
 * Saved list, and a case's or a statute's star turns off wherever it shows,
 * as the one-item star does; the items that failed stay ticked.
 */

const NOUN = { one: 'item', many: 'items' };

/** The items the server answered yes for: it echoes each `{type, id}` as sent. */
const doneItems = (result: BulkResult): { type: BookmarkType; id: number }[] =>
  result.results.flatMap((item) =>
    item.ok && typeof item.id === 'object' ? [{ type: item.id.type as BookmarkType, id: Number(item.id.id) }] : [],
  );

export function useBookmarksBulk({ rows }: { rows: readonly BookmarkRowModel[] }) {
  const keys = useMemo(() => rows.map(savedKey), [rows]);
  const select = useBulkSelection<SavedKey>(keys);
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  const ticked = [...select.selection];
  const refresh = () => void queryClient.invalidateQueries({ queryKey: bookmarksQueries.lists() });
  const keepFailed = (ids: ReadonlyArray<BulkItemId>) =>
    select.keepOnly(
      ids.flatMap((id) => (typeof id === 'object' ? [`${id.type}:${Number(id.id)}` as SavedKey] : [])),
    );

  const remove = useBulkAction({ verb: { past: 'Removed', pastLower: 'removed' }, noun: NOUN, onSettled: refresh, keepFailed });

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
      <BulkBarAction
        icon={BookmarkMinus}
        label="Remove from Saved"
        destructive
        disabled={select.count === 0 || remove.isPending}
        onClick={() => setConfirming(true)}
      />
    </BulkBar>
  ) : null;

  const dialogs = (
    <BulkConfirm
      open={confirming}
      onOpenChange={setConfirming}
      title={`Remove ${countOf(select.count, NOUN)} from Saved?`}
      description="Nothing is deleted. Each one stays where it is, and you can save it again."
      confirmLabel="Remove"
      pending={remove.isPending}
      onConfirm={() =>
        remove.mutate(() => bulkApi.bookmarks(ticked.map(savedItem)), {
          onSuccess: (result) => {
            for (const { type, id } of doneItems(result)) {
              removeBookmarkFromLists(queryClient, type, id);
              if (type === 'case') writeBookmarkEverywhere(queryClient, id, false);
              if (type === 'statute') writeStatuteBookmarkEverywhere(queryClient, id, false);
            }
          },
          onSettled: () => setConfirming(false),
        })
      }
    />
  );

  return {
    selecting: select.active,
    isSelected: select.isSelected,
    toggle: select.toggle,
    stop: select.stop,
    startButton,
    bar,
    dialogs,
  };
}
