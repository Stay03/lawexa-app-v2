import type { DraftNoteDocument } from '@/v2/features/notes/types';

/**
 * The draft the "edited" line's title opens (Stay, 30 October 2026, 02:16Z,
 * thread 1e44eb39; design 9b43f942), by its place in the chat (`?side=draft:N`,
 * the newest version, as the draft card opens it), or `null` when it cannot be
 * told for sure. The line names its note by uuid, which the chat's draft list
 * does not carry, so the draft is found by its note's title: only when exactly
 * one draft of the chat has that title. Two drafts with one title, or a title
 * changed since, leave the title as plain text.
 */
export function draftOrdinalForLine(
  documents: readonly Pick<DraftNoteDocument, 'title' | 'latest_ordinal' | 'note'>[] | undefined,
  draftTitle: string,
): number | null {
  if (!documents) return null;
  const wanted = draftTitle.trim();
  const matches = documents.filter((document) => (document.note?.title ?? document.title).trim() === wanted);
  return matches.length === 1 ? matches[0].latest_ordinal : null;
}
