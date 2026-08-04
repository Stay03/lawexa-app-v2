'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookmarksApi } from '@/lib/api/bookmarks';
import type { BookmarkToggleResponse } from '@/types/bookmark';
import { bookmarksQueries } from '@/v2/features/bookmarks/queries';
import { notesQueries } from '../queries';
import {
  restoreNoteBookmarkSnapshot,
  writeNoteBookmarkEverywhere,
} from './cache';

/**
 * useToggleNoteBookmark — save / unsave ONE note, optimistically, everywhere.
 *
 * ── WHY THE NOTES FEATURE CARRIES ITS OWN ───────────────────────────────────
 * `v2/features/bookmarks/BookmarkButton` + `useToggleCaseBookmark` are
 * hard-typed to the CASE caches (`caseId`, `casesQueries`), and the statute
 * library already hit this and answered it the same way — `statutes/bookmark/`
 * is the precedent this module follows file-for-file. The generic
 * `useToggleBookmark` in the bookmarks feature DOES accept `type: 'note'`, but
 * its content-cache dispatch (`writeContentCaches`) has an explicit no-op
 * branch for notes with the comment "when notes and folders are rebuilt they
 * gain a case here" — so pressing it would flip the `/bookmarks` row and leave
 * the note's own reader showing the old star until its next refetch. This is
 * that case, written where the notes caches live.
 *
 * ── THE CONTRACT, IDENTICAL TO THE OTHER TWO ────────────────────────────────
 *  - the variable is the INTENDED NEXT STATE, not "flip what you find", so a
 *    double-tap on a server-side TOGGLE endpoint is idempotent in the cache
 *    and two rapid taps cannot race the display;
 *  - in-flight notes reads are cancelled first, so a response already on the
 *    wire cannot land stale and revert the star;
 *  - the mutation scope is `bookmark-note-{id}` — the SAME string the generic
 *    hook builds (`bookmark-${type}-${contentId}`), so a star pressed here and
 *    the same note's star pressed on the `/bookmarks` page are serialized
 *    against each other by TanStack rather than racing;
 *  - the bookmarks LIST gains or loses a whole row, which is not a field flip
 *    this writer can fabricate, so it invalidates through the global
 *    `meta.invalidates` channel;
 *  - errors restore the snapshot and then ride the global mutation-error
 *    toast — one error channel for every v2 mutation.
 *
 * KNOWN GAP, recorded rather than hacked around: the reverse direction. A star
 * pressed on the `/bookmarks` page still runs the generic hook, whose notes
 * branch writes no notes caches, so an open notes list would not repaint until
 * its own refetch. Closing that is a one-line `note` case in
 * `writeContentCaches` calling {@link writeNoteBookmarkEverywhere} — a file
 * this builder does not own.
 */
export function useToggleNoteBookmark(noteId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    BookmarkToggleResponse,
    Error,
    { next: boolean },
    { snapshot: ReturnType<typeof writeNoteBookmarkEverywhere> }
  >({
    mutationFn: () => bookmarksApi.toggle({ type: 'note', id: noteId }),
    scope: { id: `bookmark-note-${noteId}` },
    meta: { invalidates: [bookmarksQueries.lists()] },
    onMutate: async ({ next }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notesQueries.lists() }),
        queryClient.cancelQueries({ queryKey: notesQueries.details() }),
      ]);
      return { snapshot: writeNoteBookmarkEverywhere(queryClient, noteId, next) };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreNoteBookmarkSnapshot(queryClient, context.snapshot);
    },
  });
}
