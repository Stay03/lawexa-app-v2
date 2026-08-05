/**
 * The public quiz-results share link — its address, and the one sentence that
 * has to travel with it.
 *
 * IT LIVES HERE BECAUSE IT IS WRITTEN AND READ ON OPPOSITE SIDES OF A WALL.
 * The affordance that hands the link out is a v2 surface
 * (`v2/features/channels/quiz/ShareResults.tsx`); the page that serves it is a
 * plain public route (`app/quiz-results/[gameUuid]`), deliberately OUTSIDE the
 * v2 tree so a stranger with no opt-in cookie can open it. Those two may not
 * import each other, so a second copy of the path would be a shared link that
 * keeps working right up until someone renames a folder. `lib/constants` is
 * the shared layer both are allowed to read.
 */

/**
 * Where a finished game's public result lives.
 *
 * NOT in `v2/routes.manifest.ts`, and that omission is the whole design: a path
 * in the manifest is only served from the v2 tree when the reader carries the
 * `lawexa-ui=v2` cookie, and a shared link is opened by people who have never
 * heard of this app. Left out of the manifest, the proxy ignores it and one
 * page answers for everyone.
 */
export function publicQuizResultsPath(gameUuid: string): string {
  return `/quiz-results/${encodeURIComponent(gameUuid)}`;
}

/**
 * Said ONCE, quietly, wherever the link is handed out.
 *
 * The game uuid is the only key — there is no second check, no sign-in, no
 * membership test — so possessing the link IS the permission, and anyone who
 * shares one deserves to know that before they paste it rather than after.
 * The second half is the reassurance that makes the first half bearable: the
 * public page publishes a podium and nothing that was asked or answered.
 */
export const PUBLIC_QUIZ_RESULTS_NOTICE =
  'Anyone with this link can open it — there is no sign-in. It shows the top three and their scores, and nothing that was asked or answered.';
