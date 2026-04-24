// Admin Activity Feed Types
// Backed by GET /api/admin/activity-feed and /api/admin/activity-feed/stats

export const ACTIVITY_ACTIONS = {
  auth: [
    'user_registered',
    'user_logged_in',
    'user_logged_out',
    'guest_created',
    'google_login_succeeded',
    'login_failed',
    'password_reset_requested',
    'password_reset_completed',
  ],
  ai: [
    'conversation_created',
    'conversation_viewed',
    'conversation_published',
    'conversation_deleted',
    'ai_message_sent',
  ],
  contentView: [
    'case_viewed',
    'statute_viewed',
    'note_viewed',
    'folder_viewed',
  ],
  contentCreate: [
    'note_created',
    'note_published',
    'note_unpublished',
    'note_deleted',
    'note_restored',
    'folder_created',
    'folder_updated',
    'folder_deleted',
    'folder_restored',
    'folder_item_added',
    'folder_item_removed',
    'content_requested',
    'case_deleted',
    'case_restored',
  ],
  bookmark: ['bookmark_added', 'bookmark_removed'],
  commerce: [
    'subscription_started',
    'subscription_cancelled',
    'message_pack_purchased',
  ],
  export: ['note_exported', 'case_exported'],
} as const;

export type KnownActivityAction =
  | (typeof ACTIVITY_ACTIONS)['auth'][number]
  | (typeof ACTIVITY_ACTIONS)['ai'][number]
  | (typeof ACTIVITY_ACTIONS)['contentView'][number]
  | (typeof ACTIVITY_ACTIONS)['contentCreate'][number]
  | (typeof ACTIVITY_ACTIONS)['bookmark'][number]
  | (typeof ACTIVITY_ACTIONS)['commerce'][number]
  | (typeof ACTIVITY_ACTIONS)['export'][number];

// Keep the type open — backend will add new actions over time.
export type ActivityAction = KnownActivityAction | (string & {});

export type ActivityStatus = 'success' | 'failed';

export interface ActivityUser {
  id: number;
  uuid: string;
  name: string | null;
  email: string | null;
  role: string;
}

export interface ActivitySubject {
  type: string;
  id: number;
  label: string | null;
}

export interface ActivityIp {
  address: string | null;
  country: string | null;
  country_code: string | null;
  continent: string | null;
  continent_code: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
}

export interface ActivityDevice {
  id: string | null;
  name: string | null;
  type: string | null;
  browser: string | null;
  browser_version: string | null;
  platform: string | null;
  platform_version: string | null;
  user_agent: string | null;
}

export interface ActivityBot {
  is_bot: boolean;
  name: string | null;
}

export interface ActivityFeedRow {
  id: number;
  action: ActivityAction;
  status: ActivityStatus;
  user: ActivityUser | null;
  subject: ActivitySubject | null;
  properties: Record<string, unknown>;
  ip: ActivityIp;
  device: ActivityDevice;
  bot: ActivityBot;
  created_at: string;
}

export interface ActivityFeedPagination {
  per_page: number;
  has_more: boolean;
  next_cursor: string | null;
  prev_cursor: string | null;
}

export interface ActivityFeedLinks {
  prev: string | null;
  next: string | null;
}

export interface CursorPaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: ActivityFeedPagination;
  links: ActivityFeedLinks;
}

export type ActivityFeedResponse = CursorPaginatedResponse<ActivityFeedRow>;

export interface ActivityFeedParams {
  user_id?: number;
  action?: ActivityAction[];
  status?: ActivityStatus;
  is_bot?: boolean;
  subject_type?: string;
  subject_id?: number;
  device_id?: string;
  ip_address?: string;
  country?: string;
  university?: string;
  law_school?: string;
  profession?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  cursor?: string;
}

export interface ActivityStatsRow {
  day: string;
  action: ActivityAction;
  total: number;
}

export interface ActivityStatsResponse {
  success: boolean;
  message: string;
  data: ActivityStatsRow[];
}

export type ActivityStatsParams = Omit<
  ActivityFeedParams,
  'per_page' | 'cursor'
>;

// Facets
export type ActivityFacetsParams = ActivityStatsParams;

export interface ActivityFacetValue {
  value: string;
  count: number;
}

export interface ActivityCountryFacetValue extends ActivityFacetValue {
  code: string | null;
}

export interface ActivityFacets {
  actions: ActivityFacetValue[];
  countries: ActivityCountryFacetValue[];
  universities: ActivityFacetValue[];
  law_schools: ActivityFacetValue[];
  professions: ActivityFacetValue[];
}

export interface ActivityFacetsResponse {
  success: boolean;
  data: ActivityFacets;
}
