'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, ListChecks, Lock, Send, Trash2, Undo2 } from 'lucide-react';

import { bulkApi } from '@/v2/features/bulk/api';
import { BulkBar, BulkBarAction } from '@/v2/features/bulk/BulkBar';
import { BulkConfirm } from '@/v2/features/bulk/BulkConfirm';
import { countOf, type BulkItemId } from '@/v2/features/bulk/model';
import { useBulkAction, useBulkSelection } from '@/v2/features/bulk/use-bulk-selection';
import type { NoteRowModel } from '../note-row-model';
import { notesQueries } from '../queries';
import { notesBulkActions } from './notes-bulk-model';

/**
 * Bulk select on My notes (Arthur, 20 October 2026; part 2 with chats): the
 * reader's own notes, ticked together. All notes is other people's, so it has
 * no Select. The actions follow what is ticked (`notesBulkActions`):
 *
 *   Publish            drafts
 *   Unpublish          published notes (back to a draft)
 *   Make private / public, Delete   any note
 *
 * One bulk request per action (`POST /bulk/notes`), 50 notes at a time; the
 * answer is told as one sentence, and the notes that failed stay ticked.
 * Delete asks first, with the count.
 */

const NOUN = { one: 'note', many: 'notes' };

export function useNotesBulk({ rows }: { rows: readonly NoteRowModel[] }) {
  const keys = useMemo(() => rows.map((row) => row.id), [rows]);
  const select = useBulkSelection<number>(keys);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const ticked = [...select.selection];
  const statusOf = new Map(rows.map((row) => [row.id, row.status]));
  const offered = new Set(
    notesBulkActions({
      drafts: ticked.filter((id) => statusOf.get(id) === 'draft').length,
      published: ticked.filter((id) => statusOf.get(id) === 'published').length,
      unknown: ticked.filter((id) => statusOf.get(id) === undefined).length,
    }),
  );

  // Every notes list and every open note: a publish or a privacy change shows
  // in the library, the reader and the editor alike.
  const refresh = () => void queryClient.invalidateQueries({ queryKey: notesQueries.all });
  const keepFailed = (ids: ReadonlyArray<BulkItemId>) =>
    select.keepOnly(ids.filter((id): id is number => typeof id === 'number'));

  const remove = useBulkAction({ verb: { past: 'Deleted', pastLower: 'deleted' }, noun: NOUN, onSettled: refresh, keepFailed });
  const publish = useBulkAction({ verb: { past: 'Published', pastLower: 'published' }, noun: NOUN, onSettled: refresh, keepFailed });
  const unpublish = useBulkAction({ verb: { past: 'Unpublished', pastLower: 'unpublished' }, noun: NOUN, onSettled: refresh, keepFailed });
  // Two verbs, so the outcome says which way: "Made 2 notes private."
  const makePrivate = useBulkAction({ verb: { past: 'Made', pastLower: 'made private', after: 'private' }, noun: NOUN, onSettled: refresh, keepFailed });
  const makePublic = useBulkAction({ verb: { past: 'Made', pastLower: 'made public', after: 'public' }, noun: NOUN, onSettled: refresh, keepFailed });
  const busy = remove.isPending || publish.isPending || unpublish.isPending || makePrivate.isPending || makePublic.isPending;
  const off = select.count === 0 || busy;

  // On a phone the button is its icon, so the tabs, Select and New note stay on
  // one line (techlead, 23 October 2026); the word is still read out.
  const startButton = useCallback(
    (className: string): ReactNode => (
      <button type="button" onClick={select.start} className={className}>
        <ListChecks aria-hidden className="size-4 sm:hidden" />
        <span className="max-sm:sr-only">Select</span>
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
      {offered.has('publish') ? (
        <BulkBarAction
          icon={Send}
          label="Publish"
          disabled={off}
          onClick={() => publish.mutate(() => bulkApi.notes(ticked, { action: 'publish' }))}
        />
      ) : null}
      {offered.has('unpublish') ? (
        <BulkBarAction
          icon={Undo2}
          label="Unpublish"
          disabled={off}
          onClick={() => unpublish.mutate(() => bulkApi.notes(ticked, { action: 'unpublish' }))}
        />
      ) : null}
      <BulkBarAction
        icon={Lock}
        label="Make private"
        disabled={off}
        onClick={() => makePrivate.mutate(() => bulkApi.notes(ticked, { action: 'privacy', isPrivate: true }))}
      />
      <BulkBarAction
        icon={Globe}
        label="Make public"
        disabled={off}
        onClick={() => makePublic.mutate(() => bulkApi.notes(ticked, { action: 'privacy', isPrivate: false }))}
      />
      <BulkBarAction icon={Trash2} label="Delete" destructive disabled={off} onClick={() => setConfirmDelete(true)} />
    </BulkBar>
  ) : null;

  const dialogs = (
    <BulkConfirm
      open={confirmDelete}
      onOpenChange={setConfirmDelete}
      title={`Delete ${countOf(select.count, NOUN)}?`}
      description="The notes and everything written in them will be removed from your notes. Images you uploaded into them stay in your files."
      confirmLabel="Delete"
      pending={remove.isPending}
      onConfirm={() =>
        remove.mutate(() => bulkApi.notes(ticked, { action: 'delete' }), { onSettled: () => setConfirmDelete(false) })
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
