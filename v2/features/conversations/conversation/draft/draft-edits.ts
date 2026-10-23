import type { JSONContent } from '@tiptap/core';

/**
 * draft-edits — what the reader has changed in a draft, kept while the app
 * stays open, so closing the panel and opening it again (or opening another
 * draft and coming back) does not throw the edits away. Keyed by chat and the
 * draft's place (`?side=draft:N`).
 *
 * In memory only, for this piece: Save as note (the next piece) is where a
 * draft is kept for good.
 */

const edits = new Map<string, JSONContent>();

function key(conversationId: string, ordinal: number): string {
  return `${conversationId}:${ordinal}`;
}

export function readDraftEdit(conversationId: string, ordinal: number): JSONContent | undefined {
  return edits.get(key(conversationId, ordinal));
}

export function writeDraftEdit(conversationId: string, ordinal: number, doc: JSONContent): void {
  edits.set(key(conversationId, ordinal), doc);
}
