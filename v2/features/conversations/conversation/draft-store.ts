import { useCallback, useSyncExternalStore } from 'react';

/**
 * draft-store — a composer's unsent text and staged pastes, kept in
 * `localStorage` and read through `useSyncExternalStore`.
 *
 * ── WHY NOT A LAZY `useState` ───────────────────────────────────────────────
 * The case page renders its composer on the server (the signed-in case
 * prefetch, Fable SSR review F2). A lazy `useState` initialiser returns `''`
 * on the server and the saved draft on the client's first render, so a reader
 * with a draft hydrates a different tree: extra paste cards, other text. React
 * then throws the server HTML away and renders the whole case screen again on
 * the client (content, skeleton, content). Here the server and the hydration
 * pass both read the SERVER snapshot (empty), and React re-renders with the
 * stored draft straight after hydration. A composer that mounts later, on a
 * client navigation, reads the stored draft on its first render, so the draft
 * never flashes in there.
 *
 * `useSyncExternalStore`, not a `useEffect` that calls `setState`, because the
 * React Compiler lint forbids the second (the `use-panel-breakpoint` pattern).
 *
 * ── localStorage IS THE ONLY SOURCE OF TRUTH ────────────────────────────────
 * Every snapshot reads the stored string again, so anything that clears or
 * changes storage (another tab, a sign-out that wipes it) shows up on the next
 * render. Two module maps exist only to keep that cheap and safe:
 * - `decoded` holds the last decoded value per key with the string it came
 *   from. The snapshot returns that same object while the string is unchanged,
 *   which `useSyncExternalStore` requires, and which keeps paste ids stable.
 * - `fallback` holds the string for a key whose write threw (storage full or
 *   blocked). The draft then lives in memory for this page, as before.
 */

export interface DraftCodec<T> {
  /** The value with nothing stored. Must be ONE stable reference. */
  readonly empty: T;
  decode(raw: string): T;
  /** `null` removes the key. */
  encode(value: T): string | null;
}

const decoded = new Map<string, { raw: string | null; value: unknown }>();
const fallback = new Map<string, string | null>();
const listeners = new Set<() => void>();

function readRaw(key: string): string | null {
  if (fallback.has(key)) return fallback.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string | null): void {
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
    fallback.delete(key);
  } catch {
    fallback.set(key, raw);
  }
}

/** The client snapshot: the stored value, the same object while unchanged. */
export function readDraft<T>(key: string, codec: DraftCodec<T>): T {
  const raw = readRaw(key);
  const hit = decoded.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  const value = raw === null ? codec.empty : codec.decode(raw);
  decoded.set(key, { raw, value });
  return value;
}

export function writeDraft<T>(key: string, codec: DraftCodec<T>, value: T): void {
  const raw = codec.encode(value);
  writeRaw(key, raw);
  decoded.set(key, { raw, value });
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Another tab wrote the draft: the next snapshot reads it from storage.
  window.addEventListener('storage', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

/**
 * The stored value under `key` and its setter. The setter takes an updater,
 * so two writes in one event both land. `codec` must be a module constant.
 */
export function useDraft<T>(
  key: string,
  codec: DraftCodec<T>,
): readonly [T, (update: (previous: T) => T) => void] {
  const getSnapshot = useCallback(() => readDraft(key, codec), [key, codec]);
  const getServerSnapshot = useCallback(() => codec.empty, [codec]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback(
    (fn: (previous: T) => T) => writeDraft(key, codec, fn(readDraft(key, codec))),
    [key, codec],
  );

  return [value, update] as const;
}

/** Plain text: an empty string removes the key. */
export const TEXT_DRAFT: DraftCodec<string> = {
  empty: '',
  decode: (raw) => raw,
  encode: (value) => value || null,
};
