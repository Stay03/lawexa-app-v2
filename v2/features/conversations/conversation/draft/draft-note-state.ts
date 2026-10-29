import type { DraftNoteDocument, DraftNoteMissing, NoteRevisionAuthor } from '@/v2/features/notes/types';

/**
 * draft-note-state — what the draft panel does with a finished draft, now that
 * every draft is saved as a note (Stay's "go", 27 October 2026; woz's server
 * and Irish's screen, approved 29 October 2026, thread 1e44eb39).
 *
 * One DOCUMENT is a draft and all its versions, and one note holds it: each
 * version Lawexa writes goes into that note, and the reader's edits autosave
 * into it, so Lawexa works from them. The server lists a chat's documents
 * (`GET /conversations/{uuid}/draft-notes`); this decides, from that list,
 * what the panel on draft N shows:
 *
 *   editable      the newest version, the note caught up, the reader may edit:
 *                 the note in the editor, autosaving.
 *   read-only     the same, for a reader who may not edit (a Space's Viewer).
 *   catching-up   the newest version, but the note still holds the one
 *                 before (the server's job is queued): Lawexa's text, read
 *                 only, "Saving to your notes…", read again every 2 s, and
 *                 after 30 s a line with Try again.
 *   older         an older version: Lawexa's text as it wrote it, read only,
 *                 with Open latest. Nothing in it saves, so it can never
 *                 write over the note.
 *   missing       the newest version has no note, for a reason the server
 *                 gives (`note_missing`): deleted, the plan's note limit,
 *                 a chat moved since, or a note this reader may not see.
 *                 Lawexa's text, read only, with the downloads and a line
 *                 for the reason.
 *   notes-off     a chat that keeps no draft notes (`notes: false`): a
 *                 confidential chat, which keeps nothing, and any chat the
 *                 server leaves out (woz, 29 October 2026: Radar reports,
 *                 until Stay decides). Today's editing in the
 *                 page's memory, with the downloads, and no Save.
 *   unlisted      the list has no document for this draft (it failed to load,
 *                 or the server has not listed it): Lawexa's text, read only,
 *                 with the downloads and Try again. Not editable, so typing
 *                 is never lost to the note opening a moment later.
 *   loading       the list is on its way.
 *
 * Pure, so every rule is tested here; the panel only draws it.
 */

export type DraftNoteState =
  | { kind: 'loading' }
  | { kind: 'notes-off' }
  | { kind: 'unlisted' }
  | { kind: 'missing'; reason: DraftNoteMissing; document: DraftNoteDocument }
  | { kind: 'older'; document: DraftNoteDocument; latestOrdinal: number }
  | { kind: 'catching-up'; document: DraftNoteDocument }
  | { kind: 'read-only'; document: DraftNoteDocument; note: NonNullable<DraftNoteDocument['note']> }
  | { kind: 'editable'; document: DraftNoteDocument; note: NonNullable<DraftNoteDocument['note']> };

/** The list as the panel has it: still loading, failed, or the server's answer. */
export type DraftNotesRead =
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'success'; notes: boolean; documents: readonly DraftNoteDocument[] };

/**
 * Which draft the panel is on, as the chat on screen knows it: its place, its
 * group (`draftGroupKey`, the server's `key` too, woz c70afd25), and the
 * newest place in that group the chat holds. The chat can be ahead of the
 * list: an answer just finished writes a version the server's queued job has
 * not listed yet.
 */
export interface DraftPlace {
  ordinal: number;
  key: string;
  /** The newest place in the group on screen; `ordinal` for a draft written once. */
  latestOrdinal: number;
}

/** The document of a draft's group, or `null`. */
export function documentFor(documents: readonly DraftNoteDocument[], key: string): DraftNoteDocument | null {
  return documents.find((document) => document.key === key) ?? null;
}

export function draftNoteState(read: DraftNotesRead, place: DraftPlace): DraftNoteState {
  if (read.status === 'pending') return { kind: 'loading' };
  if (read.status === 'error') return { kind: 'unlisted' };
  if (!read.notes) return { kind: 'notes-off' };
  const document = documentFor(read.documents, place.key);
  if (!document) return { kind: 'unlisted' };
  // Older by either count: the chat's (a version just written) or the server's.
  const latestOrdinal = Math.max(place.latestOrdinal, document.latest_ordinal);
  if (place.ordinal < latestOrdinal) return { kind: 'older', document, latestOrdinal };
  // A server from before the reason says nothing: it could only mean deleted then.
  if (!document.note) return { kind: 'missing', reason: document.note_missing ?? 'deleted', document };
  // The newest on screen, which the list has not reached, or whose note it has not caught up with.
  if (document.latest_ordinal < place.ordinal || document.note_version < document.lawexa_version) {
    return { kind: 'catching-up', document };
  }
  return document.can_edit
    ? { kind: 'editable', document, note: document.note }
    : { kind: 'read-only', document, note: document.note };
}

/** How often the panel reads the list again while a note catches up. */
export const CATCH_UP_POLL_MS = 2_000;

/** How long it waits before it says the note has not caught up, and offers Try again. */
export const CATCH_UP_LIMIT_MS = 30_000;

/** Whether the panel should read the list again: only while a note catches up, and not past the limit. */
export function catchUpPoll(state: DraftNoteState, waitedMs: number): number | false {
  return state.kind === 'catching-up' && waitedMs < CATCH_UP_LIMIT_MS ? CATCH_UP_POLL_MS : false;
}

/**
 * The line at the top of a panel that does not edit the note, or `null` for
 * one that does. Each says what the reader sees and, where there is one, what
 * to do.
 */
export function draftNoteLine(state: DraftNoteState, waitedMs = 0): string | null {
  switch (state.kind) {
    case 'older':
      return 'An older version, as Lawexa wrote it. Your note is the latest version.';
    case 'catching-up':
      return waitedMs >= CATCH_UP_LIMIT_MS ? 'Your note hasn’t caught up yet.' : 'Saving to your notes…';
    case 'read-only':
      return 'You can read this draft. Only the Space’s editors can change it.';
    case 'missing':
      return MISSING_LINE[state.reason];
    case 'notes-off':
      return 'This draft isn’t saved as a note. Download it to keep it.';
    case 'unlisted':
      return 'Your note couldn’t be reached.';
    default:
      return null;
  }
}

/** Why the newest version has no note, as the panel says it; each offers the downloads. */
const MISSING_LINE: Record<DraftNoteMissing, string> = {
  deleted: 'You deleted this draft’s note. Download it to keep a copy.',
  limit: 'You’ve reached your note limit, so this draft isn’t saved. Download it to keep it.',
  moved: 'This chat moved after the draft was saved, so its note stays where it was. Download this version to keep it.',
  hidden: 'This draft’s note isn’t one you can open. Download it to keep a copy.',
};

/** Whether the panel's editor takes typing: into the note, or where no note is kept into the page's memory. */
export function draftEditable(state: DraftNoteState): boolean {
  return state.kind === 'editable' || state.kind === 'notes-off';
}

/**
 * Who wrote a revision, for the history: "Lawexa · Version 3", "You", or a
 * Space member's name. `viewerUuid` is the reader's.
 */
export function revisionAuthorLabel(
  revision: { author: NoteRevisionAuthor; lawexa_version: number | null },
  viewerUuid: string | null,
): string {
  if (revision.author.kind === 'lawexa') {
    return revision.lawexa_version ? `Lawexa · Version ${revision.lawexa_version}` : 'Lawexa';
  }
  const user = revision.author.user;
  // A person's revision always names them (woz); one that does not is never assumed to be the reader's.
  if (!user) return 'Someone';
  return user.uuid === viewerUuid ? 'You' : user.name;
}
