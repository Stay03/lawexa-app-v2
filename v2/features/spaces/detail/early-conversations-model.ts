import { defaultSpaceTab } from '../model';

/**
 * The space's conversations, read beside its details (speed step 5, 17 October
 * 2026).
 *
 * The Conversations tab mounts only once the space's details have answered
 * (`SpaceScreen` draws the frame while they are pending), so its first page
 * waited for one read and then the other. Its key needs only the space, the
 * viewer and the search, so it can start with the details, from the screen.
 *
 * ONLY WHEN THE READ CAN SUCCEED (the techlead, 17 October 2026): the cached
 * spaces list must show the reader as a member (`my_role`), so a space they
 * cannot open sends nothing extra; the session must be able to read content
 * (the tab's own gate); and the page must be opening on that tab, with no
 * search, which is the entry the tab will read. A cold arrival (a pasted link,
 * no list in memory) keeps today's order.
 */
export function startsConversationsEarly({
  eligible,
  cachedRole,
  tabParam,
}: {
  eligible: boolean;
  cachedRole: string | null | undefined;
  tabParam: string | null;
}): boolean {
  return eligible && !!cachedRole && (tabParam === null || tabParam === defaultSpaceTab());
}
