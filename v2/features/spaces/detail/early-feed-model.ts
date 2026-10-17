import { defaultSpaceTab, parseSpaceTab } from '../model';

/**
 * The space home's All list, read beside the space's details (speed step 5,
 * 17 October 2026; the one list since design B4).
 *
 * The list mounts only once the space's details have answered (`SpaceScreen`
 * draws the frame while they are pending), so its first page waited for one
 * read and then the other. Its key needs only the space, the viewer, the pill
 * and the search, so it can start with the details, from the frame.
 *
 * ONLY WHEN THE READ CAN SUCCEED (the techlead, 17 October 2026): the cached
 * spaces list must show the reader as a member (`my_role`), so a space they
 * cannot open sends nothing extra; the session must be able to read content
 * (the list's own gate); and the page must be opening on All, with no search,
 * which is the entry the list will read. A cold arrival (a pasted link, no
 * list in memory) keeps the old order.
 */
export function startsFeedEarly({
  eligible,
  cachedRole,
  tabParam,
}: {
  eligible: boolean;
  cachedRole: string | null | undefined;
  tabParam: string | null;
}): boolean {
  return eligible && !!cachedRole && parseSpaceTab(tabParam) === defaultSpaceTab();
}
