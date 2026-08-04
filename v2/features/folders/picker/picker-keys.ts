/**
 * picker-keys.ts — WHAT the keyboard does, as pure functions over plain data.
 *
 * It lives apart from the component because both of the picker's real hazards
 * are logic, not rendering, and logic can be proved:
 *
 *  1. THE HIGHLIGHT IS AN IDENTITY, NEVER AN INDEX. The destination list GROWS
 *     under the reader — the sentinel fetches page 2 while they are arrowing,
 *     an invalidation reorders it, a create lands a new row. An index into that
 *     list silently re-points at a different folder, and the next Enter files
 *     the item into something nobody has ever seen. A uuid cannot drift.
 *
 *  2. ENTER MUST NEVER ACT ON A LIST THAT IS BEHIND THE FIELD. The rows come
 *     from a DEBOUNCED query, so for a beat after each keystroke they answer
 *     the previous search — and the moment the debounce fires, the new key has
 *     no cached data at all, which empties the list and leaves the create row
 *     as the only option. Enter on either of those is a wrong write: the first
 *     files into whatever sat at the top of the old list, the second mints a
 *     duplicate folder (the server accepts duplicate names). So Enter first
 *     COMMITS what was typed, and only a second Enter — on a list that provably
 *     answers it — chooses.
 */

/** The picker's highlight: a real folder, or the create row that is always last. */
export type PickerActive =
  | { kind: 'create' }
  | { kind: 'folder'; uuid: string };

export const CREATE_ACTIVE: PickerActive = { kind: 'create' };

/** The option ring in render order: every folder, then the create row. */
export function pickerOptionRing(
  folderUuids: readonly string[],
): readonly PickerActive[] {
  return [
    ...folderUuids.map((uuid): PickerActive => ({ kind: 'folder', uuid })),
    CREATE_ACTIVE,
  ];
}

function sameActive(a: PickerActive, b: PickerActive): boolean {
  if (a.kind === 'create' || b.kind === 'create') return a.kind === b.kind;
  return a.uuid === b.uuid;
}

/**
 * Which option is highlighted right now.
 *
 * `held` is what the reader last moved to, or `null` when they have not moved.
 * An unheld — or vanished — highlight resolves to the FIRST option, which is
 * the top of the visible list: a highlight can only ever fall back to somewhere
 * the reader is already looking, never drift to a row further down.
 */
export function resolveActive(
  ring: readonly PickerActive[],
  held: PickerActive | null,
): PickerActive {
  if (held && ring.some((option) => sameActive(option, held))) return held;
  return ring[0] ?? CREATE_ACTIVE;
}

/** Move the highlight by `delta` places, wrapping at both ends. */
export function moveActive(
  ring: readonly PickerActive[],
  active: PickerActive,
  delta: number,
): PickerActive {
  if (ring.length === 0) return CREATE_ACTIVE;
  const index = ring.findIndex((option) => sameActive(option, active));
  const from = index === -1 ? 0 : index;
  const next = (from + delta + ring.length) % ring.length;
  return ring[next];
}

/** What Enter should do, given everything that is knowable at press time. */
export type EnterAction =
  /** The list is behind the field — commit the typed search and stop. */
  | { kind: 'commit-search' }
  /** The level has not resolved (or failed); pressing Enter must do nothing. */
  | { kind: 'none' }
  | { kind: 'choose'; uuid: string }
  | { kind: 'create'; name: string }
  /** The create row with nothing typed: say where the name goes. */
  | { kind: 'focus-field' };

export function enterAction({
  listReady,
  input,
  committedSearch,
  active,
}: {
  /** The level query has data — the rows on screen are real rows. */
  listReady: boolean;
  /** The field's live text. */
  input: string;
  /** The debounced text the rendered list was actually fetched with. */
  committedSearch: string;
  active: PickerActive;
}): EnterAction {
  const typed = input.trim();

  // The field has moved on from the list. Commit first; the NEXT Enter chooses,
  // by which time the rows answer the words on screen.
  if (typed !== committedSearch.trim()) return { kind: 'commit-search' };
  if (!listReady) return { kind: 'none' };

  if (active.kind === 'folder') return { kind: 'choose', uuid: active.uuid };
  return typed ? { kind: 'create', name: typed } : { kind: 'focus-field' };
}
