/**
 * One `client_request_id` per composed first message (backend contract,
 * 17 October 2026).
 *
 * A new chat's first send can fail AFTER the server has created the chat: a
 * phone that loses its signal before the answer arrives, or a 5xx after the
 * commit. The composer keeps the words (`startConversation`'s callers), the
 * reader sends again, and that used to create a second chat with the same
 * question. Now the first send carries a uuid, and every retry of that send
 * carries the same one, so the server answers the retry with the chat it
 * already made.
 *
 * "The same send" is what was composed: the words, the files, the space, the
 * content it is about and the private modes. Different words are a new send
 * with a new id. The id is dropped once the server has given a chat for it
 * (created, already sent, or still answering), so asking the same thing again
 * later is a new chat, as before. A refused send (4xx) leaves no chat, so its
 * id is kept for the retry.
 *
 * Held in memory only: the words of a confidential chat never go to storage.
 */

export interface FirstSend {
  message: string;
  fileIds: readonly number[];
  spaceUuid?: string;
  references?: readonly { type: string; id: string | number }[];
  confidential: boolean;
  redacted: boolean;
}

/** The last few unsettled sends; a composer only ever retries its latest. */
const MAX_HELD = 20;
const held = new Map<string, string>();

function keyOf(send: FirstSend): string {
  return JSON.stringify([
    send.message,
    [...send.fileIds].sort((a, b) => a - b),
    send.spaceUuid ?? null,
    (send.references ?? []).map((r) => `${r.type}:${r.id}`),
    send.confidential,
    send.redacted,
  ]);
}

/** A version 4 uuid: the server refuses anything else (422). */
export function newRequestId(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The id for this send: the one its earlier attempt used, else a new one. */
export function requestIdFor(send: FirstSend): string {
  const key = keyOf(send);
  const kept = held.get(key);
  if (kept) return kept;
  const id = newRequestId();
  held.set(key, id);
  if (held.size > MAX_HELD) held.delete(held.keys().next().value as string);
  return id;
}

/** A fresh id for this send, replacing its old one (the chat it named is gone). */
export function renewRequestId(send: FirstSend): string {
  held.delete(keyOf(send));
  return requestIdFor(send);
}

/** The server gave a chat for this send: the next one like it is new. */
export function settleRequestId(send: FirstSend): void {
  held.delete(keyOf(send));
}
