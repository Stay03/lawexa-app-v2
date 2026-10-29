/**
 * Which of the reader's own notes My notes shows (drafts saved as notes,
 * thread 1e44eb39): every draft Lawexa writes is a note now, so the drafts
 * from chats can be shown apart, or left out, and never crowd the notes the
 * reader wrote here. `?from=chats` or `?from=own` in the address, so the view
 * is a link; anything else is all of them.
 */
export type NotesSource = 'all' | 'chats' | 'own';

export const NOTES_SOURCES: readonly { id: NotesSource; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'own', label: 'Written by you' },
  { id: 'chats', label: 'From chats' },
];

export function parseNotesSource(raw: string | null): NotesSource {
  return raw === 'chats' || raw === 'own' ? raw : 'all';
}

/** The list's `from_chats`: `true`, `false`, or left out for all. */
export function fromChatsParam(source: NotesSource): boolean | undefined {
  if (source === 'chats') return true;
  if (source === 'own') return false;
  return undefined;
}
