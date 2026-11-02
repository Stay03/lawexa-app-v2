import type { NoteRecord } from './types';

/**
 * note-privacy — the mark on a note its owner reads, saying who can open it
 * (techlead's task, 384c 0c312e51; WOZ's contract 4bfea576, 2 November 2026).
 *
 * The server sends `visible_to`, worked out by the same code as its own
 * visibility check, so the mark and who can actually open the note agree:
 *
 *   only_you   a personal note that is a draft, or published and private
 *   space      a Space's note: its active members open it
 *   everyone   a personal note that is published and not private
 *
 * A note Lawexa writes in a chat is published and private, so before this it
 * showed no mark and read as public to its owner. No React, so node:test
 * reads it.
 */
export type NoteVisibleTo = 'only_you' | 'space' | 'everyone';

/**
 * The owner's mark, or null for no mark. Only the owner sees one. A server
 * without `visible_to` keeps the old rule: a note not yet published is a
 * draft only its owner can see.
 */
export function noteOwnerMark(note: Pick<NoteRecord, 'status' | 'visible_to'>, isOwn: boolean): string | null {
  if (!isOwn) return null;
  if (note.visible_to === undefined) {
    return note.status !== 'published' ? 'Draft · only you can see this' : null;
  }
  if (note.visible_to !== 'only_you') return null;
  return note.status === 'published' ? 'Private · only you can see this' : 'Draft · only you can see this';
}
