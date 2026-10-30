import type { DraftNoteDocument } from '@/v2/features/notes/types';

/**
 * The draft the "edited" line's title opens (Stay, 30 October 2026, 02:16Z,
 * thread 1e44eb39; design 9b43f942), by its place in the chat (`?side=draft:N`,
 * the newest version, as the draft card opens it), or `null` when the chat's
 * draft list holds no draft with that note. The line names its note by id
 * (`metadata.note_id`, Backend 5c7ee620), as the list does (`note.id`), so the
 * match is exact whatever the titles.
 */
export function draftOrdinalForLine(
  documents: readonly Pick<DraftNoteDocument, 'latest_ordinal' | 'note'>[] | undefined,
  noteId: number,
): number | null {
  const match = documents?.find((document) => document.note?.id === noteId);
  return match ? match.latest_ordinal : null;
}
