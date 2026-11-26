'use client';

import { createContext, useContext } from 'react';

import { notesQueries } from '@/v2/features/notes/queries';

/**
 * Where a chat's drafts-as-notes are read from (the draft cards, the draft
 * panel, its history).
 *
 * The owner's chat page reads its own routes (`notesQueries`) and knows the
 * chat from its chat context. The admin conversation view (Stay, thread
 * 085a980c, 26 November 2026: "like for like as user side") has no chat
 * context, on purpose (nothing in it may send), and reads the same facts
 * through the admin routes (Backend 7b74631e): the chat it names here, and
 * builders that keep the owner's query keys and shapes (the admin view keeps
 * its own query client) but fetch from the admin routes. Every row there says
 * `can_edit: false`, so the panel opens the owner's note read only, as it does
 * for any reader who may not edit it.
 *
 * `readOnly` also takes away what no `can_edit` covers: restoring an older
 * version from the history.
 */
export interface DraftNotesSource {
  /** The chat whose drafts these are, where no chat context names it; `null` to use the chat context's. */
  conversationId: string | null;
  /** Nothing here writes: no restore from the history (the editor is read only by `can_edit`). */
  readOnly: boolean;
  draftNotes: typeof notesQueries.draftNotes;
  draftNoteOpen: typeof notesQueries.draftNoteOpen;
  revisions: typeof notesQueries.revisions;
  revision: typeof notesQueries.revision;
}

/** The owner's own routes: every chat page. */
export const OWNER_DRAFT_NOTES: DraftNotesSource = {
  conversationId: null,
  readOnly: false,
  draftNotes: notesQueries.draftNotes,
  draftNoteOpen: notesQueries.draftNoteOpen,
  revisions: notesQueries.revisions,
  revision: notesQueries.revision,
};

const DraftNotesSourceContext = createContext<DraftNotesSource>(OWNER_DRAFT_NOTES);

export const DraftNotesSourceProvider = DraftNotesSourceContext.Provider;

/** Where this chat's draft notes are read from: the owner's routes unless a page says otherwise. */
export function useDraftNotesSource(): DraftNotesSource {
  return useContext(DraftNotesSourceContext);
}
