import type { InfiniteData, QueryKey } from '@tanstack/react-query';

import type {
  ChannelQuizListResponse,
  ChannelQuizVisibility,
} from '@/types/channel-quiz';

/**
 * list-cache — which cache entries hold quiz ROWS, and how one row inside
 * them is rewritten in place. Pure, so the mutations can share it with the
 * node test runner and the two list shapes can be checked side by side.
 *
 * ── FOUR LISTS, TWO SHAPES (2026-10-21) ────────────────────────────────────
 * A quiz row appears on up to four lists under the `channel-quiz` root: a
 * room's list and the sheet's library page (flat `ChannelQuizListResponse`
 * entries), and the solo surfaces' library and explore lists, which are
 * page-infinite (`InfiniteData<ChannelQuizListResponse>`). The optimistic
 * visibility write used to reach into `rows.data` on every entry it matched,
 * which would throw on an infinite entry's `{ pages, pageParams }` the moment
 * one existed. So the shape is read before the rows are, here, once.
 *
 * NEVER THE GAME STATE, NEVER AN ATTEMPT. `isQuizListQuery` names the row
 * lists and nothing else under the root: the live game's poll is the game's
 * transport and its recovery, and an attempt in play is one person's clock
 * and answers. An authoring write must not disturb either.
 */

/** The second key segment of every quiz-row list under `['channel-quiz']`. */
export const QUIZ_LIST_KINDS = ['quizzes', 'my-quizzes', 'my-library', 'explore'] as const;

/** True for the row lists and for nothing else under the `channel-quiz` root. */
export function isQuizListQuery(query: { queryKey: QueryKey }): boolean {
  const [root, kind] = query.queryKey;
  return (
    root === 'channel-quiz' &&
    typeof kind === 'string' &&
    (QUIZ_LIST_KINDS as readonly string[]).includes(kind)
  );
}

/** What a quiz-row list entry holds: one page, or every page so far. */
export type QuizListCacheEntry =
  | ChannelQuizListResponse
  | InfiniteData<ChannelQuizListResponse>;

function isInfiniteEntry(
  entry: QuizListCacheEntry,
): entry is InfiniteData<ChannelQuizListResponse> {
  return 'pages' in entry && Array.isArray(entry.pages);
}

/** One page with one quiz's `visibility` rewritten — and the SAME object back
 *  when the row is absent or already says this, so an untouched page cannot
 *  re-render anything. */
function pageWithVisibility(
  page: ChannelQuizListResponse,
  quizUuid: string,
  visibility: ChannelQuizVisibility,
): ChannelQuizListResponse {
  let touched = false;
  const data = page.data.map((quiz) => {
    if (quiz.uuid !== quizUuid || quiz.visibility === visibility) return quiz;
    touched = true;
    return { ...quiz, visibility };
  });
  return touched ? { ...page, data } : page;
}

/**
 * A list entry with one quiz's `visibility` rewritten, whichever shape it is,
 * and the SAME entry back when nothing in it changed. Untouched pages keep
 * their identity inside a patched infinite entry for the same reason.
 */
export function withVisibility<Entry extends QuizListCacheEntry>(
  entry: Entry,
  quizUuid: string,
  visibility: ChannelQuizVisibility,
): Entry {
  if (isInfiniteEntry(entry)) {
    let touched = false;
    const pages = entry.pages.map((page) => {
      const next = pageWithVisibility(page, quizUuid, visibility);
      if (next !== page) touched = true;
      return next;
    });
    return touched ? ({ ...entry, pages } as Entry) : entry;
  }
  return pageWithVisibility(entry, quizUuid, visibility) as Entry;
}
