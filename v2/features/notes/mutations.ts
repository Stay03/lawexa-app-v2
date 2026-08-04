'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useV2Session } from '@/v2/runtime/session-context';
import { notesApi } from './api';
import { notesQueries } from './queries';
import type { NoteEnvelope, NoteImageUpload, NoteRecord } from './types';
import {
  createInputFor,
  updateInputFor,
  type SaveRequest,
} from './editor/autosave-machine';

/**
 * mutations.ts — every WRITE a note surface performs: the autosave, the delete,
 * and the two file calls that go with embedded images.
 *
 * ── WRITE, DON'T INVALIDATE (the editor's central cache rule) ───────────────
 * A save's response IS the note. `useSaveNote` puts that envelope straight into
 * BOTH detail caches — `detail({slug})` (the reader's address) and `byId({id})`
 * (the editor's rename-proof one) — and invalidates neither. Invalidating the
 * editor's own entry mid-typing would refetch the note the reader is in the
 * middle of writing and repaint the screen from the network, which is the one
 * thing an autosaving editor must never do. The LISTS are a different matter: a
 * save changes a row's title, preview and timestamp, and no cache writer here
 * can fabricate the server's ordering — so they go through `meta.invalidates`,
 * the house's one invalidation channel. That costs nothing while the editor is
 * open, because a list nobody is looking at is only marked stale.
 *
 * ── SILENT BY DESIGN ───────────────────────────────────────────────────────
 * `useSaveNote` sets `meta.silentError`. Autosave failures are reported by a
 * quiet inline chip beside the title with a real retry, because a save that
 * fires every 1.5 seconds cannot be allowed to raise toasts — an offline reader
 * would be buried in them. Delete keeps the global toast: it is a deliberate,
 * one-off act whose failure the reader must be told about.
 *
 * Always `mutate`, never `mutateAsync` (standards §2).
 */

/**
 * The autosave write. One mutation for create AND update, because they are the
 * same intention at two points in a note's life and splitting them would put the
 * transition in the caller instead of in {@link SaveRequest}.
 *
 * `scope` SERIALISES saves for one editing session, so TanStack could never run
 * two at once even if the machine's single-flight rule were bypassed. The scope
 * id is the note id once one exists and the client draft id before that — the
 * same editor, the same queue, across the create.
 */
export function useSaveNote(scopeId: string) {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();

  return useMutation<NoteEnvelope, Error, SaveRequest>({
    mutationFn: (request) =>
      request.mode === 'create'
        ? notesApi.create(createInputFor(request.draft))
        : notesApi.update(request.noteId, updateInputFor(request.draft)),
    scope: { id: `note-save-${scopeId}` },
    meta: {
      silentError: true,
      invalidates: [notesQueries.lists()],
    },
    onSuccess: (envelope) => {
      writeNoteEverywhere(queryClient, viewerId, envelope);
    },
  });
}

/**
 * Put a fresh envelope into both detail caches. Exported so the edit route can
 * seed `byId` from the slug fetch it already made, rather than paying a second
 * request for the same note under a different key.
 */
export function writeNoteEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  viewerId: number | null,
  envelope: NoteEnvelope,
): void {
  const record = envelope.data;
  queryClient.setQueryData(
    notesQueries.byId({ id: record.id, viewerId }).queryKey,
    envelope,
  );
  queryClient.setQueryData(
    notesQueries.detail({ slug: record.slug, viewerId }).queryKey,
    envelope,
  );
}

/**
 * Delete the note (soft, server-side). Both detail entries are REMOVED rather
 * than patched: there is no truthful value to leave behind, and a stale entry
 * would paint the note for a beat if anything navigated to it before the lists
 * settled. Deleting a note deliberately does NOT delete its uploaded images —
 * that is the backend's documented behaviour, not an omission here.
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();

  return useMutation<
    { success: boolean; message: string },
    Error,
    Pick<NoteRecord, 'id' | 'slug'>
  >({
    mutationFn: (note) => notesApi.remove(note.id),
    meta: { invalidates: [notesQueries.lists()] },
    onSuccess: (_result, note) => {
      queryClient.removeQueries({
        queryKey: notesQueries.byId({ id: note.id, viewerId }).queryKey,
      });
      queryClient.removeQueries({
        queryKey: notesQueries.detail({ slug: note.slug, viewerId }).queryKey,
      });
    },
  });
}

/**
 * Upload an image for embedding. Silent: the editor shows its own inline
 * progress and its own inline failure right where the image was going to land,
 * which is more useful than a toast in the corner.
 */
export function useUploadNoteImage() {
  return useMutation<NoteImageUpload, Error, File>({
    mutationFn: (file) => notesApi.uploadImage(file),
    meta: { silentError: true },
  });
}

/**
 * Best-effort cleanup for an image uploaded in THIS session and then removed
 * before it was ever part of a successful save — the only case where we know
 * for certain that no saved note references it.
 *
 * Silent and consequence-free by design: the reader did not ask for this, so a
 * failure must not interrupt them. The worst outcome is an orphaned file, which
 * is exactly what happens today with no cleanup at all.
 */
export function useDeleteNoteFile() {
  return useMutation<{ success: boolean; message: string }, Error, number>({
    mutationFn: (fileId) => notesApi.deleteFile(fileId),
    meta: { silentError: true },
  });
}
