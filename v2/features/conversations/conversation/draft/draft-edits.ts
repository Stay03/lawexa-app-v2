import type { JSONContent } from '@tiptap/core';

/**
 * draft-edits — what the reader has done with a draft while the app stays
 * open, keyed by chat and the draft's place (`?side=draft:N`):
 *
 *   - the edited document, so closing the panel and opening it again does not
 *     throw the edits away;
 *   - the note it was saved as, so a second Save updates that note instead of
 *     making another, and the panel can offer Open note and the downloads.
 *
 * In memory: the note itself is the draft kept for good.
 */

export interface SavedDraftNote {
  id: number;
  slug: string;
  /** The saved copy's `updated_at`, sent with the next save so a newer copy
   *  saved elsewhere is not overwritten (the notes API answers 409). */
  updatedAt: string;
}

const edits = new Map<string, JSONContent>();
const saved = new Map<string, SavedDraftNote>();

function key(conversationId: string, ordinal: number): string {
  return `${conversationId}:${ordinal}`;
}

export function readDraftEdit(conversationId: string, ordinal: number): JSONContent | undefined {
  return edits.get(key(conversationId, ordinal));
}

export function writeDraftEdit(conversationId: string, ordinal: number, doc: JSONContent): void {
  edits.set(key(conversationId, ordinal), doc);
}

export function readSavedDraftNote(conversationId: string, ordinal: number): SavedDraftNote | undefined {
  return saved.get(key(conversationId, ordinal));
}

export function writeSavedDraftNote(conversationId: string, ordinal: number, note: SavedDraftNote): void {
  saved.set(key(conversationId, ordinal), note);
}
