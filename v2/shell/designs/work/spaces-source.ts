import type { SpaceListParams } from '@/types/collab';

/**
 * The ONE work-spaces query params, shared by the "Your work spaces" and "Jump
 * back in" modules. Both call `spacesQueries.list(WORK_SPACES_PARAMS)` so they
 * resolve to a SINGLE cached spaces query — TanStack dedupes identical keys, so
 * the two modules trigger one fetch and read one cache entry (no double load,
 * no drift). Keeping the params in one place is what guarantees the key match.
 */
export const WORK_SPACES_PARAMS: SpaceListParams = {
  type: 'work',
  per_page: 12,
};
