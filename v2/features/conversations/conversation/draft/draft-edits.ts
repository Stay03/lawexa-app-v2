import type { JSONContent } from '@tiptap/core';

/**
 * draft-edits — the reader's edits to a draft in a chat that keeps no draft
 * notes (a confidential chat, which keeps nothing on the server; a Radar
 * report, for now), kept in the page's memory while the app stays open,
 * keyed by chat and the draft's place (`?side=draft:N`), so closing the panel
 * and opening it again does not throw them away. Every other draft is a
 * note, and its edits autosave into it (DraftEditor.tsx).
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
