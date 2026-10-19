import type { NoteRecord } from './types';

/**
 * A Space's copy of a note, read from `NoteResource` (backend cf1fcc72, Stay
 * 18 October 2026): a note filed into a Space folder is copied, the copy
 * belongs to the Space, and the original stays its author's.
 *
 *  - Who edits a copy is the server's answer, `can_edit`: the Space's Owner
 *    and its Contributors, the member who added it among them only while
 *    they still are one. For any other note the author edits, as before.
 *  - A copy stays private to the Space. The server refuses to publish it,
 *    make it public or price it (a 422, "A Space note stays private to the
 *    Space."), so no copy shows those controls.
 *  - `copied_from` reaches the original's owner only; anyone else gets
 *    `null`, so a private original's name never reaches the Space.
 */

/** The Space a note is a copy for, or `null` for every other note. */
export function noteSpace(note: Pick<NoteRecord, 'is_space_copy' | 'space'>): { uuid: string; name: string } | null {
  return note.is_space_copy === true && note.space ? note.space : null;
}

/**
 * Whether this viewer may edit the note. A copy needs the server's
 * `can_edit: true`; any other note is its author's, decided against the
 * server-verified session id.
 */
export function mayEditNote(
  note: Pick<NoteRecord, 'is_space_copy' | 'can_edit' | 'user'>,
  viewerId: number | null,
): boolean {
  if (note.is_space_copy === true) return note.can_edit === true;
  return viewerId !== null && note.user?.id === viewerId;
}

/** The copy line for a Space note: where it lives, and, for its author, what it came from. */
export function noteCopyLine(note: Pick<NoteRecord, 'is_space_copy' | 'space' | 'copied_from'>): {
  spaceName: string;
  spaceHref: string;
  original: { href: string; title: string } | null;
} | null {
  const space = noteSpace(note);
  if (!space) return null;
  const from = note.copied_from ?? null;
  return {
    spaceName: space.name,
    spaceHref: `/spaces/${space.uuid}`,
    original: from ? { href: `/notes/${from.slug}`, title: from.title?.trim() || 'Untitled' } : null,
  };
}
