import type {
  ContentSpaceStub,
  CreateSpaceFolderPayload,
  MoveToSpacePayload,
  Space,
  SpaceItemRef,
} from '@/types/collab';
import {
  ACCEPTED_FILE_TYPES,
  ALLOWED_FILE_TYPES,
  isImageAttachment,
  MAX_DOCUMENT_SIZE,
  MAX_IMAGE_SIZE,
  PICTURE_EXTENSIONS,
} from '@/v2/features/conversations/attachment-rules';
import { MEDIA_EXTENSIONS, MEDIA_MAX_SIZE_BYTES } from '@/v2/features/channels/model';
import { canAddContent, type SpaceTab } from './model';

/**
 * content-model — the pure rules of writing to a space's contents (Spaces F3,
 * 12 October 2026, backend B3 cb0fae8): who may add, take out and move, the
 * exact request bodies, and the sentences each refusal is answered with. No
 * JSX, no hooks, so the Folders pill, the row menus and the move dialog all read
 * the same answers, and the tests pin them without a browser.
 *
 * ── THREE ROLES, THREE VERBS ───────────────────────────────────────────────
 *  - ADD (a folder, a file): the space's Owner and Contributors
 *    (`canAddContent`, F2). A Viewer gets no button, because the server
 *    answers 403.
 *  - TAKE OUT ("Remove from space"): the space's Owner only, on anyone's
 *    item. It never deletes the item: it goes back to the person who owns it.
 *  - MOVE (into a space, or back out): the item's own owner, into a space
 *    where they are Owner or Contributor.
 */

/** The three kinds of item a space holds. */
export type SpaceItemKind = SpaceItemRef['type'];

/** The space home's pills that list items; `people` is the roster, `radars`
 *  and `tasks` their own lists. */
export type SpaceContentTab = Exclude<SpaceTab, 'people' | 'radars' | 'tasks'>;

/** Whether the viewer may take items out of this space: its content Owner. */
export function canRemoveFromSpace(space: Pick<Space, 'my_content_role'>): boolean {
  return space.my_content_role === 'owner';
}

/** Whether the viewer owns an item, read off the owner id the row carries
 *  (a chat's author, a folder's user, a file's uploader). An unknown viewer
 *  or an unknown owner is "no", so no menu offers a move that would 403. */
export function ownsItem(
  ownerId: number | null | undefined,
  viewerId: number | null,
): boolean {
  return viewerId !== null && ownerId === viewerId;
}

/**
 * The spaces a move may go into: those where the viewer may add (Owner or
 * Contributor). The space the item is already in stays in the list, so the
 * picker can mark it rather than leave the reader wondering where it went.
 */
export function moveTargets(spaces: readonly Space[]): Space[] {
  return spaces.filter((space) => canAddContent(space));
}

/* ── Request bodies, exactly the documented keys ──────────────────────────── */

/** `POST /spaces/{uuid}/folders`: the name, private, and the parent when the
 *  folder is made inside another one. */
export function spaceFolderPayload(
  name: string,
  parentUuid: string | null,
): CreateSpaceFolderPayload {
  return parentUuid
    ? { name: name.trim(), is_private: true, parent_id: parentUuid }
    : { name: name.trim(), is_private: true };
}

/** `DELETE /spaces/{uuid}/items`: `type` and `id`, copied key by key so
 *  nothing else the caller's object carries can ride along. */
export function spaceItemRef(item: SpaceItemRef): SpaceItemRef {
  switch (item.type) {
    case 'conversation':
      return { type: 'conversation', id: item.id };
    case 'folder':
      return { type: 'folder', id: item.id };
    case 'file':
      return { type: 'file', id: item.id };
  }
}

/** Every move's body: the space to go into, or `null` to come back out. */
export function movePayload(spaceUuid: string | null): MoveToSpacePayload {
  return { space_uuid: spaceUuid };
}

/* ── The item a menu acts on ──────────────────────────────────────────────── */

/**
 * What the move dialog and the remove confirm need about an item: how to
 * address it, what to call it, and the space it sits in. `space` is the stub
 * the item's payload carries (the folder page's `GET /folders/{uuid}` too,
 * techlead decision 3, 12 October 2026); `null` or absent means the item is
 * its owner's alone.
 */
export type SpaceItemTarget = SpaceItemRef & {
  name: string;
  space?: ContentSpaceStub | null;
};

/**
 * Whether the move dialog offers "Remove from space": only for an item that
 * names the space it is in. An absent block reads as "not in a space", never
 * as "may be in one", so the dialog never offers a way out of a space the item
 * is not in (techlead decision 3).
 */
export function offersRemoveFromSpace(item: Pick<SpaceItemTarget, 'space'>): boolean {
  return item.space !== null && item.space !== undefined;
}

/**
 * The line under the move picker when the server holds more spaces than the
 * page it sent (techlead decision 2: no silent cut). `shown` is the rows the
 * picker draws; `null` when the page is the whole list.
 */
export function movePickerCutLine(
  shown: number,
  page: { rows: number; total: number } | null,
): string | null {
  if (page === null || page.total <= page.rows) return null;
  return `Showing ${shown}. Search to find more.`;
}

/** The noun each kind is called in a sentence. */
export const SPACE_ITEM_NOUN: Readonly<Record<SpaceItemKind, string>> = {
  conversation: 'conversation',
  folder: 'folder',
  file: 'file',
};

/* ── Refusals, in plain words ─────────────────────────────────────────────── */

/**
 * Why a move was refused, for the dialog to show in place. Keyed on the
 * status and the kind, because the same status means different things per
 * route (B3): a chat's 422 is a confidential or redacted chat (or a space
 * that does not exist, which the picker never offers); a folder's 422 is a
 * parent in another space, which the server's sentence names best.
 */
export function moveRefusal(
  kind: SpaceItemKind,
  status: number,
  serverMessage: string | null,
): string {
  if (status === 422 && kind === 'conversation') {
    return 'Confidential chats can’t go into a space.';
  }
  if (status === 422) {
    return serverMessage?.trim() || 'This can’t go into that space.';
  }
  if (status === 403) {
    return 'You can only move your own items, into a space where you are an Owner or Contributor.';
  }
  if (status === 404) {
    return `This ${SPACE_ITEM_NOUN[kind]} is no longer available to move.`;
  }
  return 'Couldn’t move it. Please try again.';
}

/**
 * Whether the viewer may delete this space file (backend, 15 October 2026;
 * the rows carry no flag): the space's Owner any file, a Contributor only
 * what they uploaded, a Viewer none.
 */
export function canDeleteSpaceFile(
  space: Pick<Space, 'my_content_role'>,
  uploaderId: number,
  viewerId: number | null,
): boolean {
  if (space.my_content_role === 'owner') return true;
  return space.my_content_role === 'editor' && viewerId !== null && uploaderId === viewerId;
}

/** Why a copy or a delete of a space file was refused, from the status. */
export function spaceFileRefusal(action: 'copy' | 'delete', status: number, serverMessage: string | null): string {
  if (status === 403) return serverMessage?.trim() || 'You cannot delete this file.';
  if (status === 404) return 'This file is no longer in the space.';
  return action === 'copy' ? 'Couldn’t save a copy. Please try again.' : 'Couldn’t delete the file. Please try again.';
}

/** Why a Remove from Space was refused (B3: 403 for anyone but the space's
 *  Owner, 404 when the item is no longer in the space). */
export function removeRefusal(status: number): string {
  if (status === 403) return 'Only the space’s Owner can remove items from it.';
  if (status === 404) return 'This is no longer in the space.';
  return 'Couldn’t remove it. Please try again.';
}

/** Why a conversation could not start in the space (backend B4): a Viewer or a
 *  non-member (403, `CANNOT_ADD_TO_SPACE`), or the server's own reason for a
 *  request it would not take (422). */
export function startChatRefusal(status: number, serverMessage: string | null): string {
  if (status === 403) return 'Only the Owner and Contributors can start conversations here.';
  if (status === 422) return serverMessage?.trim() || 'This conversation can’t start here.';
  return 'Couldn’t start the conversation. Please try again.';
}

/** Why a new folder was refused: a Viewer (403), or the server's own reason
 *  for a name or parent it would not take (422). */
export function createFolderRefusal(status: number, serverMessage: string | null): string {
  if (status === 403) return 'Only the Owner and Contributors can add folders here.';
  if (status === 422) return serverMessage?.trim() || 'That folder can’t be made here.';
  return 'Couldn’t make the folder. Please try again.';
}

/**
 * What an upload's row says when the server refused it, and whether Retry
 * could help. The rules refusal (422) carries its reason under
 * `errors.file`, which names the problem better than the envelope's generic
 * message; it and a Viewer's 403 would be answered the same again, so they
 * get no Retry. A dropped connection or a 5xx keeps one.
 */
export function uploadRefusal(
  status: number,
  fieldMessage: string | null,
  serverMessage: string | null,
): { message: string; retryable: boolean } {
  if (status === 422) {
    return {
      message: fieldMessage?.trim() || serverMessage?.trim() || 'This file can’t be added.',
      retryable: false,
    };
  }
  if (status === 413) return { message: 'This file is too large to upload.', retryable: false };
  if (status === 403) {
    return {
      message: 'Only the Owner and Contributors can add files here.',
      retryable: false,
    };
  }
  return { message: 'The upload didn’t finish. Please try again.', retryable: true };
}

/** The extensions the document upload rules take, from the one `accept`
 *  string the chat composer already uses, so the two cannot drift. */
const ACCEPTED_EXTENSIONS: readonly string[] = ACCEPTED_FILE_TYPES.split(',').map(
  (extension) => extension.replace('.', '').toLowerCase(),
);

/**
 * Video and audio, which a space and a folder take as well (Stay, 20 October
 * 2026: "Yes all files"; backend: `POST /spaces/{space}/files` and
 * `POST /files/documents` take mp4, mov, webm, mp3, m4a, wav and ogg up to
 * 100 MB). The same seven and the same cap a channel takes (channels/model.ts).
 * The chat composer does NOT take them: a chat send refuses a media file, so
 * its picker keeps {@link ACCEPTED_FILE_TYPES}.
 */
const MEDIA_UPLOAD_TYPES: readonly string[] = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
];

/** The file picker's `accept` for a space and a folder: documents, pictures, video and audio. */
export const FILES_ACCEPT = `${ACCEPTED_FILE_TYPES},${[...MEDIA_EXTENSIONS].map((extension) => `.${extension}`).join(',')}`;

/** Is this a video or audio file, by its type or, when the system sent none, its name? */
export function isMediaUpload(file: Pick<File, 'name' | 'type'>): boolean {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  return MEDIA_UPLOAD_TYPES.includes(file.type) || MEDIA_EXTENSIONS.has(extension);
}

/**
 * Check a file against the document upload rules before it is sent (B3:
 * "the document upload rules", the ones `POST /files/documents` runs; the
 * space's `POST /spaces/{uuid}/files` request extends that one, backend
 * bd76241, so the two take the same files). The server stays the judge and
 * its 422 is shown in place too; this only spares the reader a wait to be
 * told something knowable now. The extension is checked as well as the
 * type, because some systems send `.rtf` with no type.
 *
 * `place` names where the file is going in the refusal: a folder's upload
 * (Arthur, 17 October 2026, item 8) runs the same rules, since a space folder
 * uploads to the space and a personal one to `POST /files/documents` or, for
 * a picture, `POST /files`.
 */
export function uploadPrecheck(
  file: Pick<File, 'name' | 'type' | 'size'>,
  place: 'a space' | 'a folder' = 'a space',
): string | null {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  if (isMediaUpload(file)) {
    return file.size > MEDIA_MAX_SIZE_BYTES
      ? `“${file.name}” is larger than 100 MB, the most ${place} takes for a video or audio file.`
      : null;
  }
  const typeKnown = file.type !== '' && ALLOWED_FILE_TYPES.includes(file.type);
  if (!typeKnown && !ACCEPTED_EXTENSIONS.includes(extension)) {
    const takes = place === 'a space' ? 'A space takes' : 'A folder takes';
    return `“${file.name}” can’t be added. ${takes} PDF, Word, RTF, image (JPG, PNG, WebP), video and audio files.`;
  }
  // A picture is capped at 5 MB, as the server's rule caps it. A file the
  // system sent with no type is judged a picture by its name.
  const picture =
    isImageAttachment(file) || (file.type === '' && PICTURE_EXTENSIONS.includes(extension));
  if (picture && file.size > MAX_IMAGE_SIZE) {
    return `“${file.name}” is larger than 5 MB, the most ${place} takes for a picture.`;
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return `“${file.name}” is larger than 10 MB, the most ${place} takes.`;
  }
  return null;
}

/* ── Labels ───────────────────────────────────────────────────────────────── */

/** A file's type in one word, for its row: what the reader would call it. */
export function fileTypeLabel(file: { mime_type: string; original_name: string }): string {
  const extension = file.original_name.toLowerCase().split('.').pop() ?? '';
  const mime = file.mime_type.toLowerCase();
  if (extension === 'pdf' || mime === 'application/pdf') return 'PDF';
  if (['doc', 'docx'].includes(extension) || mime.includes('word')) return 'Word';
  if (extension === 'rtf' || mime.includes('rtf')) return 'RTF';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(extension)) return 'Video';
  if (mime.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg'].includes(extension)) return 'Audio';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
    return 'Image';
  }
  return extension && extension !== file.original_name.toLowerCase()
    ? extension.toUpperCase()
    : 'File';
}

/** Each kind pill's plural noun, the word its empty state uses. */
const SPACE_TAB_NOUN: Readonly<Record<Exclude<SpaceContentTab, 'all'>, string>> = {
  conversations: 'conversations',
  folders: 'folders',
};

/**
 * What an empty pill says. Since design round 1 Stay's two lines sit in a
 * shared space's header whether it is full or empty, so the empty state no
 * longer repeats them: it names what is missing and how it gets filled. An
 * Owner or Contributor reads how to add, with the way to add beside it; a
 * Viewer cannot add, so they read who does, and get no button.
 */
export function spaceEmptyCopy(
  tab: SpaceContentTab,
  canAdd: boolean,
): { title: string; description: string } {
  if (tab === 'all' && !canAdd) {
    return {
      title: 'Nothing in this space yet',
      description: 'Contributors and the owner add conversations, files and folders here.',
    };
  }
  if (tab === 'all' || (tab === 'conversations' && canAdd)) {
    // Arthur's words (15 October 2026, second pass). The box is docked under
    // this (`SpaceChatDock`), with Upload files and Invite people between the
    // two.
    return {
      title: 'Start working with Lawexa',
      description:
        'Ask questions, explore your subject or work towards your goal. Add resources to give Lawexa the context it needs.',
    };
  }
  const noun = SPACE_TAB_NOUN[tab];
  const title = `No ${noun} in this space yet`;
  return {
    title,
    description: canAdd
      ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} you add here are shared with everyone in this space.`
      : `Contributors and the owner add ${noun} here.`,
  };
}
