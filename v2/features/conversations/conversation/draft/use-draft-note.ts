'use client';

import { useQuery } from '@tanstack/react-query';

import { useV2Session } from '@/v2/runtime/session-context';
import { notesApi } from '@/v2/features/notes/api';
import { notesQueries } from '@/v2/features/notes/queries';
import { writeSavedDraftNote } from './draft-edits';

/**
 * The note a draft was saved as, on any device (`GET /notes/by-draft`), or
 * `null` (Techlead, 24 October 2026: a saved draft reopens from its note, so
 * its fonts and edits are there after a reload and on another device).
 *
 * The answer is written into draft-edits as it arrives, before the editor
 * mounts on it: the save bar then reads "Saved to your notes" with the note's
 * links, and the next Save updates that note on this copy's `updated_at`.
 */
export function useDraftNote(conversationId: string, ordinal: number, enabled: boolean) {
  const { userId: viewerId } = useV2Session();
  return useQuery({
    ...notesQueries.byDraft({ conversationId, draft: ordinal, viewerId }),
    queryFn: async () => {
      const note = await notesApi.byDraft(conversationId, ordinal);
      if (note) {
        writeSavedDraftNote(conversationId, ordinal, {
          id: note.id,
          slug: note.slug,
          updatedAt: note.updated_at ?? note.created_at,
        });
      }
      return note;
    },
    enabled,
  });
}
