/**
 * picker-search.ts — how the picker's search keeps up with the field, as
 * plain functions that a test can drive without rendering anything.
 *
 * Arthur's iPhone recording, 24 October 2026: typing "Emp" showed "No folder
 * matches 'E'", "Employmrnt" showed words from an older search, and four
 * skeleton rows flashed on every key. Three rules answer that:
 *
 *  1. THE REQUEST WAITS FOR A PAUSE. The field asks the server only once the
 *     reader has stopped typing for {@link SEARCH_DEBOUNCE_MS}
 *     ({@link createDebounce}).
 *  2. ONLY THE ANSWER FOR THE CURRENT WORDS COUNTS. Each search is its own
 *     TanStack Query key, so a late answer for "Em" lands in the "Em" entry
 *     and never on screen while "Emp" is asked. While "Emp" loads, the last
 *     answer stays up as placeholder data ({@link keepWithinLevel}), and the
 *     list says it is not yet the answer ({@link pickerListState}).
 *  3. THE WORDS ON SCREEN USE WHAT IS TYPED. "No folder matches …" and
 *     "Create …" read the field, never the search the rows were fetched with.
 */

/** How long the field waits, after the last key, before the search runs. */
export const SEARCH_DEBOUNCE_MS = 250;

/** The timer calls the debounce uses: the real ones, or a test's. */
export interface DebounceTimers {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const realTimers: DebounceTimers = {
  set: (run, ms) => globalThis.setTimeout(run, ms),
  clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface Debounce {
  /** A key was pressed: start the wait again, then apply `value`. */
  push: (value: string) => void;
  /** Apply `value` now and drop any wait still running. */
  flush: (value: string) => void;
  /** Drop any wait still running, applying nothing. */
  cancel: () => void;
}

/**
 * One wait at a time: each `push` replaces the one before, so only the words
 * typed last are ever applied, once the reader pauses.
 */
export function createDebounce(
  apply: (value: string) => void,
  waitMs: number = SEARCH_DEBOUNCE_MS,
  timers: DebounceTimers = realTimers,
): Debounce {
  let handle: unknown = null;
  const cancel = () => {
    if (handle !== null) {
      timers.clear(handle);
      handle = null;
    }
  };
  return {
    push: (value) => {
      cancel();
      handle = timers.set(() => {
        handle = null;
        apply(value);
      }, waitMs);
    },
    flush: (value) => {
      cancel();
      apply(value);
    },
    cancel,
  };
}

/** The part of a level's query key that names the level and the search. */
function levelOf(queryKey: readonly unknown[] | undefined): { parentUuid: unknown } | null {
  if (!queryKey) return null;
  for (const part of queryKey) {
    if (typeof part === 'object' && part !== null && 'parentUuid' in part) {
      return part;
    }
  }
  return null;
}

/**
 * The placeholder rule: a new search in the SAME level keeps the last answer
 * on screen while it loads; a move to another level does not. The rows of the
 * folder just left are not what is inside the folder just opened, so a drill
 * shows the skeleton until its own rows arrive.
 */
export function keepWithinLevel(parentUuid: string | null) {
  return <T>(previous: T | undefined, previousQuery?: { queryKey: readonly unknown[] }): T | undefined => {
    const level = levelOf(previousQuery?.queryKey);
    return level !== null && level.parentUuid === parentUuid ? previous : undefined;
  };
}

/** What the list area shows, given the level query and the field. */
export interface PickerListState {
  /** Nothing to show yet: the first load of this level. */
  skeleton: boolean;
  /** A small spinner in the search box: a pause or a request is still running. */
  searching: boolean;
  /** The rows on screen are the server's answer to the words in the field. */
  answersTyped: boolean;
}

export function pickerListState({
  isPending,
  isFetching,
  isPlaceholderData,
  input,
  query,
}: {
  isPending: boolean;
  isFetching: boolean;
  /** The rows are the previous search's, kept while this one loads. */
  isPlaceholderData: boolean;
  /** The field's live text. */
  input: string;
  /** The debounced text the current request was made with. */
  query: string;
}): PickerListState {
  const caughtUp = input.trim() === query.trim();
  return {
    skeleton: isPending,
    searching: !isPending && (isFetching || !caughtUp),
    answersTyped: !isPending && !isPlaceholderData && caughtUp,
  };
}

/**
 * On the phone, when nothing matches what is typed, the create row goes
 * straight under the search box, above the empty words: with the keyboard up
 * that is the part of the sheet still in view (Arthur's iPhone recording,
 * 24 October 2026, where "Create 'Employment Folder'" sat under the keyboard).
 */
export function createRowFirst(folderCount: number, typed: string): boolean {
  return folderCount === 0 && typed.trim() !== '';
}
