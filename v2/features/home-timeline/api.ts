import { apiClient } from '@/lib/api/client';
import type { TimelineEnvelope, TimelinePage, TimelineType } from './types';

/** One page of the timeline. The server allows up to 50; 20 fills two screens. */
export const TIMELINE_PAGE_SIZE = 20;

export interface TimelinePageParams {
  type: TimelineType;
  /** The previous page's `next_cursor`; absent for the first page. */
  cursor?: string;
}

/**
 * The home timeline's wire layer: what happened in the reader's Work or Study
 * Spaces, newest first, cursor-paged (`GET /api/home/timeline`, signed in).
 */
export const homeTimelineApi = {
  page: async ({ type, cursor }: TimelinePageParams): Promise<TimelinePage> => {
    const response = await apiClient.get<TimelineEnvelope>('/home/timeline', {
      params: { type, cursor: cursor || undefined, per_page: TIMELINE_PAGE_SIZE },
    });
    return response.data.data;
  },
};
