import { isEventMessage, type EventMessage } from '@/types/chat';
import type { EngineMessage } from './types';

/**
 * Where the chat's quiet lines go (the draft "edited" line; Stay, 30 October
 * 2026, 02:16Z, thread 1e44eb39; design 9b43f942). Pure, so each rule is
 * tested as it is.
 *
 * A line sits in its place in time: after the last row no newer than its
 * `timestamp` (the editing session's first save). It never goes below an
 * answer still being written: the server saves that answer when it ends, so
 * on a reload the line is above it, and drawing it there now keeps the open
 * chat and a reload in the same order. A line never moves the scroll and
 * never touches a stream.
 */

const timeOf = (row: EngineMessage): number => row.timestamp.getTime();

/** Where a line at `at` goes among `rows`. */
function placeFor(rows: readonly EngineMessage[], at: number): number {
  let index = rows.findIndex((row) => !isEventMessage(row) && row.isStreaming === true);
  if (index === -1) index = rows.length;
  while (index > 0 && timeOf(rows[index - 1]) > at) index -= 1;
  return index;
}

/**
 * The rows with this line in them: in its place when new, replacing the line
 * with the same id when held (a later save of the same session moves its
 * time and may change the title). Returns `rows` itself when nothing changes.
 */
export function placeEvent(rows: readonly EngineMessage[], line: EventMessage): readonly EngineMessage[] {
  const held = rows.findIndex((row) => row.id === line.id);
  if (held !== -1) {
    const current = rows[held];
    if (isEventMessage(current) && sameLine(current, line)) return rows;
    if (timeOf(current) === timeOf(line)) {
      const next = rows.slice();
      next[held] = line;
      return next;
    }
  }
  const without = held === -1 ? rows : rows.filter((_, index) => index !== held);
  const at = placeFor(without, timeOf(line));
  return [...without.slice(0, at), line, ...without.slice(at)];
}

/** The rows without the line of this server id; `rows` itself when it is not held. */
export function removeEvent(rows: readonly EngineMessage[], serverId: number): readonly EngineMessage[] {
  const index = rows.findIndex((row) => isEventMessage(row) && row.serverId === serverId);
  if (index === -1) return rows;
  return rows.filter((_, i) => i !== index);
}

/** Whether two lines draw the same. */
export function sameLine(a: EventMessage, b: EventMessage): boolean {
  return (
    a.id === b.id &&
    timeOf(a) === timeOf(b) &&
    a.editedAt.getTime() === b.editedAt.getTime() &&
    a.draftTitle === b.draftTitle &&
    a.editorName === b.editorName &&
    a.content === b.content
  );
}

/**
 * The rows with a server snapshot's lines applied: each line the snapshot has
 * is placed or refreshed, and a held line the snapshot lacks is taken out (its
 * draft went back to Lawexa's version), except one this screen drew from its
 * own save that no snapshot has confirmed yet (`unconfirmed`, ids): the
 * snapshot may predate that save. Returns `rows` itself when nothing changes.
 */
export function applySnapshotEvents(
  rows: readonly EngineMessage[],
  snapshot: readonly EngineMessage[],
  unconfirmed: ReadonlySet<string>,
): readonly EngineMessage[] {
  const lines = snapshot.filter(isEventMessage);
  const lineIds = new Set(lines.map((line) => line.id));
  const kept = rows.filter((row) => !isEventMessage(row) || lineIds.has(row.id) || unconfirmed.has(row.id));
  let placed: readonly EngineMessage[] = kept.length === rows.length ? rows : kept;
  for (const line of lines) placed = placeEvent(placed, line);
  return placed;
}
