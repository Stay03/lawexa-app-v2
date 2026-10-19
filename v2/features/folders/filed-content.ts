import type { FolderItemAddResponse } from './types';

/**
 * The id of what an add actually filed, from its 201: `data.content.id`.
 *
 * IN A SPACE FOLDER A NOTE IS FILED AS A COPY (Stay, 18 October 2026, 23:02
 * UTC, "Inside a space"): the server makes a copy of the note for the space
 * and files the copy, so the filed id is the copy's, not the note the reader
 * pressed. Undo removes by content id, so it must remove that one; removing
 * the original would 404 and leave the copy filed. Everywhere else the filed
 * content is the content itself and the ids agree. A response without the
 * content (an older server) falls back to the pressed id, which was right
 * before copies existed.
 */
export function filedContentId(response: FolderItemAddResponse | undefined, pressedId: number): number {
  const id = response?.data?.content?.id;
  return typeof id === 'number' ? id : pressedId;
}
