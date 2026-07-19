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

/** Snapshot version — bumped on every mutation so useSyncExternalStore re-reads. */
let version = 0;

function notify(): void {
  version += 1;
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

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Reactively read a conversation's mode marks (for the composer's redacted pill +
 * confidential surface treatment). Re-renders only when a mark actually flips.
 */
export function useModeMarks(conversationId: string | null): {
  isConfidential: boolean;
  isRedacted: boolean;
} {
  // Version is the external-store snapshot; the booleans are derived from it. Both
  // reads share the same seed/notify cycle, so the values stay consistent.
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return {
    isConfidential: isConfidentialMark(conversationId),
    isRedacted: isRedactedMark(conversationId),
  };
}
