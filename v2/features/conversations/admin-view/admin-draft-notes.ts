import { apiClient } from '@/lib/api/client';
import { notesQueries } from '@/v2/features/notes/queries';
import type {
  DraftNotesEnvelope,
  NoteEnvelope,
  NoteRevisionEnvelope,
  NoteRevisionsEnvelope,
} from '@/v2/features/notes/types';
import type { DraftNotesSource } from '../conversation/draft/draft-notes-source';

/**
 * The admin conversation view's read of a chat's drafts as notes (Backend
 * 7b74631e and the note reads after it; Stay, thread 085a980c, 26 November
 * 2026: "like for like as user side").
 *
 * The same shapes as the owner's routes, read as the owner, with `can_edit`
 * false on every row, so the draft panel opens the owner's note read only.
 * None of these reads records a view or an activity line, makes a note, moves
 * one to a newer version or adds a revision: the admin view is a snapshot
 * that changes nothing. The owner's by-id open would count a view under the
 * staff member, which is why the note itself is read here too.
 *
 * A Space chat answers 404 and a confidential chat lists nothing, as the rest
 * of the admin view.
 */
const base = (conversationId: string) => `/admin/conversations/${encodeURIComponent(conversationId)}/draft-notes`;

export const adminDraftNotesApi = {
  list: async (conversationId: string): Promise<DraftNotesEnvelope> =>
    (await apiClient.get<DraftNotesEnvelope>(base(conversationId))).data,
  note: async (conversationId: string, noteId: number): Promise<NoteEnvelope> =>
    (await apiClient.get<NoteEnvelope>(`${base(conversationId)}/${noteId}`)).data,
  revisions: async (conversationId: string, noteId: number, page = 1): Promise<NoteRevisionsEnvelope> =>
    (await apiClient.get<NoteRevisionsEnvelope>(`${base(conversationId)}/${noteId}/revisions`, { params: { page } })).data,
  revision: async (conversationId: string, noteId: number, revision: number): Promise<NoteRevisionEnvelope> =>
    (await apiClient.get<NoteRevisionEnvelope>(`${base(conversationId)}/${noteId}/revisions/${revision}`)).data,
};

/**
 * The draft notes' source for one chat in the admin view: the owner's query
 * keys and timings (the admin view has its own query client, so they cannot
 * meet the staff member's own notes), fetched from the admin routes.
 */
export function adminDraftNotesSource(conversationId: string): DraftNotesSource {
  return {
    conversationId,
    readOnly: true,
    draftNotes: (args) => ({ ...notesQueries.draftNotes(args), queryFn: () => adminDraftNotesApi.list(conversationId) }),
    draftNoteOpen: (args) => ({ ...notesQueries.draftNoteOpen(args), queryFn: () => adminDraftNotesApi.note(conversationId, args.id) }),
    revisions: (args) => ({
      ...notesQueries.revisions(args),
      queryFn: () => adminDraftNotesApi.revisions(conversationId, args.id, args.page),
    }),
    revision: (args) => ({
      ...notesQueries.revision(args),
      queryFn: () => adminDraftNotesApi.revision(conversationId, args.id, args.revision),
    }),
  };
}
