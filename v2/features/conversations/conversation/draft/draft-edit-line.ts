import type { ChatEngine } from '@/v2/runtime/chat-engine/types';
import type { DraftEditLineFields } from '@/v2/features/notes/types';

/**
 * A draft save or restore landed: the chat's "edited" line follows its answer
 * at once, for the reader who saved (Stay, 30 October 2026, 02:16Z, thread
 * 1e44eb39; design 9b43f942). The lines the save took away (the note is back to
 * Lawexa's version; all of a draft's open lines, whoever opened them) go
 * first, then the line it made or moved is drawn in its
 * place. Other members of a Space chat get it from the status poll
 * (`last_event_at`, space-turn.ts). Absent fields (the server's flag off) do
 * nothing.
 */
export function applyDraftEditLine(
  engine: Pick<ChatEngine, 'upsertEvent' | 'removeEvent'>,
  answer: DraftEditLineFields,
): void {
  for (const id of answer.draft_edit_line_removed_ids ?? []) {
    if (typeof id === 'number') engine.removeEvent(id);
  }
  if (answer.draft_edit_line) engine.upsertEvent(answer.draft_edit_line);
}

/**
 * Whether a save left the draft edited, for its card. A save that took lines
 * away (`draft_edit_line_removed_ids`) brought the note back to Lawexa's text,
 * so it is no longer edited (the edit line run, 30 October 2026: undoing
 * every edit dropped the line but the card still said "Edited"). Any other
 * save is an edit, as before.
 */
export function editedAfterSave(answer: DraftEditLineFields | undefined): boolean {
  return !(answer?.draft_edit_line_removed_ids && answer.draft_edit_line_removed_ids.length > 0);
}
