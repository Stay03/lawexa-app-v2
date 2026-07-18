import type { SpaceListParams } from '@/types/collab';

/**
 * The ONE work-spaces query params for the "Your work spaces" module. Kept in a
 * single place so its `spacesQueries.list(WORK_SPACES_PARAMS)` key is defined
 * once — no inline params drifting across renders. (Historically this was also
 * shared with "Jump back in", which fanned out per-space channel lists over the
 * same spaces query; that module now reads the cross-space `channelsQueries.mine`
 * endpoint directly, so WorkSpacesModule is the sole consumer.)
 */
export const WORK_SPACES_PARAMS: SpaceListParams = {
  type: 'work',
  per_page: 12,
};
