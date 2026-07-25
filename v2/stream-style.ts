import { useSyncExternalStore } from 'react';
// Imported from the LEAF module, never the `chat-engine` barrel. This file is a
// sanctioned v1→v2 crossing (`eslint.config.mjs`), and the barrel re-exports
// VALUES (createChatEngine, ensureTranscript, …). `import type` erases today, so
// the barrel would be harmless — but one future edit dropping the `type` keyword
// would pull axios, EventSource and IndexedDB into v1's settings bundle. The leaf
// import removes that trap instead of relying on a keyword to hold the line.
import type { StreamStyle } from './runtime/chat-engine/stream-smoother';

/**
 * The streamed-answer RELEASE STYLE — a developer/tester preference.
 *
 *  - `flow` (default) — the continuous reveal: whole words are released as the rate
 *    controller pays for them and each new word fades in. Reads as one moving body
 *    of text.
 *  - `line` — one reader-sized unit at a time (a source line, a sentence, or a table
 *    held whole). Reads as a document being written line by line. It is a RELEASE
 *    RHYTHM and nothing else: the stand-in bar that once marked the unit still
 *    arriving was removed on the owner's call, so this preference now reaches only
 *    the smoother and never the renderer.
 *
 * WHY localStorage AND NOT A COOKIE. `v2/cookie.ts` is a cookie because the SERVER
 * proxy has to read it on every request. Nothing on the server ever needs to know
 * how text is paced onto the screen, so sending this on every request would be pure
 * overhead. It is a per-device display preference, which is exactly what
 * localStorage is for.
 *
 * SHAPE. A tiny module-level external store read through `useSyncExternalStore`,
 * following `v2/shell/home-tab.ts` exactly: a module store (not component state) so
 * the settings control, the engine adapter and every transcript row read ONE value;
 * `getServerSnapshot` returns the default so SSR and the first client render agree;
 * a `storage` listener keeps other tabs in sync; and the hook returns a PRIMITIVE,
 * so the snapshot is referentially stable by construction (no `useSyncExternalStore`
 * infinite-loop hazard).
 *
 * Deliberately NOT `'use client'`: it exports plain functions + a hook and touches
 * `window`/`localStorage` only inside callbacks (never at module scope), so it is
 * safe to evaluate during SSR and is consumed only by client components.
 */

const STORAGE_KEY = 'lawexa-v2-stream-style';
const DEFAULT_STYLE: StreamStyle = 'flow';

/** Cached snapshot so `getSnapshot` returns a referentially-stable value. */
let currentStyle: StreamStyle | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): StreamStyle {
  if (typeof window === 'undefined') return DEFAULT_STYLE;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'line' ? 'line' : DEFAULT_STYLE;
  } catch {
    // Private-mode / storage-disabled: fall back to the default.
    return DEFAULT_STYLE;
  }
}

function getSnapshot(): StreamStyle {
  if (currentStyle === null) currentStyle = readFromStorage();
  return currentStyle;
}

function getServerSnapshot(): StreamStyle {
  return DEFAULT_STYLE;
}

/**
 * Cross-tab reconcile: `localStorage.setItem` fires `storage` only in OTHER tabs,
 * so this heals background tabs when the style is changed elsewhere. The same-tab
 * update path goes through `setStreamStyle` → the listener loop directly.
 */
function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  currentStyle = readFromStorage();
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  // ONE window listener for the whole store, reference-counted on the subscriber
  // set. Unlike the home tab (one control, one surface), this store is read by
  // every assistant row in the transcript, so a listener per subscriber would put
  // dozens of identical handlers on `window`.
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** Persist + broadcast a new release style. Takes effect on any live stream
 *  immediately — the engine re-resolves its smoothers rather than rebuilding. */
export function setStreamStyle(style: StreamStyle): void {
  if (getSnapshot() === style) return;
  currentStyle = style;
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Non-persistent is acceptable; the choice still applies in-memory.
  }
  for (const listener of listeners) listener();
}

/** Read the current style once, outside React (for a lazy `useState` initializer in
 *  a v1 settings card, where subscribing would be overkill). */
export function readStreamStyle(): StreamStyle {
  return getSnapshot();
}

/** Subscribe a component to the current release style. */
export function useStreamStyle(): StreamStyle {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
