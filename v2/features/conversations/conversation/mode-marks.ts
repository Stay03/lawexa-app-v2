'use client';

import { useSyncExternalStore } from 'react';

/**
 * mode-marks — the v2-native reader/writer for v1's confidential + redacted mode
 * marks, WITHOUT importing v1's zustand stores (boundary). It reads the exact
 * sessionStorage envelope those stores persist (studied first-hand in
 * `v2/features/conversations/start-conversation.ts` `markInV1ModeStore`):
 *
 *   sessionStorage['lawexa-confidential-mode'] = { state: { confidentialIds: string[], … }, version }
 *   sessionStorage['lawexa-redacted-mode']     = { state: { redactedIds: string[], … }, version }
 *
 * WHY THIS EXISTS (the privacy acceptance criterion). The chat engine's
 * confidential/redacted RESOLVERS default to inert `() => false`. Left unwired, a
 * confidential conversation's turns would be written to the SERVER (not the
 * device-owned IndexedDB) and its `messages[]` replay would be skipped — a
 * privacy bug. The controller wires the engine's resolvers to
 * {@link isConfidentialMark} / {@link isRedactedMark}, so the engine reads the
 * SAME marks v1 reads, at event time.
 *
 * The store merges two sources so a mark is honored no matter where it came from:
 *  1. The persisted sessionStorage envelope (written by create + hard-nav, or by
 *     a prior v1 turn) — seeded lazily on first access.
 *  2. In-session marks the controller adds after the fact — {@link markConfidential}
 *     when a device-local transcript is found in IndexedDB, {@link markRedacted}
 *     when a server-loaded conversation carries `is_redacted: true`.
 *
 * It is a tiny external store (not a module cache of server data — it mirrors v1's
 * session-scoped zustand store 1:1) so the composer can reactively reflect the
 * conversation's mode (the redacted pill, the confidential surface treatment).
 */

const CONFIDENTIAL_KEY = 'lawexa-confidential-mode';
const REDACTED_KEY = 'lawexa-redacted-mode';

const confidentialIds = new Set<string>();
const redactedIds = new Set<string>();
let seeded = false;
const listeners = new Set<() => void>();

/** Tell every reader that a mark changed; each re-reads its own snapshot. */
function notify(): void {
  listeners.forEach((l) => l());
}

/** Read the persisted id array out of a v1 zustand-persist envelope, defensively. */
function readEnvelopeIds(storageKey: string, idsField: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const state =
      parsed && typeof parsed === 'object'
        ? (parsed as { state?: unknown }).state
        : null;
    const ids =
      state && typeof state === 'object'
        ? (state as Record<string, unknown>)[idsField]
        : null;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Remove one id from a persisted v1 zustand-persist envelope's id array, preserving
 * every OTHER field of `state` (and re-writing in zustand's exact `{ state, version }`
 * shape — the same envelope `start-conversation.ts` writes). Without this, an
 * in-memory unmark would RESURRECT on reload: {@link ensureSeeded} re-reads the
 * envelope, so a deleted confidential id must leave the persisted store too. Absent
 * envelope ⇒ no-op (nothing to prune).
 */
function removeFromEnvelope(storageKey: string, idsField: string, id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    const prevState: Record<string, unknown> =
      parsed && typeof parsed === 'object' && typeof (parsed as { state?: unknown }).state === 'object'
        ? { ...((parsed as { state: Record<string, unknown> }).state) }
        : {};
    const prevIds: unknown = prevState[idsField];
    const ids = Array.isArray(prevIds) ? (prevIds as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const nextIds = ids.filter((x) => x !== id);
    if (nextIds.length === ids.length) return; // id wasn't there — leave untouched
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({ state: { ...prevState, [idsField]: nextIds }, version: 0 }),
    );
  } catch {
    // sessionStorage unavailable — the in-memory unmark still applies this session.
  }
}

/** Seed the in-memory sets from sessionStorage once (client-only, idempotent). */
function ensureSeeded(): void {
  if (seeded || typeof window === 'undefined') return;
  seeded = true;
  for (const id of readEnvelopeIds(CONFIDENTIAL_KEY, 'confidentialIds')) confidentialIds.add(id);
  for (const id of readEnvelopeIds(REDACTED_KEY, 'redactedIds')) redactedIds.add(id);
}

/** True when `conversationId` is known-confidential (envelope or in-session). */
export function isConfidentialMark(conversationId: string | null | undefined): boolean {
  if (!conversationId) return false;
  ensureSeeded();
  return confidentialIds.has(conversationId);
}

/** True when `conversationId` is known-redacted (envelope or in-session). */
export function isRedactedMark(conversationId: string | null | undefined): boolean {
  if (!conversationId) return false;
  ensureSeeded();
  return redactedIds.has(conversationId);
}

/** Mark a conversation confidential (IndexedDB transcript found on this device). */
export function markConfidential(conversationId: string): void {
  ensureSeeded();
  if (confidentialIds.has(conversationId)) return;
  confidentialIds.add(conversationId);
  notify();
}

/** Mark a conversation redacted (server history reported `is_redacted: true`). */
export function markRedacted(conversationId: string): void {
  ensureSeeded();
  if (redactedIds.has(conversationId)) return;
  redactedIds.add(conversationId);
  notify();
}

/**
 * Clear a conversation's confidential mark — in-memory AND in the persisted
 * envelope (fix round §A7-39: the delete affordance clears the marks so the
 * device stops treating the conversation as confidential). Removing only the
 * in-memory entry would let {@link ensureSeeded} resurrect it from sessionStorage
 * on the next mount, so the envelope is pruned in lockstep.
 */
export function unmarkConfidential(conversationId: string): void {
  ensureSeeded();
  removeFromEnvelope(CONFIDENTIAL_KEY, 'confidentialIds', conversationId);
  if (!confidentialIds.delete(conversationId)) return;
  notify();
}

/** Clear a conversation's redacted mark — in-memory AND in the persisted envelope
 *  (sibling of {@link unmarkConfidential}; a deleted chat sheds both modes). */
export function unmarkRedacted(conversationId: string): void {
  ensureSeeded();
  removeFromEnvelope(REDACTED_KEY, 'redactedIds', conversationId);
  if (!redactedIds.delete(conversationId)) return;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Confidential is bit 1, redacted bit 2: a whole mark state as one number. */
const CONFIDENTIAL_BIT = 1;
const REDACTED_BIT = 2;

/**
 * A conversation's marks as one number (`confidential | redacted`), the
 * external store's snapshot. A number compares by value, so React re-renders
 * only when a mark actually flips.
 */
export function modeMarkBits(conversationId: string | null | undefined): number {
  return (isConfidentialMark(conversationId) ? CONFIDENTIAL_BIT : 0) | (isRedactedMark(conversationId) ? REDACTED_BIT : 0);
}

/** The two flags back out of {@link modeMarkBits}. */
export function modeMarksFromBits(bits: number): { isConfidential: boolean; isRedacted: boolean } {
  return { isConfidential: (bits & CONFIDENTIAL_BIT) !== 0, isRedacted: (bits & REDACTED_BIT) !== 0 };
}

/**
 * What the server draws: no marks. sessionStorage does not exist there, and
 * the server snapshot must say so.
 */
export const SERVER_MODE_MARK_BITS = 0;

/**
 * Reactively read a conversation's mode marks (for the composer's redacted pill +
 * confidential surface treatment). Re-renders only when a mark actually flips.
 *
 * THE FLAGS ARE THE SNAPSHOT (Techlead bef9b44b). They used to be read from
 * sessionStorage on every render beside a version-number snapshot, so the
 * HYDRATION render, which React runs with the server snapshot, still saw the
 * client's marks: it drew the Confidential banner and the Redacted chip the
 * server had not, React logged "Hydration failed" and threw the server HTML away.
 * Now the hydration render reads {@link SERVER_MODE_MARK_BITS} (no marks, like
 * the server), and React draws the real marks on the very next render.
 */
export function useModeMarks(conversationId: string | null): {
  isConfidential: boolean;
  isRedacted: boolean;
} {
  const bits = useSyncExternalStore(
    subscribe,
    () => modeMarkBits(conversationId),
    () => SERVER_MODE_MARK_BITS,
  );
  return modeMarksFromBits(bits);
}
