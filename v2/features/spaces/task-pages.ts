import type { SpaceTask, SpaceTaskListResponse } from '@/types/collab';

/**
 * Every page of a task board read, in the server's order, each card once (the
 * techlead's review of 8f1f842e): a card moved between two page reads can come
 * on both pages, so a later copy of a uuid is dropped. The pages run until the
 * server's `last_page`; a board with no cards answers `last_page: 0` on page 1,
 * and that one page is the read. No React or API client, so node:test reads it.
 */
export async function readTaskPages(read: (page: number) => Promise<SpaceTaskListResponse>): Promise<SpaceTask[]> {
  const seen = new Set<string>();
  const rows: SpaceTask[] = [];
  const take = (response: SpaceTaskListResponse) => {
    for (const task of response.data) {
      if (seen.has(task.uuid)) continue;
      seen.add(task.uuid);
      rows.push(task);
    }
  };
  const first = await read(1);
  take(first);
  for (let page = 2; page <= first.pagination.last_page; page += 1) take(await read(page));
  return rows;
}
