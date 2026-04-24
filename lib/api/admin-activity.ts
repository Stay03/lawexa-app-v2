// Admin Activity Feed - API Service Layer
// Backs GET /api/admin/activity-feed and /api/admin/activity-feed/stats

import { apiClient } from './client';
import type {
  ActivityFeedParams,
  ActivityFeedResponse,
  ActivityStatsParams,
  ActivityStatsResponse,
} from '@/types/admin-activity';

// Axios serializes array values as `key[]=a&key[]=b`, matching Laravel's expected `action[]` format.
async function getActivityFeed(
  params: ActivityFeedParams = {}
): Promise<ActivityFeedResponse> {
  const response = await apiClient.get<ActivityFeedResponse>(
    '/admin/activity-feed',
    { params }
  );
  return response.data;
}

async function getActivityFeedStats(
  params: ActivityStatsParams = {}
): Promise<ActivityStatsResponse> {
  const response = await apiClient.get<ActivityStatsResponse>(
    '/admin/activity-feed/stats',
    { params }
  );
  return response.data;
}

export const adminActivityApi = {
  getActivityFeed,
  getActivityFeedStats,
};
