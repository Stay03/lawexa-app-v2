'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useV2Session } from '@/v2/runtime/session-context';
import { notesApi } from '@/v2/features/notes/api';
import { writeNoteEverywhere } from '@/v2/features/notes/mutations';
import { notesQueries } from '@/v2/features/notes/queries';
import type { NoteEnvelope } from '@/v2/features/notes/types';
import { readSavedDraftNote, writeSavedDraftNote } from './draft-edits';

/**
 * useSaveDraftNote — Save as note, from the draft panel (the draft editor,
 * Stay 23 October 2026). The first save makes a note in My notes, private as
 * every new note is (`POST /notes`); a later save from the same draft updates
 * that note (`PUT /notes/{id}`), sending the copy's `updated_at` so a newer
 * edit made on the note page is never overwritten (the API answers 409).
 *
 * The note's HTML is the editor's own, so its fonts travel as the agreed
 * spans and the server keeps them (backend 9051f52a). The notes lists are
 * refetched, and the note's detail caches take the saved copy, so Open note
 * shows it at once.
 */
export function useSaveDraftNote(conversationId: string, ordinal: number) {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();

  return useMutation<NoteEnvelope, Error, { title: string; html: string }>({
    mutationFn: ({ title, html }) => {
      const saved = readSavedDraftNote(conversationId, ordinal);
      const cleanTitle = title.trim() || null;
      return saved
        ? notesApi.update(saved.id, { title: cleanTitle, content: html, base_updated_at: saved.updatedAt })
        : notesApi.create({ title: cleanTitle, content: html });
    },
    // One draft saves one at a time, so a quick second press cannot make two notes.
    scope: { id: `draft-note-${conversationId}-${ordinal}` },
    meta: { silentError: true, invalidates: [notesQueries.lists()] },
    onSuccess: (envelope) => {
      const note = envelope.data;
      writeSavedDraftNote(conversationId, ordinal, {
        id: note.id,
        slug: note.slug,
        updatedAt: note.updated_at ?? new Date().toISOString(),
      });
      writeNoteEverywhere(queryClient, viewerId, envelope);
    },
  });
}
