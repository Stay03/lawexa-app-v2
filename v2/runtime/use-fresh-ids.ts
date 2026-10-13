import { useState } from 'react';

/** The ids not in `shown`, in list order: the pure step of {@link useFreshIds}. */
export function freshAgainst(shown: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  return new Set(ids.filter((id) => !shown.has(id)));
}

/**
 * The ids a list shows now that it did not show on its last change: the rows
 * that may play an entrance. Every id is fresh on the first render, so a first
 * load still fades in.
 *
 * WHY. A row's entrance is a CSS animation (tw-animate-css `animate-in
 * fade-in`, which starts at opacity 0). When a chat moves to the top of a list
 * (a new message, `conversationsCache.touch`), React keeps every keyed row but
 * moves the rows it passed with `insertBefore`, and a moved element starts its
 * animation again from frame 0. Those rows blinked on every move (list-order3,
 * 13 October 2026). A row that is not fresh gets no entrance class, so a move
 * has nothing to replay.
 *
 * "Adjust state during render", the pattern `cache-identity-guard.tsx` uses: the
 * last list's ids are state, compared during render, so the answer is right in
 * the same commit and needs no effect. One extra pass per change; the same Set
 * comes back until the ids change again.
 */
export function useFreshIds(ids: readonly string[]): ReadonlySet<string> {
  const key = ids.join('\u0000');
  const [state, setState] = useState(() => {
    const all: ReadonlySet<string> = new Set(ids);
    return { key, shown: all, fresh: all };
  });
  if (state.key !== key) {
    const fresh = freshAgainst(state.shown, ids);
    const next = { key, shown: new Set(ids) as ReadonlySet<string>, fresh };
    setState(next);
    return fresh;
  }
  return state.fresh;
}
